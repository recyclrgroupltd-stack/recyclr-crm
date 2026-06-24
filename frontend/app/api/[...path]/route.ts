import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_BASE || "https://recyclr-crm-backend.onrender.com";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARDED_REQUEST_HEADERS = new Set([
  "accept",
  "authorization",
  "content-type",
  "x-csrftoken",
  "x-requested-with",
  "x-staff-token",
  "x-staff-username",
]);

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function buildBackendUrl(path: string[], search: string) {
  const cleanBase = BACKEND_BASE.replace(/\/+$/, "");
  const cleanPath = path.map(encodeURIComponent).join("/");
  return `${cleanBase}/api/${cleanPath}${search}`;
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey) || !FORWARDED_REQUEST_HEADERS.has(lowerKey)) return;
    headers.set(key, value);
  });

  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", new URL(BACKEND_BASE).host);

  return headers;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const backendUrl = buildBackendUrl(path, request.nextUrl.search);
  const method = request.method.toUpperCase();

  const response = await fetch(backendUrl, {
    method,
    headers: buildForwardHeaders(request),
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("x-recyclr-proxy-method", method);

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "accept, authorization, content-type, user-agent, x-csrftoken, x-requested-with, x-staff-token, x-staff-username",
      "Access-Control-Max-Age": "86400",
    },
  });
}
