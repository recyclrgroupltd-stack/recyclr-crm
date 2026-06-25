"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StaffShell from "../../../components/StaffShell";
import AppModal from "../../../components/AppModal";
import { getAuthHeaders } from "../../../lib/auth";

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewQuotePage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(true);

  const today = formatDateForInput(new Date());
  const defaultValidUntil = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return formatDateForInput(date);
  })();
  const defaultServiceStartDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatDateForInput(date);
  })();

  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [serviceStartDate, setServiceStartDate] = useState(defaultServiceStartDate);

  useEffect(() => {
    document.title = "Create Quote - Recyclr";
  }, []);

  function setQuoteValidityDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setValidUntil(formatDateForInput(date));
  }

  async function createBlankQuote() {
    if (!validUntil) {
      setError("Please set a valid until date before saving this quote.");
      return;
    }

    if (validUntil < today) {
      setError("Valid until date cannot be in the past.");
      return;
    }

    if (!serviceStartDate) {
      setError("Please set the requested service start date before saving this quote.");
      return;
    }

    if (serviceStartDate < today) {
      setError("Requested service start date cannot be in the past.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await fetch("/api/quotes/", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          title: "New Quote",
          status: "draft",
          valid_until: validUntil,
          contact_name: "",
          email: "",
          sic_code: "",
          address_line_1: "",
          address_line_2: "",
          town: "",
          county: "",
          postcode: "",
          contract_start_date: serviceStartDate,
          notes: "",
          internal_notes: "",
          lines: [],
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.quote?.id) {
        throw new Error(data?.message || "Could not create quote.");
      }

      router.replace(`/quotes/${data.quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create quote.");
      setCreating(false);
      setShowModal(false);
    }
  }

  return (
    <StaffShell title="Create Quote">
      <div className="space-y-6">
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <h1 className="text-2xl font-semibold text-white">Create Quote</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {creating
              ? "Creating a new draft quote and opening it now..."
              : "Set how long this quote should remain valid before it expires."}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/20 p-6 text-white backdrop-blur-lg">
            {error}
          </div>
        ) : null}
      </div>

      {showModal ? (
        <AppModal
          open={showModal}
          onClose={() => router.push("/quotes")}
          title="Create Quote"
          description="Set the requested service start date and how long this quote should remain valid."
          maxWidthClassName="max-w-2xl"
          zIndexClassName="z-[300]"
          topPaddingClassName="pt-28"
          panelClassName="bg-[#4a3099]"
          bodyClassName="px-6 py-5"
          contentClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          footer={
            <>
              <button
                type="button"
                onClick={() => router.push("/quotes")}
                disabled={creating}
                className="rounded-lg border border-violet-100 bg-white px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createBlankQuote}
                disabled={creating}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
              >
                {creating ? "Creating Quote..." : "Create Quote"}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setQuoteValidityDays(7)}
                className="rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6846bb]"
              >
                7 Days
              </button>

              <button
                type="button"
                onClick={() => setQuoteValidityDays(14)}
                className="rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6846bb]"
              >
                14 Days
              </button>

              <button
                type="button"
                onClick={() => setQuoteValidityDays(30)}
                className="rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6846bb]"
              >
                30 Days
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Valid Until
              </label>
              <input
                type="date"
                min={today}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Requested Service Start Date
              </label>
              <input
                type="date"
                min={today}
                value={serviceStartDate}
                onChange={(e) => setServiceStartDate(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-[#5a3aa8] px-4 py-3 text-sm font-medium text-slate-500">
              The start date will be shown on the quote email and must be confirmed before signing.
            </div>
          </div>
        </AppModal>
      ) : null}
    </StaffShell>
  );
}
