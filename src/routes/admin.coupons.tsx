import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAdminCoupons, toggleCoupon, createCoupon } from "@/lib/coupons";
import type { CouponRule } from "@/lib/coupons.server";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/coupons")({
  component: AdminCouponsPage,
});

function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const { restaurant, session } = Route.useRouteContext();
  const token = session.access_token;
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<CouponRule["type"]>("first_order");
  const [pct, setPct] = useState(10);
  const [amount, setAmount] = useState(500);
  const [itemId, setItemId] = useState("");
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("18:00");

  const query = useQuery({
    queryKey: ["admin-coupons", restaurant.id],
    queryFn: () => fetchAdminCoupons(token, restaurant.id),
  });

  const toggleMutation = useMutation({
    mutationFn: (opts: { id: string; active: boolean }) => toggleCoupon(token, opts.id, opts.active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-coupons", restaurant.id] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let rule: CouponRule;
      if (type === "first_order") rule = { type, discount_pct: pct };
      else if (type === "min_spend") rule = { type, amount, discount_pct: pct };
      else if (type === "item_specific") rule = { type, item_id: itemId, discount_pct: pct };
      else rule = { type, start, end, discount_pct: pct };

      await createCoupon(token, { restaurantId: restaurant.id, name, description: desc, rule_json: rule });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons", restaurant.id] });
      setShowForm(false);
      setName("");
      setDesc("");
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Create Coupon"}</Button>
      </div>

      {showForm && (
        <div className="mb-8 p-6 bg-card border border-border rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-4">New Coupon</h2>
          <div className="grid gap-4 max-w-sm">
            <div>
              <Label>Code / Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div>
              <Label>Discount %</Label>
              <Input type="number" value={pct} onChange={e => setPct(Number(e.target.value))} />
            </div>
            <div>
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={e => setType(e.target.value as any)}>
                <option value="first_order">First Order</option>
                <option value="min_spend">Minimum Spend</option>
                <option value="item_specific">Item Specific</option>
                <option value="time_window">Time Window</option>
              </select>
            </div>
            {type === "min_spend" && (
              <div>
                <Label>Minimum Amount</Label>
                <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
              </div>
            )}
            {type === "item_specific" && (
              <div>
                <Label>Item ID</Label>
                <Input value={itemId} onChange={e => setItemId(e.target.value)} />
              </div>
            )}
            {type === "time_window" && (
              <div className="flex gap-2">
                <div>
                  <Label>Start</Label>
                  <Input type="time" value={start} onChange={e => setStart(e.target.value)} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="time" value={end} onChange={e => setEnd(e.target.value)} />
                </div>
              </div>
            )}
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>
              Save Coupon
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Discount</th>
              <th className="p-4 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {query.data?.map(c => (
              <tr key={c.id}>
                <td className="p-4">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.description}</div>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {c.rule_json.type}
                  </span>
                </td>
                <td className="p-4">{c.rule_json.discount_pct}%</td>
                <td className="p-4">
                  <Switch 
                    checked={c.active} 
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: c.id, active: checked })}
                  />
                </td>
              </tr>
            ))}
            {query.data?.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No coupons found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
