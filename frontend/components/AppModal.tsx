"use client";

import { ReactNode } from "react";

type AppModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  zIndexClassName?: string;
  align?: "top" | "center";
  topPaddingClassName?: string;
  panelClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  hideDefaultClose?: boolean;
  onBackdropClose?: boolean;
};

export default function AppModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClassName = "max-w-4xl",
  zIndexClassName = "z-[300]",
  align = "top",
  topPaddingClassName = "pt-28",
  panelClassName = "bg-[#4a3099]",
  bodyClassName = "px-6 py-5",
  contentClassName = "min-h-0 flex-1 overflow-y-auto",
  closeLabel = "Close",
  closeDisabled = false,
  hideDefaultClose = false,
  onBackdropClose = true,
}: AppModalProps) {
  if (!open) return null;

  const alignmentClassName =
    align === "center"
      ? "items-center justify-center px-4 py-6"
      : `items-start justify-center px-4 pb-6 ${topPaddingClassName}`;

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} overflow-y-auto overscroll-contain bg-[#120a2e]/92 backdrop-blur-[2px]`}
      onClick={onBackdropClose ? onClose : undefined}
    >
      <div className={`flex min-h-full ${alignmentClassName}`}>
        <div
          className={`flex max-h-[calc(100vh-8rem)] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-[28px] border border-white/15 ${panelClassName} text-white shadow-2xl`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="text-2xl font-semibold text-white">{title}</h2>
              {description ? (
                <p className="mt-2 text-sm text-white/75">{description}</p>
              ) : null}
            </div>

            {!hideDefaultClose ? (
              <button
                type="button"
                onClick={onClose}
                disabled={closeDisabled}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                {closeLabel}
              </button>
            ) : null}
          </div>

          <div className={contentClassName}>
            <div className={bodyClassName}>{children}</div>
          </div>

          {footer ? (
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
