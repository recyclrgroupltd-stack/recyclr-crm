const LOCAL_BACKEND_BASE = "http://127.0.0.1:8000";
const LOCALHOST_BACKEND_BASE = "http://localhost:8000";
const HOSTED_BACKEND_BASE = "https://recyclr-crm-backend.onrender.com";

export const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_BASE ||
  (process.env.NODE_ENV === "production" ? HOSTED_BACKEND_BASE : LOCAL_BACKEND_BASE);
export const CUSTOMER_PORTAL_API_BASE = `${BACKEND_BASE}/api/customers/portal`;

export function apiPath(path: string) {
  return `${BACKEND_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function toBackendUrl(url: string) {
  if (url.startsWith(LOCAL_BACKEND_BASE)) {
    return `${BACKEND_BASE}${url.slice(LOCAL_BACKEND_BASE.length)}`;
  }

  if (url.startsWith(LOCALHOST_BACKEND_BASE)) {
    return `${BACKEND_BASE}${url.slice(LOCALHOST_BACKEND_BASE.length)}`;
  }

  return url;
}

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
    return `Could not connect to the CRM backend at ${BACKEND_BASE}. If this is the hosted CRM, the backend may be waking up. Try again in a minute.`;
  }

  return error instanceof Error ? error.message : "Could not connect to the CRM backend.";
}
