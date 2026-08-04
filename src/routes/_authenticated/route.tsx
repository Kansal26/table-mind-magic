import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // Supabase keeps the session in localStorage, which SSR cannot read.
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth/login", search: { redirect: "", table: "", order: "" } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});