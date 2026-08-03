import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  addToCart,
  fetchCartOrder,
  fetchMenu,
  fetchOrderLines,
  money,
  resolveTable,
  setLineQty,
  type MenuItem,
} from "@/lib/ordering";

export const Route = createFileRoute("/table/$qrToken")({
  head: () => ({
    meta: [
      { title: "Order at your table — TableMind" },
      { name: "description", content: "Browse the menu and order straight from your table." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Order at your table — TableMind" },
      { property: "og:description", content: "Browse the menu and order straight from your table." },
    ],
  }),
  component: TableMenuPage,
});

function TagRow({ item }: { item: MenuItem }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {item.dietary_tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="bg-olive/15 text-[10px] uppercase tracking-wide text-foreground">
          {tag}
        </Badge>
      ))}
      {item.allergens.length > 0 && (
        <Badge variant="outline" className="border-primary/40 text-[10px] uppercase tracking-wide text-primary">
          contains {item.allergens.join(", ")}
        </Badge>
      )}
    </div>
  );
}

function TableMenuPage() {
  const { qrToken } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const tableQuery = useQuery({
    queryKey: ["table", qrToken],
    queryFn: () => resolveTable(qrToken),
    staleTime: 5 * 60 * 1000,
  });
  const ctx = tableQuery.data ?? null;

  const menuQuery = useQuery({
    queryKey: ["menu", ctx?.restaurantId],
    queryFn: () => fetchMenu(ctx!.restaurantId),
    enabled: !!ctx,
    staleTime: 5 * 60 * 1000,
  });

  const cartQuery = useQuery({
    queryKey: ["cart", ctx?.sessionId],
    queryFn: async () => {
      const order = await fetchCartOrder(ctx!.sessionId);
      if (!order) return { order: null, lines: [] };
      return { order, lines: await fetchOrderLines(order.id) };
    },
    enabled: !!ctx,
  });

  const invalidateCart = () =>
    queryClient.invalidateQueries({ queryKey: ["cart", ctx?.sessionId] });

  const addMutation = useMutation({
    mutationFn: (input: { menuItemId: string; qty: number; notes: string }) =>
      addToCart({ sessionId: ctx!.sessionId, ...input }),
    onSuccess: async () => {
      await invalidateCart();
      setSelected(null);
      setCartOpen(true);
    },
  });

  const qtyMutation = useMutation({
    mutationFn: (input: { orderId: string; lineId: string; qty: number }) =>
      setLineQty(input.orderId, input.lineId, input.qty),
    onSuccess: invalidateCart,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuQuery.data ?? []) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [menuQuery.data]);

  const lines = cartQuery.data?.lines ?? [];
  const order = cartQuery.data?.order ?? null;
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  if (tableQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!ctx) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">This code isn't active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask a member of staff for an up-to-date table code.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="border-b border-border bg-card px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{ctx.tableLabel}</p>
        <h1 className="mt-1 font-display text-2xl leading-tight text-foreground">
          {ctx.restaurantName}
        </h1>
        {ctx.restaurantAddress && (
          <p className="mt-1 text-xs text-muted-foreground">{ctx.restaurantAddress}</p>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-5">
        {menuQuery.isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}

        {grouped.map(([category, items]) => (
          <section key={category} className="pt-8">
            <h2 className="font-display text-lg text-foreground">{category}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!item.available}
                    onClick={() => {
                      setSelected(item);
                      setQty(1);
                      setNotes("");
                    }}
                    className="flex w-full gap-4 rounded-xl border border-border bg-card p-3 text-left shadow-soft transition-colors hover:bg-accent/40 disabled:opacity-55"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {money(item.price)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      {!item.available && (
                        <p className="mt-1 text-xs font-medium text-primary">Sold out tonight</p>
                      )}
                      <TagRow item={item} />
                    </div>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="size-20 shrink-0 rounded-lg object-cover"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
          <Button className="mx-auto flex w-full max-w-2xl" onClick={() => setCartOpen(true)}>
            <ShoppingBag />
            View order · {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
            {money(lines.reduce((s, l) => s + l.menu_item.price * l.qty, 0))}
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              {selected.image_url && (
                <img
                  src={selected.image_url}
                  alt={selected.name}
                  className="h-40 w-full rounded-lg object-cover"
                />
              )}
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{selected.name}</DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
              <TagRow item={selected} />
              <div>
                <label
                  htmlFor="special-instructions"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Special instructions
                </label>
                <Textarea
                  id="special-instructions"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="No onions, sauce on the side…"
                  className="mt-2"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 rounded-md border border-input p-1">
                  <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <Minus />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{qty}</span>
                  <Button variant="ghost" size="icon" onClick={() => setQty((q) => q + 1)}>
                    <Plus />
                  </Button>
                </div>
                <Button
                  className="flex-1"
                  disabled={addMutation.isPending}
                  onClick={() =>
                    addMutation.mutate({ menuItemId: selected.id, qty, notes })
                  }
                >
                  {addMutation.isPending && <Loader2 className="animate-spin" />}
                  Add · {money(selected.price * qty)}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Your order</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing added yet.</p>
            )}
            {lines.map((line) => (
              <div key={line.id} className="flex gap-3 border-b border-border pb-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{line.menu_item.name}</p>
                  {line.customizations?.notes && (
                    <p className="mt-0.5 text-xs italic text-muted-foreground">
                      “{line.customizations.notes}”
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      disabled={qtyMutation.isPending}
                      onClick={() =>
                        qtyMutation.mutate({
                          orderId: order!.id,
                          lineId: line.id,
                          qty: line.qty - 1,
                        })
                      }
                    >
                      <Minus />
                    </Button>
                    <span className="w-5 text-center text-sm">{line.qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      disabled={qtyMutation.isPending}
                      onClick={() =>
                        qtyMutation.mutate({
                          orderId: order!.id,
                          lineId: line.id,
                          qty: line.qty + 1,
                        })
                      }
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {money(line.menu_item.price * line.qty)}
                </span>
              </div>
            ))}
          </div>
          {lines.length > 0 && order && (
            <Button
              className="mt-4 w-full"
              onClick={() =>
                navigate({
                  to: "/checkout",
                  search: { order: order.id, session: ctx.sessionId, table: qrToken },
                })
              }
            >
              Go to checkout
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
