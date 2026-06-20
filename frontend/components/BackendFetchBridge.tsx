"use client";

import { useEffect } from "react";

import { toBackendUrl } from "@/lib/apiBase";

type BridgeWindow = Window &
  typeof globalThis & {
    __recyclrBackendFetchBridgeInstalled?: boolean;
    __recyclrOriginalFetch?: typeof window.fetch;
  };

function installBackendFetchBridge() {
  if (typeof window === "undefined") return;

  const bridgeWindow = window as BridgeWindow;
  if (bridgeWindow.__recyclrBackendFetchBridgeInstalled) return;

  const originalFetch = bridgeWindow.__recyclrOriginalFetch || window.fetch.bind(window);
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

  bridgeWindow.__recyclrOriginalFetch = originalFetch;
  bridgeWindow.__recyclrBackendFetchBridgeInstalled = true;
}

installBackendFetchBridge();

export function BackendFetchBridge() {
  useEffect(() => {
    installBackendFetchBridge();
  }, []);

  return null;
}
