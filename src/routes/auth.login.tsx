import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type LoginSearch = { redirect: string; table: string; order: string };

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: String(search['redirect'] ?? ""),
    table: String(search['table'] ?? ""),
    order: String(search['order'] ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Sign in with your phone — TableMind" },
      {
        name: "description",
        content: "Sign in with a one-time code to save your orders and dietary profile.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in with your phone — TableMind" },
      {
        property: "og:description",
        content: "Sign in with a one-time code to save your orders and dietary profile.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("+1");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = phone.replace(/[^\d+]/g, "");
    if (!/^\+\d{8,15}$/.test(normalized)) {
      setError("Enter your number in international format, e.g. +15551234567.");
      return;
    }
    setError(null);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized });
    setSending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    void navigate({
      to: "/auth/verify",
      search: { phone: normalized, ...search },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lift">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-2xl text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll text you a one-time code. Signing in saves your dietary profile and order history —
          it's never required to order.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              maxLength={16}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+15551234567"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={sending}>
            {sending && <Loader2 className="animate-spin" />}
            Send code
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prefer not to sign in?{" "}
          {search.table ? (
            <Link
              to="/table/$qrToken"
              params={{ qrToken: search.table }}
              className="underline underline-offset-4"
            >
              Continue as a guest
            </Link>
          ) : (
            <Link to="/" className="underline underline-offset-4">
              Back to home
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}