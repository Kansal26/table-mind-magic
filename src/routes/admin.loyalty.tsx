import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getLoyaltySettingsFn, updateLoyaltySettingsFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/admin/loyalty")({
  component: AdminLoyaltyPage,
});

function AdminLoyaltyPage() {
  const queryClient = useQueryClient();
  const { restaurant, session } = Route.useRouteContext();
  const token = session.access_token;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "loyalty", restaurant.id],
    queryFn: () => getLoyaltySettingsFn({ data: { token, restaurantId: restaurant.id } }),
  });

  const [form, setForm] = useState({
    enabled: false,
    points_for_rating: 10,
    points_for_comment: 20,
    points_for_question: 5,
    points_per_rupee: 0.5,
    min_order_value_to_redeem: 200,
    max_points_redeemable_per_order: 100,
    points_expiry_days: 90 as number | null
  });

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setForm({
        enabled: s.enabled ?? false,
        points_for_rating: s.points_for_rating ?? 10,
        points_for_comment: s.points_for_comment ?? 20,
        points_for_question: s.points_for_question ?? 5,
        points_per_rupee: s.points_per_rupee ?? 0.5,
        min_order_value_to_redeem: s.min_order_value_to_redeem ?? 200,
        max_points_redeemable_per_order: s.max_points_redeemable_per_order ?? 100,
        points_expiry_days: s.points_expiry_days ?? 90
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (updates: typeof form) => 
      updateLoyaltySettingsFn({ 
        data: { 
          token, 
          restaurantId: restaurant.id, 
          ...updates 
        } 
      }),
    onSuccess: () => {
      toast.success("Loyalty settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "loyalty", restaurant.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update settings");
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const isSaving = updateMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-foreground">Loyalty Program</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure how your customers earn and redeem points.
          </p>
        </div>
      </div>

      <div className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <Label className="text-base font-semibold text-foreground">Enable Loyalty Program</Label>
            <p className="text-sm text-muted-foreground mt-1">
              If disabled, no points will be awarded or redeemable by customers.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
          />
        </div>

        <div className={`space-y-6 transition-opacity duration-300 ${form.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground border-b pb-2">Earning Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points for submitting rating (1-5)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.points_for_rating}
                  onChange={(e) => setForm({ ...form, points_for_rating: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Points for text review</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.points_for_comment}
                  onChange={(e) => setForm({ ...form, points_for_comment: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Points per answered question</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.points_for_question}
                  onChange={(e) => setForm({ ...form, points_for_question: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground border-b pb-2">Redemption Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points Value (₹ per point)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.points_per_rupee}
                  onChange={(e) => setForm({ ...form, points_per_rupee: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">E.g., 0.5 means 10 points = ₹5 off</p>
              </div>
              <div className="space-y-2">
                <Label>Minimum Order Subtotal (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_order_value_to_redeem}
                  onChange={(e) => setForm({ ...form, min_order_value_to_redeem: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Points Redeemable Per Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_points_redeemable_per_order}
                  onChange={(e) => setForm({ ...form, max_points_redeemable_per_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground border-b pb-2">Expiry</h3>
            <div className="space-y-2 max-w-sm">
              <Label>Points Expiry (Days)</Label>
              <Input
                type="number"
                min="0"
                value={form.points_expiry_days || ""}
                onChange={(e) => setForm({ ...form, points_expiry_days: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Leave blank for never"
              />
              <p className="text-xs text-muted-foreground">Leave blank if points never expire.</p>
            </div>
          </div>
        </div>
        
        <div className="pt-6">
          <Button 
            className="w-full sm:w-auto" 
            size="lg"
            disabled={isSaving}
            onClick={() => updateMutation.mutate(form)}
          >
            {isSaving ? <Loader2 className="mr-2 animate-spin size-4" /> : <Save className="mr-2 size-4" />}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
