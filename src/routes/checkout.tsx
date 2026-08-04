import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchBill, money, payOrder, type CartLine } from "@/lib/ordering";
import { claimOrderFn } from "@/lib/account.functions";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyProfile, profileNeedsDietaryInfo } from "@/lib/profile";

type CheckoutSearch = { order: string; session: string; table: string };

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    order: String(search['order'] ?? ""),
    session: String(search['session'] ?? ""),
    table: String(search['table'] ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Checkout — TableMind" },
      { name: "description", content: "Review your itemised bill and pay from your table." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Checkout — TableMind" },
      { property: "og:description", content: "Review your itemised bill and pay from your table." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { order: orderId, session: sessionId, table: qrToken } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const orderQuery = useQuery({
    queryKey: ["checkout", qrToken, orderId],
    queryFn: () => fetchBill(qrToken, orderId),
    enabled: !!orderId && !!qrToken,
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id ?? ""],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      // Signed-in diners get the order attached to their account; guests stay NULL.
      if (user) {
        try {
          await claimOrderFn({ data: { qrToken, orderId } });
        } catch {
          // Non-fatal — the order still completes.
        }
      }
      await payOrder(qrToken, orderId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["checkout", qrToken, orderId] });
      queryClient.removeQueries({ queryKey: ["cart", qrToken, sessionId] });
      queryClient.removeQueries({ queryKey: ["table", qrToken] });
    },
  });

  if (orderQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const data = orderQuery.data;
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">We couldn't find that bill</h1>
          <p className="mt-2 text-sm text-muted-foreground">Head back to the menu and try again.</p>
        </div>
      </main>
    );
  }

  const { order, lines } = data;

  if (order.status === "paid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lift">
          <CheckCircle2 className="mx-auto size-10 text-olive" />
          <h1 className="mt-4 font-display text-2xl text-foreground">Order confirmed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The kitchen has your order. {money(order.total)} paid — no need to flag anyone down.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Ref {order.id.slice(0, 8)}
          </p>
          {user && profileNeedsDietaryInfo(profileQuery.data ?? null) && (
            <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
              <p className="text-sm text-foreground">
                Tell us what you eat and we'll tailor every menu to you next time.
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                onClick={() => navigate({ to: "/profile" })}
              >
                Add dietary preferences
              </Button>
            </div>
          )}
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link to="/table/$qrToken" params={{ qrToken }}>
              Start a new order
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-16">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate({ to: "/table/$qrToken", params: { qrToken } })}
          className="mt-6 inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to menu
        </button>

        <h1 className="mt-6 font-display text-3xl text-foreground">Your bill</h1>

        {!user && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Sign in to save your order &amp; earn rewards
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional — you can pay and finish as a guest.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/auth/login",
                  search: { redirect: "checkout", table: qrToken, order: orderId },
                })
              }
            >
              Sign in
            </Button>
          </div>
        )}

        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card px-4 shadow-soft">
          {lines.map((line: CartLine) => (
            <li key={line.id} className="flex gap-3 py-4">
              <span className="text-sm text-muted-foreground">{line.qty}×</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{line.menu_item.name}</p>
                {line.customizations?.notes && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    “{line.customizations.notes}”
                  </p>
                )}
              </div>
              <span className="text-sm text-foreground">
                {money(line.menu_item.price * line.qty)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Tax</dt>
            <dd>{money(order.tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>

        <Button
          className="mt-8 w-full"
          size="lg"
          disabled={payMutation.isPending || lines.length === 0}
          onClick={() => payMutation.mutate()}
        >
          {payMutation.isPending && <Loader2 className="animate-spin" />}
          Pay {money(order.total)}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Demo checkout — no card is charged.
        </p>
      </div>
    </main>
  );
}
