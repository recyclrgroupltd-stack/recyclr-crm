"use client";

import { useEffect } from "react";

import { toBackendUrl } from "@/lib/apiBase";

export function BackendFetchBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const resolveFetchUrl = (url: string) => (url.startsWith("/") ? new URL(url, window.location.origin).toString() : url);

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string") {
        return originalFetch(toBackendUrl(input), init);
      }

      if (input instanceof URL) {
        return originalFetch(new URL(resolveFetchUrl(toBackendUrl(input.toString()))), init);
      }

      if (input instanceof Request) {
        const rewrittenUrl = resolveFetchUrl(toBackendUrl(input.url));
        if (rewrittenUrl !== input.url) {
          return originalFetch(new Request(rewrittenUrl, input), init);
        }
      }

      return originalFetch(input, init);
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
