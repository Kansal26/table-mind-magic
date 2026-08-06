import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchLiveOrdersFn, updateKitchenStatusFn, fetchAnalyticsFn, getKitchenLoadFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { restaurant } = Route.useRouteContext();
  const [showCompleted, setShowCompleted] = useState(false);

  // Queries
  const loadQuery = useQuery({
    queryKey: ["admin-kitchen-load", restaurant.id],
    queryFn: () => getKitchenLoadFn({ data: { restaurantId: restaurant.id } }),
    refetchInterval: 30000,
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-live-orders", restaurant.id],
    queryFn: () => fetchLiveOrdersFn({ data: { restaurantId: restaurant.id } }),
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics", restaurant.id],
    queryFn: () => fetchAnalyticsFn({ data: { restaurantId: restaurant.id } }),
  });

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel("live-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-live-orders", restaurant.id] });
        queryClient.invalidateQueries({ queryKey: ["admin-kitchen-load", restaurant.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (opts: { orderId: string, status: any }) => updateKitchenStatusFn({ data: opts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-live-orders", restaurant.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-kitchen-load", restaurant.id] });
    }
  });

  const liveOrders = ordersQuery.data?.filter(o => o.kitchen_status !== "served") || [];
  const completedOrders = ordersQuery.data?.filter(o => o.kitchen_status === "served") || [];

  const loadData = loadQuery.data || { level: "low", count: 0 };
  const loadColors = {
    low: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    high: "bg-red-100 text-red-800 border-red-200"
  };
  const loadLabels = {
    low: "Kitchen is clear",
    medium: "Moderate load",
    high: "Kitchen is busy"
  };

  const analytics = analyticsQuery.data;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Kitchen Dashboard</h1>
        
        <div className={`px-4 py-2 rounded-full border font-semibold flex items-center gap-2 ${loadColors[loadData.level]}`}>
          <div className={`w-3 h-3 rounded-full ${
            loadData.level === 'low' ? 'bg-green-500' : 
            loadData.level === 'medium' ? 'bg-amber-500' : 'bg-red-500'
          }`} />
          {loadLabels[loadData.level]} ({loadData.count} active)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold">Live Orders</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveOrders.map(order => (
              <div key={order.id} className="bg-card border border-border rounded-xl shadow-sm p-4 flex flex-col">
                <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-lg">{(order.sessions as any)?.tables?.label || "Unknown Table"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)} mins ago
                    </p>
                  </div>
                  <select 
                    className="p-1 rounded border text-sm font-medium bg-background"
                    value={order.kitchen_status || "received"}
                    onChange={(e) => updateStatusMutation.mutate({ orderId: order.id, status: e.target.value })}
                  >
                    <option value="received">Received</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="served">Served</option>
                  </select>
                </div>
                
                <div className="flex-1 space-y-2 mb-4">
                  {(order.order_items || []).map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start text-sm">
                      <div>
                        <span className="font-medium mr-2">{item.qty}x</span>
                        {item.menu_items?.name}
                        {item.allergy_override_ack && (
                          <span className="flex items-center gap-1 text-xs font-bold text-destructive mt-1 bg-destructive/10 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={12} /> ⚠ Allergen override
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {liveOrders.length === 0 && (
              <div className="col-span-full p-8 text-center bg-muted/30 rounded-xl border border-dashed border-border text-muted-foreground">
                No active orders at the moment.
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-border pt-4">
            <button 
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {showCompleted ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              Completed today ({completedOrders.length})
            </button>
            
            {showCompleted && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 opacity-75">
                {completedOrders.map(order => (
                  <div key={order.id} className="bg-muted border border-border rounded-xl p-4 flex flex-col">
                    <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
                      <div>
                        <h3 className="font-bold">{(order.sessions as any)?.tables?.label || "Unknown Table"}</h3>
                      </div>
                      <span className="text-xs font-bold uppercase text-muted-foreground">Served</span>
                    </div>
                    <div className="space-y-1">
                      {(order.order_items || []).map((item: any) => (
                        <div key={item.id} className="text-sm">
                          <span className="text-muted-foreground mr-2">{item.qty}x</span>
                          {item.menu_items?.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-xl font-semibold">Analytics</h2>
          
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-muted-foreground mb-4">Recommendation Engine</h3>
            {analytics && (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-bold text-sm">AI (LLM)</div>
                    <div className="text-xs text-muted-foreground">{analytics.recommendations.llm.shown} shown</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{analytics.recommendations.llm.added}</div>
                    <div className="text-xs text-muted-foreground">
                      {analytics.recommendations.llm.shown > 0 ? 
                        Math.round((analytics.recommendations.llm.added / analytics.recommendations.llm.shown) * 100) : 0}% CV
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-bold text-sm">Rules (Fallback)</div>
                    <div className="text-xs text-muted-foreground">{analytics.recommendations.rule.shown} shown</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{analytics.recommendations.rule.added}</div>
                    <div className="text-xs text-muted-foreground">
                      {analytics.recommendations.rule.shown > 0 ? 
                        Math.round((analytics.recommendations.rule.added / analytics.recommendations.rule.shown) * 100) : 0}% CV
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-muted-foreground mb-4">Dish Feedback (Phase 5)</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {analytics?.feedbackList.map(fb => (
                <div key={fb.name} className={`flex justify-between items-center p-2 rounded-lg text-sm ${fb.avg < 3.5 ? 'bg-amber-50 text-amber-900' : ''}`}>
                  <div className="truncate pr-4 font-medium">{fb.name}</div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 font-bold">
                      <span className="text-amber-500">★</span> {fb.avg}
                    </div>
                    <div className="text-xs opacity-70 w-12 text-right">({fb.count})</div>
                  </div>
                </div>
              ))}
              {(!analytics?.feedbackList || analytics.feedbackList.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-4">No feedback yet.</div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-muted-foreground mb-4">Coupon Usage (Phase 4)</h3>
            <div className="space-y-2">
              {analytics?.couponList.map(c => (
                <div key={c.code} className="flex justify-between items-center p-2 border-b border-border last:border-0 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">Code: {c.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{c.redeemed}x</div>
                    <div className="text-xs text-green-600 font-medium">
                      ₹{c.total_discount.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
              {(!analytics?.couponList || analytics.couponList.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-4">No coupons redeemed.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
