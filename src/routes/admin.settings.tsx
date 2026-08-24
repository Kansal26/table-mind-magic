import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateAndSendOtpFn, verifyOtpFn } from "@/lib/otp.functions";
import { deactivateAccountFn, deleteAccountFn } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldAlert, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { session, restaurant } = Route.useRouteContext();
  const token = session.access_token;

  // Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdOtpRequested, setPwdOtpRequested] = useState(false);
  const [pwdOtp, setPwdOtp] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // Deactivate State
  const [deactOtpRequested, setDeactOtpRequested] = useState(false);
  const [deactOtp, setDeactOtp] = useState("");
  const [deactLoading, setDeactLoading] = useState(false);

  // Delete State
  const [delNameConfirm, setDelNameConfirm] = useState("");
  const [delOtpRequested, setDelOtpRequested] = useState(false);
  const [delOtp, setDelOtp] = useState("");
  const [delLoading, setDelLoading] = useState(false);

  async function requestOtp(purpose: "change_password" | "deactivate_account" | "delete_account") {
    try {
      await generateAndSendOtpFn({ data: { token, purpose } });
      toast.success("Verification code sent to your email.");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to request code. Please try again.");
      return false;
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setPwdLoading(true);
    try {
      if (!pwdOtpRequested) {
        const success = await requestOtp("change_password");
        if (success) setPwdOtpRequested(true);
      } else {
        const verifyRes = await verifyOtpFn({ data: { token, purpose: "change_password", code: pwdOtp } });
        if (verifyRes.verified) {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          toast.success("Password updated successfully!");
          setNewPassword("");
          setConfirmPassword("");
          setPwdOtp("");
          setPwdOtpRequested(false);
        } else {
          toast.error(verifyRes.error || "Invalid code");
          if (verifyRes.attemptsRemaining === 0) setPwdOtpRequested(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleDeactivate(e: React.FormEvent) {
    e.preventDefault();
    setDeactLoading(true);
    try {
      if (!deactOtpRequested) {
        const success = await requestOtp("deactivate_account");
        if (success) setDeactOtpRequested(true);
      } else {
        const verifyRes = await verifyOtpFn({ data: { token, purpose: "deactivate_account", code: deactOtp } });
        if (verifyRes.verified) {
          await deactivateAccountFn({ data: { token } });
          toast.success("Account deactivated");
          await supabase.auth.signOut();
          navigate({ to: "/" });
        } else {
          toast.error(verifyRes.error || "Invalid code");
          if (verifyRes.attemptsRemaining === 0) setDeactOtpRequested(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate account");
    } finally {
      setDeactLoading(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (delNameConfirm !== restaurant.name) {
      toast.error("Restaurant name does not match.");
      return;
    }
    setDelLoading(true);
    try {
      if (!delOtpRequested) {
        const success = await requestOtp("delete_account");
        if (success) setDelOtpRequested(true);
      } else {
        const verifyRes = await verifyOtpFn({ data: { token, purpose: "delete_account", code: delOtp.trim() } });
        if (verifyRes.verified) {
          await deleteAccountFn({ data: { token } });
          toast.success("Account permanently deleted.");
          // Catch error because the user is already deleted on the server, so signOut network request will fail
          await supabase.auth.signOut().catch(() => {});
          navigate({ to: "/" });
        } else {
          toast.error(verifyRes.error || "Invalid code");
          if (verifyRes.attemptsRemaining === 0) setDelOtpRequested(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-12 pb-24">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Security Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your password and account status.</p>
      </div>

      <div className="space-y-6">
        <div className="border border-border bg-card rounded-2xl p-6 shadow-soft">
          <h2 className="text-xl font-semibold mb-4">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={pwdOtpRequested}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={pwdOtpRequested}
                required
              />
            </div>
            
            {pwdOtpRequested && (
              <div className="space-y-2 pt-4">
                <Label>Verification Code (Sent to Email)</Label>
                <Input
                  type="text"
                  maxLength={6}
                  value={pwdOtp}
                  onChange={(e) => setPwdOtp(e.target.value)}
                  placeholder="123456"
                  required
                />
              </div>
            )}

            <Button type="submit" disabled={pwdLoading}>
              {pwdLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pwdOtpRequested ? "Confirm Change" : "Send Verification Code"}
            </Button>
            {pwdOtpRequested && (
              <Button type="button" variant="ghost" onClick={() => setPwdOtpRequested(false)} className="ml-2">
                Cancel
              </Button>
            )}
          </form>
        </div>

        <div className="border border-warning/50 bg-warning/10 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-warning">Deactivate Account</h2>
                <p className="text-sm mt-1">
                  Deactivating will hide your restaurant from customers — QR codes will show 
                  "Temporarily unavailable" and you won't be able to access your dashboard 
                  until you reactivate by signing in again.
                </p>
              </div>
              <form onSubmit={handleDeactivate} className="max-w-sm">
                {deactOtpRequested ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Verification Code (Sent to Email)</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={deactOtp}
                        onChange={(e) => setDeactOtp(e.target.value)}
                        placeholder="123456"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="outline" className="border-warning text-warning" disabled={deactLoading}>
                        {deactLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Deactivation
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setDeactOtpRequested(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="submit" variant="outline" className="border-warning text-warning" disabled={deactLoading}>
                    {deactLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deactivate My Account
                  </Button>
                )}
              </form>
            </div>
          </div>
        </div>

        <div className="border border-destructive/50 bg-destructive/10 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-4 w-full">
              <div>
                <h2 className="text-xl font-semibold text-destructive">Delete Account (Danger Zone)</h2>
                <p className="text-sm font-bold text-destructive mt-1">
                  This permanently deletes your account, restaurant, menu, all order history, 
                  and all customer data. This CANNOT be undone.
                </p>
              </div>
              
              <form onSubmit={handleDelete} className="max-w-sm space-y-4">
                <div className="space-y-2">
                  <Label>Type <strong>{restaurant.name}</strong> to confirm</Label>
                  <Input
                    type="text"
                    value={delNameConfirm}
                    onChange={(e) => setDelNameConfirm(e.target.value)}
                    disabled={delOtpRequested}
                    placeholder={restaurant.name}
                    required
                  />
                </div>

                {delOtpRequested ? (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Verification Code (Sent to Email)</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={delOtp}
                        onChange={(e) => setDelOtp(e.target.value)}
                        placeholder="123456"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="destructive" disabled={delLoading}>
                        {delLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Permanently Delete
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setDelOtpRequested(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    type="submit" 
                    variant="destructive" 
                    disabled={delLoading || delNameConfirm !== restaurant.name}
                  >
                    {delLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete My Account Permanently
                  </Button>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
