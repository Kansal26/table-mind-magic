import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, getSupabaseAuthClient } from "@/integrations/supabase/client.server";
import { resolveTableId } from "./ordering.server";
import { verifyAdminAuth } from "./auth.server";

// We check if the user is owner using auth.server logic, similar to other admin fns
async function requireRestaurantOwnership(token: string, restaurantId: string) {
  const user = await verifyAdminAuth(token);
  const { data: owns } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("owner_id", user.id)
    .single();
  if (!owns) throw new Error("Unauthorized");
  return user;
}

export const callWaiterFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({ 
      qrToken: z.string(), 
      reason: z.string() 
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("Table not found or invalid token.");

    // Get open session and restaurant_id
    const { data: tableData } = await supabaseAdmin
      .from("tables")
      .select("restaurant_id, sessions(id, status)")
      .eq("id", tableId)
      .eq("sessions.status", "open")
      .single();

    if (!tableData) throw new Error("Table not found");
    const openSession = tableData.sessions?.[0];
    if (!openSession) throw new Error("No active session for this table");

    const sessionId = openSession.id;
    const restaurantId = tableData.restaurant_id;

    // Spam Protection: check if pending call exists in last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentCalls } = await supabaseAdmin
      .from("waiter_calls" as any)
      .select("id")
      .eq("session_id", sessionId)
      .gte("created_at", twoMinutesAgo);

    if (recentCalls && recentCalls.length > 0) {
      throw new Error("Already called");
    }

    // Insert call
    const { data: call, error } = await supabaseAdmin
      .from("waiter_calls" as any)
      .insert({
        session_id: sessionId,
        table_id: tableId,
        restaurant_id: restaurantId,
        reason: data.reason
      })
      .select("id")
      .single();

    if (error) throw error;
    
    return { success: true, callId: call.id };
  });

export const fetchAdminWaiterCallsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data }) => {
    await requireRestaurantOwnership(data.token, data.restaurantId);
    
    const { data: calls, error } = await supabaseAdmin
      .from("waiter_calls" as any)
      .select("id, status, reason, created_at, tables(label)")
      .eq("restaurant_id", data.restaurantId)
      .in("status", ["pending", "acknowledged"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    return (calls || []).map((c: any) => ({
      id: c.id,
      status: c.status,
      reason: c.reason,
      created_at: c.created_at,
      table_label: c.tables?.label
    }));
  });

export const acknowledgeWaiterCallFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({ token: z.string(), restaurantId: z.string().uuid(), callId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data }) => {
    await requireRestaurantOwnership(data.token, data.restaurantId);
    
    const { error } = await supabaseAdmin
      .from("waiter_calls" as any)
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("id", data.callId)
      .eq("restaurant_id", data.restaurantId);
      
    if (error) throw error;
    return { success: true };
  });

export const resolveWaiterCallFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({ token: z.string(), restaurantId: z.string().uuid(), callId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data }) => {
    await requireRestaurantOwnership(data.token, data.restaurantId);
    
    const { error } = await supabaseAdmin
      .from("waiter_calls" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", data.callId)
      .eq("restaurant_id", data.restaurantId);
      
    if (error) throw error;
    return { success: true };
  });
