import { useMemo, useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag, Users, Bell } from "lucide-react";

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
  fetchCart,
  fetchMenu,
  money,
  resolveTable,
  joinSession,
  setLineQty,
  getRecommendations,
  type MenuItem,
  type RecommendedItem,
} from "@/lib/ordering";
import { callWaiter } from "@/lib/waiter";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyProfile, type Profile } from "@/lib/profile";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Sparkles } from "lucide-react";
import { VoiceOrder } from "@/components/VoiceOrder";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
      {item.dietary_tags?.map((tag) => (
        <Badge key={tag} variant="secondary" className="bg-olive/15 text-[10px] uppercase tracking-wide text-foreground">
          {tag}
        </Badge>
      ))}
      {item.allergens && item.allergens.length > 0 && (
        <Badge variant="outline" className="border-primary/40 text-[10px] uppercase tracking-wide text-primary">
          contains {item.allergens.join(", ")}
        </Badge>
      )}
    </div>
  );
}

function getConflicts(item: MenuItem, profile: Profile | undefined | null) {
  if (!profile) return { allergenConflicts: [], dietaryMismatch: null };
  
  const allergenConflicts = (item.allergens || []).filter(a => (profile.allergens || []).includes(a));
  
  let dietaryMismatch: string | null = null;
  if (profile.dietary_tags?.length > 0) {
    const userPref = profile.dietary_tags[0]?.toLowerCase();
    const itemTags = (item.dietary_tags || []).map(t => t.toLowerCase());
    
    if (userPref === "veg") {
      if (!itemTags.includes("vegetarian") && !itemTags.includes("vegan")) {
        dietaryMismatch = "Non-Veg";
      }
    } else if (userPref === "vegan") {
      if (!itemTags.includes("vegan")) {
        dietaryMismatch = "Not Vegan";
      }
    } else if (userPref === "jain") {
      if (!itemTags.includes("vegetarian") && !itemTags.includes("vegan")) {
        dietaryMismatch = "Non-Veg";
      } else if (itemTags.includes("contains-onion-garlic")) {
        dietaryMismatch = "Contains Onion/Garlic";
      }
    }
  }
  return { allergenConflicts, dietaryMismatch };
}

