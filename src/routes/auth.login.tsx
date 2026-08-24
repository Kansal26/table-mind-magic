import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerRestaurantFn } from "@/lib/admin.functions";

type LoginSearch = { redirect?: string; table?: string; order?: string };

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const s: LoginSearch = {};
    if (search['redirect']) s.redirect = String(search['redirect']);
    if (search['table']) s.table = String(search['table']);
    if (search['order']) s.order = String(search['order']);
    return s;
  },
  head: () => ({
    meta: [
      { title: "Sign in — TableMind" },
      { name: "description", content: "Sign in to save your orders and dietary profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch() as any;
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    const safeRedirect = search.redirect && /^\/[a-zA-Z0-9\-_\/]*$/.test(search.redirect) ? search.redirect : null;
    const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${redirectQuery}`,
      },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email || !password) {
      setError("Please fill out all required fields.");
      return;
    }
    setError(null);
    setSending(true);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      setSending(false);
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setError("Sign up successful! Please check your email to verify your account.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setSending(false);
      if (signInError) {
        setError(signInError.message);
      } else {
        const safeRedirect = search.redirect && /^\/[a-zA-Z0-9\-_\/]*$/.test(search.redirect) ? search.redirect : null;
        if (safeRedirect) {
          navigate({ to: safeRedirect as any, search });
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const restaurant = await getOwnerRestaurantFn({ data: { token: session.access_token } });
            if (restaurant) {
              if (restaurant.deactivated_at) {
                navigate({ to: "/auth/reactivate" as any });
              } else {
                navigate({ to: "/admin/dashboard" as any });
              }
            } else {
              navigate({ to: "/register-restaurant" as any });
            }
          } else {
            navigate({ to: "/profile" as any });
          }
        }
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lift">
        <h1 className="font-display text-2xl text-foreground">{isSignUp ? "Create an account" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saving your dietary profile and order history makes future visits seamless.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full gap-2 border-border bg-background hover:bg-muted"
          onClick={handleGoogleSignIn}
        >
          <svg className="size-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative mt-6 flex items-center py-2">
          <div className="grow border-t border-border"></div>
          <span className="shrink-0 px-3 text-xs text-muted-foreground uppercase tracking-wider">
            Or continue with email
          </span>
          <div className="grow border-t border-border"></div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="pl-9"
                  required
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@example.com"
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={sending}>
            {sending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isSignUp ? "Sign up" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
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