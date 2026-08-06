import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, Loader2, Sparkles, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchBill, money, payOrder, type CartLine } from "@/lib/ordering";
import { fetchEligibleCoupons, applyCoupon } from "@/lib/coupons";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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

  const couponsQuery = useQuery({
    queryKey: ["coupons", qrToken, orderId],
    queryFn: () => fetchEligibleCoupons(qrToken),
    enabled: !!orderId && !!qrToken,
  });

  const applyCouponMutation = useMutation({
    mutationFn: (couponId: string | null) => applyCoupon(qrToken, couponId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["checkout", qrToken, orderId] });
      await queryClient.invalidateQueries({ queryKey: ["coupons", qrToken, orderId] });
    },
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { getWalletBalanceFn } = await import("@/lib/wallet.functions");
      return getWalletBalanceFn({ data: { userId: user!.id } });
    },
    enabled: !!user,
  });

  const toggleCreditsMutation = useMutation({
    mutationFn: async (useCredits: boolean) => {
      const { toggleCreditsFn } = await import("@/lib/wallet.functions");
      return toggleCreditsFn({ data: { qrToken, orderId, useCredits } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["checkout", qrToken, orderId] });
    },
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
      if (user) {
        navigate({ to: "/feedback/$orderId", params: { orderId }, search: { table: qrToken, session: sessionId } });
      }
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
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-primary">
              <dt>Discount</dt>
              <dd>-{money(order.discount_amount)}</dd>
            </div>
          )}
          {order.credits_applied > 0 && (
            <div className="flex justify-between text-primary">
              <dt>Wallet Credits</dt>
              <dd>-{money(order.credits_applied)}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <dt>Tax</dt>
            <dd>{money(order.tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>

        {/* Coupons Section */}
        {couponsQuery.data && couponsQuery.data.coupons.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag className="size-4" /> Available Offers
            </div>
            {applyCouponMutation.isPending && (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
            {!applyCouponMutation.isPending && (
              <RadioGroup
                value={couponsQuery.data.applied || "none"}
                onValueChange={(val) => applyCouponMutation.mutate(val === "none" ? null : val)}
              >
                <div className="flex items-center space-x-2 py-2">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="cursor-pointer">No offer applied</Label>
                </div>
                {couponsQuery.data.coupons.map((c) => (
                  <div key={c.id} className="flex items-center space-x-2 py-2">
                    <RadioGroupItem value={c.id} id={c.id} />
                    <Label htmlFor={c.id} className="cursor-pointer flex-1 flex justify-between">
                      <span>{c.name} <span className="text-muted-foreground font-normal">(-{money(c.calculated_discount)})</span></span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        {/* Credits Section */}
        {user && walletQuery.data && walletQuery.data.balance > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Wallet Credits</Label>
                <p className="text-sm text-muted-foreground">Balance: {money(walletQuery.data.balance)}</p>
              </div>
              <div className="flex items-center gap-2">
                {toggleCreditsMutation.isPending ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={order.use_credits || false}
                      onChange={(e) => toggleCreditsMutation.mutate(e.target.checked)}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

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
