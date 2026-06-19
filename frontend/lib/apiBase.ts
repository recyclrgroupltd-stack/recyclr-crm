export const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE || "http://127.0.0.1:8000";
export const CUSTOMER_PORTAL_API_BASE = `${BACKEND_BASE}/api/customers/portal`;

export async function readApiPayload(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text().catch(() => "");
  throw new Error(text.trim() || fallbackMessage);
}

export function friendlyApiError(error: unknown) {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Could not connect to the CRM backend. Make sure the backend is running on http://127.0.0.1:8000, then refresh.";
  }

  return error instanceof Error ? error.message : "Could not connect to the CRM backend.";
}
