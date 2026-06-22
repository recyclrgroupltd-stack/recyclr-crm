"use client";

import { useEffect } from "react";

const TEXT_FIELD_SELECTOR = [
  "textarea",
  "[contenteditable='true']",
  "input:not([type])",
  "input[type='text']",
  "input[type='email']",
  "input[type='password']",
  "input[type='search']",
  "input[type='tel']",
  "input[type='url']",
  "input[type='number']",
  "input[type='date']",
  "input[type='datetime-local']",
  "input[type='time']",
  "input[type='month']",
  "input[type='week']",
].join(",");

function isFocusableTextField(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (element.getAttribute("readonly") !== null) return false;
  return true;
}

export function PenTextFieldFocus() {
  useEffect(() => {
    let lastFocused: HTMLElement | null = null;
    let lastFocusedAt = 0;

    function focusTextField(event: PointerEvent) {
      if (event.pointerType !== "pen") return;

      const target = event.target instanceof Element ? event.target.closest(TEXT_FIELD_SELECTOR) : null;
      if (!isFocusableTextField(target)) return;

      const now = Date.now();
      if (target === document.activeElement || (target === lastFocused && now - lastFocusedAt < 250)) return;

      lastFocused = target;
      lastFocusedAt = now;
      target.focus({ preventScroll: true });
    }

    window.addEventListener("pointerover", focusTextField, { passive: true });
    window.addEventListener("pointermove", focusTextField, { passive: true });

    return () => {
      window.removeEventListener("pointerover", focusTextField);
      window.removeEventListener("pointermove", focusTextField);
    };
  }, []);

  return null;
}
