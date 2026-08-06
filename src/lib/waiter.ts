import { callWaiterFn, fetchAdminWaiterCallsFn, acknowledgeWaiterCallFn, resolveWaiterCallFn } from "./waiter.functions";

export async function callWaiter(qrToken: string, reason: string) {
  return await callWaiterFn({ data: { qrToken, reason } });
}

export async function fetchAdminWaiterCalls(token: string, restaurantId: string) {
  return await fetchAdminWaiterCallsFn({ data: { token, restaurantId } });
}

export async function acknowledgeWaiterCall(token: string, restaurantId: string, callId: string) {
  return await acknowledgeWaiterCallFn({ data: { token, restaurantId, callId } });
}

export async function resolveWaiterCall(token: string, restaurantId: string, callId: string) {
  return await resolveWaiterCallFn({ data: { token, restaurantId, callId } });
}
