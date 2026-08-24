import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerRestaurantFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user || !session) {
      throw redirect({ to: "/auth/login", search: { redirect: "/admin/dashboard" } as any });
    }

    const restaurant = await getOwnerRestaurantFn({ data: { token: session.access_token } });
    
    if (!restaurant) {
      throw redirect({ to: "/register-restaurant" });
    }

    if (restaurant.deactivated_at) {
      throw redirect({ to: "/auth/reactivate" });
    }

    return { user, session, restaurant };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { restaurant } = Route.useRouteContext();
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/admin/dashboard" },
    { name: "Menu", path: "/admin/menu" },
    { name: "Tables & QR", path: "/admin/tables" },
    { name: "Coupons", path: "/admin/coupons" },
    { name: "Loyalty", path: "/admin/loyalty" },
    { name: "Branding", path: "/admin/branding" },
    { name: "Settings", path: "/admin/settings" },
  ];

  const queryClient = useQueryClient();
  const token = Route.useRouteContext().session.access_token;
  
  const waiterCallsQuery = useQuery({
    queryKey: ["admin-waiter-calls", restaurant.id],
    queryFn: async () => {
      const { fetchAdminWaiterCalls } = await import("@/lib/waiter");
      return await fetchAdminWaiterCalls(token, restaurant.id);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("waiter-calls-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-waiter-calls", restaurant.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, restaurant.id]);

  const activeCalls = waiterCallsQuery.data?.length || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl">{restaurant.name} Admin</div>
          <nav className="flex items-center gap-6">
            {navItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path) 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.name}
                {item.name === "Dashboard" && activeCalls > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {activeCalls}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
