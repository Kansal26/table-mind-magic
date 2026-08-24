import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerRestaurantFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: search['redirect'] ? String(search['redirect']) : undefined,
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const safeRedirect = search.redirect && /^\/[a-zA-Z0-9\-_\/]*$/.test(search.redirect) ? search.redirect : null;
        if (safeRedirect) {
          navigate({ to: safeRedirect as any, replace: true });
        } else {
          try {
            const restaurant = await getOwnerRestaurantFn({ data: { token: session.access_token } });
            if (restaurant) {
              if (restaurant.deactivated_at) {
                navigate({ to: "/auth/reactivate" as any, replace: true });
              } else {
                navigate({ to: "/admin/dashboard" as any, replace: true });
              }
            } else {
              navigate({ to: "/register-restaurant" as any, replace: true });
            }
          } catch {
            navigate({ to: "/profile" as any, replace: true });
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, search.redirect]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
