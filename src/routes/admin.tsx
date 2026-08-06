import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerRestaurantFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw redirect({ to: "/auth/login", search: { redirect: "/admin/dashboard", table: "", order: "" } });
    }

    const restaurant = await getOwnerRestaurantFn({ data: { userId: user.id } });
    
    if (!restaurant) {
      throw redirect({ to: "/register-restaurant" });
    }

    return { user, restaurant };
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
    { name: "Branding", path: "/admin/branding" },
  ];

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
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path) 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.name}
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
