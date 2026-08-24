import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateAndSendOtpFn, verifyOtpFn } from "@/lib/otp.functions";
import { reactivateAccountFn } from "@/lib/security.functions";
import { getOwnerRestaurantFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/reactivate")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw redirect({ to: "/auth/login" });
    }
    const restaurant = await getOwnerRestaurantFn({ data: { token: session.access_token } });
    if (!restaurant) {
      throw redirect({ to: "/register-restaurant" });
    }
    if (!restaurant.deactivated_at) {
      throw redirect({ to: "/admin/dashboard" });
    }
    return { session, restaurant };
  },
  component: ReactivatePage,
});

function ReactivatePage() {
  const navigate = useNavigate();
  const { session, restaurant } = Route.useRouteContext();
  const token = session.access_token;
  
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // We do not auto-send the OTP on mount. User must explicitly click "Send verification code".

  async function handleReactivate(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const verifyRes = await verifyOtpFn({ data: { token, purpose: "reactivate_account", code } });
      if (verifyRes.verified) {
        await reactivateAccountFn({ data: { token } });
        toast.success("Account reactivated successfully!");
        navigate({ to: "/admin/dashboard" });
      } else {
        toast.error(verifyRes.error || "Invalid code");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lift">
        <h1 className="font-display text-2xl text-foreground mb-2">Reactivate Account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Welcome back to <strong>{restaurant.name}</strong>! 
          We've sent a 6-digit code to your email to confirm your reactivation.
        </p>

        {otpSent ? (
          <form onSubmit={handleReactivate} className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Reactivate
            </Button>
          </form>
        ) : (
          <Button 
            className="w-full" 
            size="lg" 
            disabled={sendingOtp}
            onClick={async () => {
              setSendingOtp(true);
              try {
                await generateAndSendOtpFn({ data: { token, purpose: "reactivate_account" } });
                toast.success("Verification code sent!");
                setOtpSent(true);
              } catch (err: any) {
                toast.error(err.message || "Failed to send code");
              } finally {
                setSendingOtp(false);
              }
            }}
          >
            {sendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send verification code
          </Button>
        )}
        
        {otpSent && (
          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={sendingOtp}
              onClick={async () => {
                setSendingOtp(true);
                try {
                  await generateAndSendOtpFn({ data: { token, purpose: "reactivate_account" } });
                  toast.success("New code sent!");
                } catch (err: any) {
                  toast.error(err.message || "Failed to resend code");
                } finally {
                  setSendingOtp(false);
                }
              }}
            >
              {sendingOtp && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Resend Code
            </Button>
          </div>
        )}
        
        <div className="mt-2 text-center">
          <Button 
            variant="link" 
            size="sm" 
            className="text-muted-foreground"
            onClick={() => {
              supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            Cancel and sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
