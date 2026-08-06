import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, LogOut, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ALLERGENS, DIETARY_TAGS, fetchMyProfile, saveMyProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your dietary profile — TableMind" },
      {
        name: "description",
        content: "Save your dietary preferences and allergens so every menu fits you.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your dietary profile — TableMind" },
      {
        property: "og:description",
        content: "Save your dietary preferences and allergens so every menu fits you.",
      },
    ],
  }),
  component: ProfilePage,
});

function Chip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm capitalize transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && <Check className="mr-1 inline size-3.5" />}
      {label}
    </button>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchMyProfile(userId),
    enabled: !!userId,
  });

  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [showGoToMenu, setShowGoToMenu] = useState(false);

  const walletQuery = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const { getWalletBalanceFn } = await import("@/lib/wallet.functions");
      return getWalletBalanceFn({ data: { userId } });
    },
    enabled: !!userId,
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    
    if (!profile.name && user?.user_metadata) {
      setName(user.user_metadata.full_name || user.user_metadata.name || "");
    } else {
      setName(profile.name ?? "");
    }
    
    setTags(profile.dietary_tags ?? []);
    setAllergens(profile.allergens ?? []);
  }, [profileQuery.data, user?.user_metadata]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const saveMutation = useMutation({
    mutationFn: () =>
      saveMyProfile({
        userId,
        name,
        dietary_tags: tags,
        allergens,
      }),
    onSuccess: async () => {
      setSaved(true);
      setShowGoToMenu(false);
      setTimeout(() => setShowGoToMenu(true), 1500);
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth/login", search: { redirect: "", table: "", order: "" }, replace: true });
  }

  if (profileQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const userNameDisplay = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "?";
  const initials = userNameDisplay.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-background px-5 pb-16">
      <div className="mx-auto max-w-lg">
        <header className="flex items-start justify-between pt-8">
          <div className="flex items-center gap-4">
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="size-12 rounded-full object-cover"
              />
            ) : (
              <div className="grid size-12 place-items-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
                {initials}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl text-foreground">Your profile</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.email ?? "Signed in"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </header>

        {walletQuery.data !== undefined && (
          <section className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">Wallet Balance</h2>
              <p className="text-2xl font-display text-primary mt-1">₹{walletQuery.data.balance}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Check className="size-5" />
            </div>
          </section>
        )}

        <section className="mt-8 space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
              setShowGoToMenu(false);
            }}
            placeholder="What should the kitchen call you?"
          />
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl text-foreground">Dietary preference</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {DIETARY_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                active={tags.includes(tag)}
                onToggle={() => {
                  setTags((current) => toggle(current, tag));
                  setSaved(false);
                  setShowGoToMenu(false);
                }}
              />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl text-foreground">Allergens to avoid</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALLERGENS.map((allergen) => (
              <Chip
                key={allergen}
                label={allergen}
                active={allergens.includes(allergen)}
                onToggle={() => {
                  setAllergens((current) => toggle(current, allergen));
                  setSaved(false);
                  setShowGoToMenu(false);
                }}
              />
            ))}
          </div>
        </section>

        {saveMutation.isError && (
          <p className="mt-6 text-sm text-destructive">
            We couldn't save that. Please try again.
          </p>
        )}

        {showGoToMenu ? (
          <Button
            className="mt-10 w-full gap-2"
            size="lg"
            onClick={() => navigate({ to: "/table/$qrToken", params: { qrToken: "demo-table-12" } })}
          >
            Go to Menu <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            className="mt-10 w-full"
            size="lg"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2 className="animate-spin" />}
            {saved ? "Saved ✓" : "Save profile"}
          </Button>
        )}
      </div>
    </main>
  );
}