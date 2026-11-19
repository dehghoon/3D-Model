/** Shared Linkoteq customer authorization adapter.
 * This is deliberately NOT enabled on existing routes until trusted employee
 * role verification and cross-subdomain session handoff are tested.
 * Never treat a browser-supplied role or tool key as proof of authorization.
 */
export type ToolAccessResult =
 | { allowed: true; userId: string }
 | { allowed: false; status: 401 | 403 | 503; reason: string };

export async function verifyLinkoteqCustomerAccess(
  bearer: string | null,
  toolKey: "3d_model",
  config: { supabaseUrl: string; supabaseAnonKey: string },
  fetcher: typeof fetch = fetch,
): Promise<ToolAccessResult> {
  const token = bearer?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return { allowed: false, status: 401, reason: "authentication_required" };
  const base = config.supabaseUrl.replace(/\/$/, "");
  if (!/^https:\/\//.test(base) || !config.supabaseAnonKey)
    return { allowed: false, status: 503, reason: "identity_not_configured" };
  const headers = { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` };
  try {
    const identity = await fetcher(`${base}/auth/v1/user`, { headers, cache: "no-store" });
    if (!identity.ok) return { allowed: false, status: 401, reason: "invalid_session" };
    const user = await identity.json() as { id?: string };
    if (!user.id) return { allowed: false, status: 401, reason: "invalid_session" };
    const grant = await fetcher(`${base}/rest/v1/rpc/has_active_customer_beta`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_tool_key: toolKey }),
      cache: "no-store",
    });
    if (!grant.ok) return { allowed: false, status: 503, reason: "entitlement_unavailable" };
    const active: unknown = await grant.json();
    if (active !== true) return { allowed: false, status: 403, reason: "owner_approval_required" };
    return { allowed: true, userId: user.id };
  } catch {
    return { allowed: false, status: 503, reason: "identity_service_unavailable" };
  }
}
