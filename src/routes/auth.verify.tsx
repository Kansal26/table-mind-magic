import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { claimOrderFn } from "@/lib/account.functions";

type VerifySearch = { phone: string; redirect: string; table: string; order: string };

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search: Record<string, unknown>): VerifySearch => ({
    phone: String(search['phone'] ?? ""),
    redirect: String(search['redirect'] ?? ""),
    table: String(search['table'] ?? ""),
    order: String(search['order'] ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Enter your code — TableMind" },
      { name: "description", content: "Enter the one-time code we texted you to finish signing in." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Enter your code — TableMind" },
      {
        property: "og:description",
        content: "Enter the one-time code we texted you to finish signing in.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { phone, redirect, table, order } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (code.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    if (verifyError) {
      setBusy(false);
      setError(verifyError.message);
      return;
    }

    // Coming from checkout: attach the in-progress order to this account.
    if (table && order) {
      try {
        await claimOrderFn({ data: { qrToken: table, orderId: order } });
      } catch {
        // Non-fatal: the order still completes as a guest order.
      }
    }

    setBusy(false);
    if (redirect === "checkout" && table && order) {
      void navigate({ to: "/checkout", search: { order, session: "", table } });
      return;
    }
    void navigate({ to: "/profile" });
  }

  async function handleResend() {
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    if (otpError) setError(otpError.message);
    else setResent(true);
  }

  if (!phone) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">No number to verify</h1>
          <Button className="mt-4" onClick={() => navigate({ to: "/auth/login" })}>
            Start again
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lift">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageSquare className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-2xl text-foreground">Enter your code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="text-foreground">{phone}</span>.
        </p>

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">One-time code</Label>
            <InputOTP id="otp" maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {resent && !error && (
            <p className="text-sm text-muted-foreground">A new code is on its way.</p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Verify &amp; continue
          </Button>
        </form>

        <div className="mt-6 flex justify-between text-xs text-muted-foreground">
          <button type="button" className="cursor-pointer underline underline-offset-4" onClick={handleResend}>
            Resend code
          </button>
          <button
            type="button"
            className="cursor-pointer underline underline-offset-4"
            onClick={() => navigate({ to: "/auth/login", search: { redirect, table, order } })}
          >
            Change number
          </button>
        </div>
      </div>
    </main>
  );
}