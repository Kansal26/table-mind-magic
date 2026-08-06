import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchLiveOrdersFn, updateKitchenStatusFn, fetchAnalyticsFn, getKitchenLoadFn, forceCloseSessionFn } from "@/lib/admin.functions";
import { fetchAdminWaiterCalls, acknowledgeWaiterCall, resolveWaiterCall } from "@/lib/waiter";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle, LogOut, Bell, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { restaurant, session } = Route.useRouteContext();
  const token = session.access_token;
  const [showCompleted, setShowCompleted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio beep failed", e);
    }
  };

  // Queries
  const loadQuery = useQuery({
    queryKey: ["admin-kitchen-load", restaurant.id],
    queryFn: () => getKitchenLoadFn({ data: { token, restaurantId: restaurant.id } }),
    refetchInterval: 30000,
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-live-orders", restaurant.id],
    queryFn: () => fetchLiveOrdersFn({ data: { token, restaurantId: restaurant.id } }),
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics", restaurant.id],
    queryFn: () => fetchAnalyticsFn({ data: { token, restaurantId: restaurant.id } }),
  });

  const waiterCallsQuery = useQuery({
    queryKey: ["admin-waiter-calls", restaurant.id],
    queryFn: () => fetchAdminWaiterCalls(token, restaurant.id),
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

    const waiterChannel = supabase
      .channel("waiter-calls-alert")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurant.id}` }, async (payload) => {
        playBeep();
        
        // Fetch table name for the banner
        const { data: tableData } = await supabase.from("tables").select("label").eq("id", payload.new.table_id).single();
        
        setIncomingCall({
          id: payload.new.id,
          reason: payload.new.reason,
          table_label: tableData?.label || "Unknown Table",
          created_at: payload.new.created_at
        });
        
        queryClient.invalidateQueries({ queryKey: ["admin-waiter-calls", restaurant.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(waiterChannel);
    };
  }, [queryClient, restaurant.id]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (opts: { orderId: string, status: any }) => updateKitchenStatusFn({ data: { ...opts, token } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-live-orders", restaurant.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-kitchen-load", restaurant.id] });
    }
  });

  const clearTableMutation = useMutation({
    mutationFn: (sessionId: string) => forceCloseSessionFn({ data: { token, sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-live-orders", restaurant.id] });
    }
  });

  const ackCallMutation = useMutation({
    mutationFn: (callId: string) => acknowledgeWaiterCall(token, restaurant.id, callId),
    onSuccess: () => {
      setIncomingCall(null);
      queryClient.invalidateQueries({ queryKey: ["admin-waiter-calls", restaurant.id] });
    }
  });

  const resolveCallMutation = useMutation({
    mutationFn: (callId: string) => resolveWaiterCall(token, restaurant.id, callId),
    onSuccess: () => {
      setIncomingCall(null);
      queryClient.invalidateQueries({ queryKey: ["admin-waiter-calls", restaurant.id] });
    }
  });

  const liveOrders = ordersQuery.data?.filter((o: any) => o.kitchen_status !== "served") || [];
  const completedOrders = ordersQuery.data?.filter((o: any) => o.kitchen_status === "served") || [];

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

      {incomingCall && (
        <div className="mb-8 p-4 bg-red-100 border border-red-300 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="text-red-600 animate-bounce" size={24} />
            <div>
              <h2 className="text-red-900 font-bold text-lg">🔔 {incomingCall.table_label} is calling for assistance!</h2>
              <p className="text-red-800 text-sm">Reason: {incomingCall.reason} • {new Date(incomingCall.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-200" onClick={() => ackCallMutation.mutate(incomingCall.id)}>
              Acknowledge
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => resolveCallMutation.mutate(incomingCall.id)}>
              Resolve
            </Button>
          </div>
        </div>
      )}

      {waiterCallsQuery.data && waiterCallsQuery.data.length > 0 && (
        <div className="mb-8 bg-card border border-border rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bell size={20} className="text-primary" /> Active Waiter Calls
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Table</th>
                  <th className="pb-3 font-medium">Reason</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {waiterCallsQuery.data.map((call: any) => (
                  <tr key={call.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{call.table_label}</td>
                    <td className="py-3 capitalize">{call.reason}</td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {Math.floor((Date.now() - new Date(call.created_at).getTime()) / 60000)} mins ago
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        call.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-2">
                      {call.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => ackCallMutation.mutate(call.id)}>
                          Ack
                        </Button>
                      )}
                      <Button size="sm" onClick={() => resolveCallMutation.mutate(call.id)}>
                        <CheckCircle2 size={16} className="mr-1" /> Resolve
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold">Live Orders</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveOrders.map((order: any) => (
              <div key={order.id} className="bg-card border border-border rounded-xl shadow-sm p-4 flex flex-col">
                <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-lg">{(order.sessions as any)?.tables?.label || "Unknown Table"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)} mins ago
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Are you sure you want to clear ${(order.sessions as any)?.tables?.label || "this table"}? This will close their session.`)) {
                          clearTableMutation.mutate(order.session_id);
                        }
                      }}
                      disabled={clearTableMutation.isPending}
                    >
                      <LogOut className="size-3 mr-1" /> Clear Table
                    </Button>
                  </div>
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
                {completedOrders.map((order: any) => (
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
