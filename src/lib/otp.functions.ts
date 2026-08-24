import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminAuth } from "./auth.server";
import { rateLimit } from "./rate-limit.server";
import { Resend } from "resend";

const resend = process.env['RESEND_API_KEY'] ? new Resend(process.env['RESEND_API_KEY']) : null;

// SHA-256 is sufficient for short-lived, rate-limited 6-digit OTPs
function hashOtp(code: string, salt: string): string {
  // Salt the OTP to prevent precomputed rainbow tables
  const payload = `${code}${salt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function generateRandomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

import { emailLayout, otpEmailHtml } from "./email.server";

async function sendOtpEmail(email: string, purpose: string, code: string) {
  if (!resend) {
    console.warn("OTP generated but RESEND_API_KEY not configured:", code);
    return;
  }

  let subject = "Your Verification Code";
  let heading = "Your Verification Code";
  let message = "Use the following code to verify your action.";
  let accentColor = "#1A2E4A";
  let warningText: string | undefined = undefined;

  switch (purpose) {
    case "change_password":
      subject = "Confirm your password change";
      heading = "Confirm your password change";
      message = "Enter this code to confirm you'd like to change your TableMind account password.";
      accentColor = "#1A2E4A";
      warningText = "If you didn't request this, you can safely ignore this email — your password won't be changed.";
      break;
    case "deactivate_account":
      subject = "Confirm account deactivation";
      heading = "Confirm account deactivation";
      message = "Enter this code to deactivate your restaurant account. Your QR codes will show as temporarily unavailable to customers until you sign back in to reactivate.";
      accentColor = "#C9622A";
      warningText = "If you didn't request this, ignore this email and consider changing your password.";
      break;
    case "delete_account":
      subject = "Confirm account deletion — this cannot be undone";
      heading = "Confirm permanent account deletion";
      message = "Enter this code to permanently delete your TableMind account, restaurant, menu, and all order history. This action cannot be undone.";
      accentColor = "#C0392B";
      warningText = "This will permanently erase all data with no recovery option. If you didn't request this, ignore this email immediately and change your password.";
      break;
    case "reactivate_account":
      subject = "Verify to reactivate your account";
      heading = "Welcome back";
      message = "It looks like your account was deactivated. Enter this code to reactivate your restaurant and dashboard access.";
      accentColor = "#0D7377";
      break;
  }

  const bodyHtml = otpEmailHtml({ heading, message, code, accentColor, ...(warningText ? { warningText } : {}) });
  const html = emailLayout({
    previewText: subject,
    accentColor: accentColor,
    bodyHtml
  });

  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject,
    html,
  });
}

export const generateAndSendOtpFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      token: z.string(),
      purpose: z.enum(["change_password", "delete_account", "deactivate_account", "reactivate_account"]),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    
    // Rate limit: max 3 OTP requests per user per purpose per hour
    rateLimit(user.id, `otp_${data.purpose}`, 3, 60 * 60 * 1000);

    // Invalidate previous unused OTPs for this purpose
    await supabaseAdmin
      .from("otp_verifications")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("purpose", data.purpose)
      .is("used_at", null);

    const code = generateRandomCode();
    const salt = crypto.randomBytes(16).toString("hex");
    const codeHash = hashOtp(code, salt);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: insertError } = await supabaseAdmin.from("otp_verifications").insert({
      user_id: user.id,
      purpose: data.purpose,
      code_hash: codeHash,
      salt: salt,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) throw new Error("Failed to create OTP record");

    const userEmail = user.email;
    if (!userEmail) throw new Error("User has no email associated");

    await sendOtpEmail(userEmail, data.purpose, code);

    return { ok: true };
  });

export const verifyOtpFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      token: z.string(),
      purpose: z.enum(["change_password", "delete_account", "deactivate_account", "reactivate_account"]),
      code: z.string().length(6),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);

    // Find the most recent unused, non-expired OTP for this user+purpose
    const { data: otps, error } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("purpose", data.purpose)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !otps || otps.length === 0 || !otps[0]) {
      return { verified: false, attemptsRemaining: 0, error: "No active OTP found. Please request a new one." };
    }

    const otp = otps[0];
    
    if (new Date(otp.expires_at) < new Date()) {
      return { verified: false, attemptsRemaining: 0, error: "OTP expired. Please request a new one." };
    }

    if (otp.attempts >= otp.max_attempts) {
      // Already maxed out, invalidate it
      await supabaseAdmin.from("otp_verifications").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
      return { verified: false, attemptsRemaining: 0, error: "Too many attempts. Please request a new OTP." };
    }

    // Increment attempts
    await supabaseAdmin
      .from("otp_verifications")
      .update({ attempts: otp.attempts + 1 })
      .eq("id", otp.id);

    const codeHash = hashOtp(data.code, otp.salt);
    if (codeHash !== otp.code_hash) {
      const remaining = otp.max_attempts - (otp.attempts + 1);
      if (remaining <= 0) {
        // Invalidate on hitting 0
        await supabaseAdmin.from("otp_verifications").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
        return { verified: false, attemptsRemaining: 0, error: "Too many attempts. Please request a new OTP." };
      }
      return { verified: false, attemptsRemaining: remaining, error: "Incorrect code." };
    }

    // Success! Mark as used
    await supabaseAdmin
      .from("otp_verifications")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otp.id);

    return { verified: true };
  });
