const LOCAL_BACKEND_BASE = "http://127.0.0.1:8000";
const LOCALHOST_BACKEND_BASE = "http://localhost:8000";
const HOSTED_BACKEND_BASE = "https://recyclr-crm-backend.onrender.com";

export const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE || HOSTED_BACKEND_BASE;

const STAFF_API_BASE = BACKEND_BASE;

export function apiPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${STAFF_API_BASE}${normalizedPath}`;
}

export const CUSTOMER_PORTAL_API_BASE = apiPath("/api/customers/portal");

export function toBackendUrl(url: string) {
  if (url.startsWith("/api/")) {
    return `${BACKEND_BASE}${url}`;
  }

  const rewriteLocalUrl = (base: string) => {
    if (!url.startsWith(base)) return null;
    const path = url.slice(base.length) || "/";
    return `${BACKEND_BASE}${path}`;
  };

  if (typeof window !== "undefined") {
    const currentOrigin = window.location.origin;
    if (url.startsWith(`${currentOrigin}/api/`)) {
      return `${BACKEND_BASE}${url.slice(currentOrigin.length)}`;
    }
  }

  return rewriteLocalUrl(LOCAL_BACKEND_BASE) ?? rewriteLocalUrl(LOCALHOST_BACKEND_BASE) ?? url;
}

export async function readApiPayload(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text().catch(() => "");
  const trimmedText = text.trim();
  if (trimmedText.toLowerCase().startsWith("<!doctype") || trimmedText.toLowerCase().startsWith("<html")) {
    throw new Error(fallbackMessage);
  }
  throw new Error(trimmedText || fallbackMessage);
}

export function friendlyApiError(error: unknown) {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return `Could not connect to the CRM backend. If this is the hosted CRM, the backend may be waking up. Try again in a minute.`;
  }

  return error instanceof Error ? error.message : "Could not connect to the CRM backend.";
}