function MenuItemCard({
  item,
  profile,
  onClick,
  isRec = false,
}: {
  item: MenuItem | RecommendedItem;
  profile: Profile | undefined | null;
  onClick: () => void;
  isRec?: boolean;
}) {
  const conflicts = getConflicts(item, profile);
  const hasAllergy = conflicts.allergenConflicts.length > 0;
  
  return (
    <button
      type="button"
      disabled={!item.available}
      onClick={onClick}
      className={`flex ${isRec ? "w-64 shrink-0 flex-col gap-3 snap-start" : "w-full gap-4"} rounded-xl border bg-card p-3 text-left shadow-soft transition-colors hover:bg-accent/40 disabled:opacity-55 ${
        hasAllergy ? "border-l-4 border-l-destructive/70 border-y-border border-r-border" : "border-border"
      }`}
    >
      {!isRec ? (
        <>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{money(item.price)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
            {!item.available && (
              <p className="mt-1 text-xs font-medium text-primary">Sold out tonight</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {conflicts.allergenConflicts.length > 0 && (
                <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                  ⚠ Contains {conflicts.allergenConflicts.join(", ")}
                </Badge>
              )}
              {conflicts.dietaryMismatch && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wide">
                  {conflicts.dietaryMismatch}
                </Badge>
              )}
            </div>
            <TagRow item={item} />
          </div>
          {item.image_url && (
            <div className="relative shrink-0">
              <img src={item.image_url} alt={item.name} loading="lazy" className="size-20 rounded-lg object-cover" />
              {item.badge && (
                <Badge className={`absolute -top-2 -right-2 text-[9px] uppercase tracking-wider ${item.badge === 'new' ? 'bg-green-500' : item.badge === 'chefs_special' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                  {item.badge.replace("_", " ")}
                </Badge>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {item.image_url && (
            <div className="relative">
              <img src={item.image_url} alt={item.name} loading="lazy" className="h-32 w-full rounded-lg object-cover" />
              {item.badge && (
                <Badge className={`absolute top-2 right-2 text-[9px] uppercase tracking-wider ${item.badge === 'new' ? 'bg-green-500' : item.badge === 'chefs_special' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                  {item.badge.replace("_", " ")}
                </Badge>
              )}
            </div>
          )}
          <div className="flex-1 flex flex-col items-start w-full">
            <div className="flex items-baseline justify-between gap-3 w-full">
              <span className="font-medium text-foreground text-left">{item.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{money(item.price)}</span>
            </div>
            <p className="mt-1 text-xs text-primary font-medium text-left">{(item as RecommendedItem)._reason}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {conflicts.allergenConflicts.length > 0 && (
                <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                  ⚠ Contains {conflicts.allergenConflicts.join(", ")}
                </Badge>
              )}
              {conflicts.dietaryMismatch && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wide">
                  {conflicts.dietaryMismatch}
                </Badge>
              )}
            </div>
            <div className="text-left w-full"><TagRow item={item} /></div>
          </div>
        </>
      )}
    </button>
  );
}

function CallWaiterButton({ qrToken }: { qrToken: string }) {
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [callId, setCallId] = useState<string | null>(() => localStorage.getItem(`waiter_call_id_${qrToken}`));

  useEffect(() => {
    const last = localStorage.getItem(`waiter_${qrToken}`);
    if (last) {
      const diff = Date.now() - Number(last);
      if (diff < 120000) {
        setCooldown(Math.ceil((120000 - diff) / 1000));
      } else {
        localStorage.removeItem(`waiter_${qrToken}`);
        localStorage.removeItem(`waiter_call_id_${qrToken}`);
        setCallId(null);
      }
    }
  }, [qrToken]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [cooldown]);

  useEffect(() => {
    if (!callId) return;
    const channel = supabase.channel(`waiter_call_${callId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'waiter_calls', filter: `id=eq.${callId}` }, (payload: any) => {
        if (payload.new.status === 'resolved') {
          setCooldown(0);
          setCallId(null);
          localStorage.removeItem(`waiter_${qrToken}`);
          localStorage.removeItem(`waiter_call_id_${qrToken}`);
          toast.success("Waiter has arrived! 👋");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, qrToken]);

  const handleCall = async (reason: string) => {
    setOpen(false);
    try {
      const res = await callWaiter(qrToken, reason);
      if (res && res.callId) {
        setCallId(res.callId);
        localStorage.setItem(`waiter_call_id_${qrToken}`, res.callId);
      }
      toast.success("A waiter has been notified 👋");
      localStorage.setItem(`waiter_${qrToken}`, Date.now().toString());
      setCooldown(120);
    } catch (e: any) {
      toast.error(e.message || "Failed to call waiter");
      if (e.message?.includes("Already called")) {
        localStorage.setItem(`waiter_${qrToken}`, Date.now().toString());
        setCooldown(120);
      }
    }
  };

  return (
    <>
      <div className="fixed bottom-44 right-4 z-40">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg" 
          disabled={cooldown > 0}
          onClick={() => setOpen(true)}
        >
          {cooldown > 0 ? (
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-bold leading-none">Called</span>
              <span className="text-xs font-bold">{Math.floor(cooldown/60)}:{(cooldown%60).toString().padStart(2, '0')}</span>
            </div>
          ) : (
            <Bell size={24} />
          )}
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Call Waiter</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button variant="outline" onClick={() => handleCall('Need assistance')}>Need assistance</Button>
            <Button variant="outline" onClick={() => handleCall('Request the bill')}>Request the bill</Button>
            <Button variant="outline" onClick={() => handleCall('Other')}>Other</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TableMenuPage() {
  const { qrToken } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getDeviceToken = () => {
    if (typeof window === "undefined") return "";
    let token = localStorage.getItem("tablemind_device_token");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("tablemind_device_token", token);
    }
    return token;
  };
  const deviceToken = useMemo(getDeviceToken, []);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [showOnlySafe, setShowOnlySafe] = useState(false);
  const [allergyWarning, setAllergyWarning] = useState<{ menuItemId: string, qty: number, notes: string, message: string } | null>(null);
  const resolveAllergyRef = useRef<((added: boolean) => void) | null>(null);
  const { user } = useAuth();
  
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user?.id,
  });

  const tableQuery = useQuery({
    queryKey: ["table", qrToken],
    queryFn: () => resolveTable(qrToken),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  const ctx = tableQuery.data ?? null;

  const menuQuery = useQuery({
    queryKey: ["menu", ctx?.restaurantId],
    queryFn: () => fetchMenu(ctx!.restaurantId),
    enabled: !!ctx,
    staleTime: 5 * 60 * 1000,
  });

  const cartQuery = useQuery({
    queryKey: ["cart", qrToken, ctx?.sessionId],
    queryFn: () => fetchCart(qrToken),
    enabled: !!ctx,
  });

  const participantsQuery = useQuery({
    queryKey: ["participants", qrToken, ctx?.sessionId],
    queryFn: async () => {
      if (!ctx?.sessionId) return [];
      const { data, error } = await supabase.from("session_participants" as any).select("*").eq("session_id", ctx.sessionId);
      if (error) throw error;
      return data;
    },
    enabled: !!ctx?.sessionId,
  });

  const sessionQuery = useQuery({
    queryKey: ["session", qrToken, deviceToken, ctx?.sessionId],
    queryFn: () => joinSession(qrToken, deviceToken, profileQuery.data?.name || "Guest"),
    enabled: !!ctx && !!deviceToken,
  });

  useEffect(() => {
    if (!ctx?.sessionId) return;
    const orderId = cartQuery.data?.order?.id;
    if (!orderId) return;

    const channel = supabase
      .channel("group_cart")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          invalidateCart();
          if (payload.eventType === "INSERT") {
            const newItem = payload.new as any;
            if (newItem.added_by_device_token !== deviceToken && newItem.added_by_name) {
              toast(`${newItem.added_by_name} added an item`);
            }
          }
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel("group_participants")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_participants",
          filter: `session_id=eq.${ctx.sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["participants", qrToken, ctx.sessionId] });
        }
      )
      .subscribe();

    const orderChannel = supabase
      .channel("group_order")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          invalidateCart();
          if ((payload.new as any).status === "paid") {
            toast.success("Order has been paid!");
            queryClient.invalidateQueries({ queryKey: ["cart", qrToken] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [ctx?.sessionId, cartQuery.data?.order?.id, deviceToken, queryClient, qrToken]);

  const recQuery = useQuery({
    queryKey: ["recommendations", qrToken],
    queryFn: () => getRecommendations(qrToken),
    enabled: !!ctx && !!user,
  });

  const invalidateCart = () =>
    queryClient.invalidateQueries({ queryKey: ["cart", qrToken, ctx?.sessionId] });

  const addMutation = useMutation({
    mutationFn: (input: { menuItemId: string; qty: number; notes: string; allergyOverrideAck?: boolean }) =>
      addToCart({ qrToken, ...input, deviceToken: deviceToken || "" }),
    onSuccess: async (data, variables) => {
      if (data.requiresAllergyAck) {
        setAllergyWarning({ ...variables, message: data.message || "Allergy warning" });
        return;
      }
      await invalidateCart();
      setSelected(null);
      setAllergyWarning(null);
      setCartOpen(true);
    },
  });

  const qtyMutation = useMutation({
    mutationFn: (input: { lineId: string; qty: number }) =>
      setLineQty(qrToken, input.lineId, input.qty),
    onSuccess: invalidateCart,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuQuery.data ?? []) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    // Sort items within categories: featured first, then sort_order
    for (const [_, items] of map.entries()) {
      items.sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
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

  if (tableQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">We couldn't load this table</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong reaching the kitchen system. Please try again.
          </p>
          <Button className="mt-5" onClick={() => tableQuery.refetch()}>
            Try again
          </Button>
        </div>
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

  if (!ctx.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning/10">
            <AlertCircle className="size-6 text-warning" />
          </div>
          <h1 className="font-display text-2xl text-foreground">{ctx.restaurantName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This restaurant is temporarily unavailable.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      {ctx.restaurantBanner && (
        <div className="w-full h-32 md:h-48 bg-gray-200">
          <img src={ctx.restaurantBanner} className="w-full h-full object-cover" alt="Restaurant Banner" />
        </div>
      )}
      <header className={`border-b border-border bg-card px-5 ${ctx.restaurantBanner ? 'py-4' : 'py-5'}`}>
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-3">
            {ctx.restaurantLogo ? (
              <img src={ctx.restaurantLogo} alt="Logo" className="size-10 rounded-full object-cover border border-border shadow-sm" />
            ) : (
              <div className="grid size-10 place-items-center rounded-xl bg-primary shadow-inner">
                <span className="font-display font-bold text-primary-foreground">
                  {ctx.restaurantName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                {ctx.restaurantName}
              </h1>
              {ctx.restaurantTagline ? (
                <p className="text-[11px] font-medium text-muted-foreground">
                  {ctx.restaurantTagline}
                </p>
              ) : (
                <p className="text-[11px] font-medium text-muted-foreground">
                  {ctx.tableLabel} · ID: {ctx.sessionId.split("-")[0]}
                </p>
              )}
            </div>
          </div>
          {participantsQuery.data && participantsQuery.data.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">
              <Users className="size-4" />
              <span>{participantsQuery.data.length} people</span>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5">
        {user && (
          <div className="flex items-center justify-between py-4 border-b border-border">
            <Label htmlFor="safe-toggle" className="text-sm font-medium text-muted-foreground cursor-pointer">
              Show only items I can eat
            </Label>
            <Switch
              id="safe-toggle"
              checked={showOnlySafe}
              onCheckedChange={setShowOnlySafe}
            />
          </div>
        )}

        <VoiceOrder
          qrToken={qrToken}
          onAddToCart={async (item) => {
            const data = await addMutation.mutateAsync({
              menuItemId: item.menuItemId,
              qty: item.qty,
              notes: item.notes,
            });
            if (data?.requiresAllergyAck) {
              await new Promise<boolean>((resolve) => {
                resolveAllergyRef.current = resolve;
              });
            }
          }}
        />
        
        {menuQuery.isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}

        {user && recQuery.data && recQuery.data.length > 0 && (
          <section className="pt-8">
            <h2 className="font-display text-lg text-foreground flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Recommended for you
            </h2>
            <div className="mt-3 flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
              {recQuery.data.filter(item => {
                if (!showOnlySafe) return true;
                const c = getConflicts(item, profileQuery.data);
                return c.allergenConflicts.length === 0 && !c.dietaryMismatch;
              }).map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  profile={profileQuery.data}
                  isRec
                  onClick={() => {
                    setSelected(item);
                    setQty(1);
                    setNotes("");
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {grouped.map(([category, items]) => (
          <section key={category} className="pt-8">
            <h2 className="font-display text-lg text-foreground">{category}</h2>
            <ul className="mt-3 space-y-3">
              {items.filter(item => {
                if (!showOnlySafe) return true;
                const c = getConflicts(item, profileQuery.data);
                return c.allergenConflicts.length === 0 && !c.dietaryMismatch;
              }).map((item) => (
                <li key={item.id}>
                  <MenuItemCard
                    item={item}
                    profile={profileQuery.data}
                    onClick={() => {
                      setSelected(item);
                      setQty(1);
                      setNotes("");
                    }}
                  />
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
      
      <CallWaiterButton qrToken={qrToken} />

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
                  <span className="w-8 text-center text-sm font-medium bg-secondary text-secondary-foreground rounded py-1">{qty}</span>
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

      <Dialog open={!!allergyWarning} onOpenChange={(open) => {
        if (!open) {
          setAllergyWarning(null);
          if (resolveAllergyRef.current) {
            resolveAllergyRef.current(false);
            resolveAllergyRef.current = null;
          }
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <DialogTitle className="text-center font-display text-xl text-foreground">
              Allergy Warning
            </DialogTitle>
            <DialogDescription className="text-center">
              {allergyWarning?.message.replace("ALLERGY_WARNING:", "This dish contains")}
              <br />
              <br />
              You've flagged this as an allergen. Are you sure you want to add it anyway?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setAllergyWarning(null);
                if (resolveAllergyRef.current) {
                  resolveAllergyRef.current(false);
                  resolveAllergyRef.current = null;
                }
              }}
            >
              Remove from cart
            </Button>
            <Button
              className="flex-1"
              disabled={addMutation.isPending}
              onClick={async () => {
                if (allergyWarning) {
                  await addMutation.mutateAsync({
                    ...allergyWarning,
                    allergyOverrideAck: true,
                  });
                  if (resolveAllergyRef.current) {
                    resolveAllergyRef.current(true);
                    resolveAllergyRef.current = null;
                  }
                }
              }}
            >
              {addMutation.isPending && <Loader2 className="mr-2 animate-spin size-4" />}
              Add anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Your order</SheetTitle>
            {participantsQuery.data && participantsQuery.data.length > 1 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex -space-x-2">
                  {participantsQuery.data.map((p: any) => (
                    <div key={p.device_token} className="size-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary">
                      {p.name?.slice(0, 2).toUpperCase() || "?"}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{participantsQuery.data.length} people</span>
              </div>
            )}
          </SheetHeader>
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2">
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing added yet.</p>
            )}
            
            {participantsQuery.data && participantsQuery.data.length > 1 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Items</h3>
                  {lines.filter(l => l.added_by_device_token === deviceToken).length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">You haven't added anything.</p>
                  ) : (
                    <div className="space-y-4">
                      {lines.filter(l => l.added_by_device_token === deviceToken).map((line) => (
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
                                  qtyMutation.mutate({ lineId: line.id, qty: line.qty - 1 })
                                }
                              >
                                <Minus className="size-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium bg-secondary text-secondary-foreground rounded py-1">{line.qty}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-7"
                                disabled={qtyMutation.isPending}
                                onClick={() =>
                                  qtyMutation.mutate({ lineId: line.id, qty: line.qty + 1 })
                                }
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="shrink-0 font-medium text-foreground text-right">
                            {money(line.menu_item.price * line.qty)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Group Orders</h3>
                  {lines.filter(l => l.added_by_device_token !== deviceToken).length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">No one else has ordered yet.</p>
                  ) : (
                    <div className="space-y-4 rounded-xl bg-accent/30 p-3">
                      {Array.from(new Set(lines.filter(l => l.added_by_device_token !== deviceToken).map(l => l.added_by_name))).map(name => {
                        const personLines = lines.filter(l => l.added_by_device_token !== deviceToken && l.added_by_name === name);
                        const personTotal = personLines.reduce((sum, l) => sum + l.menu_item.price * l.qty, 0);
                        return (
                          <div key={name} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-baseline mb-2">
                              <p className="font-semibold text-sm text-foreground">{name || "Guest"}</p>
                              <p className="text-sm font-medium">{money(personTotal)}</p>
                            </div>
                            <ul className="space-y-1">
                              {personLines.map(l => (
                                <li key={l.id} className="flex justify-between text-xs text-muted-foreground">
                                  <span>{l.menu_item.name} x{l.qty}</span>
                                  <span>{money(l.menu_item.price * l.qty)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              lines.map((line) => (
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
                          qtyMutation.mutate({ lineId: line.id, qty: line.qty - 1 })
                        }
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium bg-secondary text-secondary-foreground rounded py-1">{line.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={qtyMutation.isPending}
                        onClick={() =>
                          qtyMutation.mutate({ lineId: line.id, qty: line.qty + 1 })
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="shrink-0 font-medium text-foreground text-right">
                    {money(line.menu_item.price * line.qty)}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border bg-card pb-6 pt-4">
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
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
