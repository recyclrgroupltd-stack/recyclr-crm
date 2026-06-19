"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders } from "../../lib/auth";

type QuoteRow = {
  id: number;
  quote_number: string;
  title: string;
  lead_id: number | null;
  lead_name: string;
  customer_id: number | null;
  customer_name: string;
  site_id: number | null;
  site_name: string;
  contact_name: string;
  email: string;
  status: string;
  valid_until: string;
  subtotal_per_month: number;
  bin_rental_per_month: number;
  total_per_month: number;
  notes: string;
  internal_notes: string;
  created_at: string;
  updated_at: string;
  line_count: number;
  document_count: number;
};

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function prettyStatus(status: string) {
  return (status || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    document.title = "Quotes - Recyclr";
  }, []);

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://127.0.0.1:8000/api/quotes/", {
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load quotes.");
      }

      setQuotes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load quotes.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadQuote(quoteId: number) {
    try {
      setError("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/quotes/${quoteId}/pdf/?created_by=JayGallagher`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        let message = "Failed to download quote PDF.";
        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // ignore json parse fail for binary responses
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quote-${quoteId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to download quote PDF.");
      }
    }
  }

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      if (statusFilter !== "all" && quote.status !== statusFilter) return false;
      if (!term) return true;

      const haystack = [
        quote.quote_number,
        quote.title,
        quote.lead_name,
        quote.customer_name,
        quote.site_name,
        quote.contact_name,
        quote.email,
        quote.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [quotes, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: quotes.length,
      draft: quotes.filter((quote) => quote.status === "draft").length,
      sent: quotes.filter((quote) => quote.status === "sent").length,
      accepted: quotes.filter((quote) => quote.status === "accepted").length,
      monthlyValue: quotes.reduce((sum, quote) => sum + Number(quote.total_per_month || 0), 0),
    };
  }, [quotes]);

  return (
    <StaffShell title="Quotes">
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div>
            <h1 className="text-2xl font-black">Commercial Quotes</h1>
            <p className="mt-1 text-sm font-medium text-white/75">
              Build proposals and move accepted quotes into live work.
            </p>
          </div>

          <Link
            href="/quotes/new"
            className="rounded-lg bg-white px-4 py-3 text-sm font-black text-violet-800 shadow-sm transition hover:bg-violet-50"
          >
            Create Quote
          </Link>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total Quotes</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Draft</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.draft}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Sent</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.sent}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Accepted</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.accepted}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Monthly Value</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{formatMoney(summary.monthlyValue)}</div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white p-4 text-slate-950 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#120a35]">Quote Register</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Search and open quote records.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="w-full md:w-80">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Search
                </label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search quote, lead, customer, site..."
                  className="w-full rounded-lg border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-[#120a35] outline-none placeholder:text-slate-400 focus:border-violet-400"
                />
              </div>

              <div className="w-full md:w-48">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-[#120a35] outline-none focus:border-violet-400"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-100">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Quote</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Lead</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Lines</th>
                    <th className="px-4 py-3 font-medium">Valid Until</th>
                    <th className="px-4 py-3 font-medium">Monthly Total</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        Loading quotes...
                      </td>
                    </tr>
                  ) : filteredQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        No quotes found.
                      </td>
                    </tr>
                  ) : (
                    filteredQuotes.map((quote) => {
                      const isAccepted = quote.status === "accepted";

                      return (
                        <tr key={quote.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                          <td className="px-4 py-3 font-black text-violet-700">{quote.quote_number}</td>
                          <td className="px-4 py-3">{quote.title || "-"}</td>
                          <td className="px-4 py-3">{quote.lead_name || "-"}</td>
                          <td className="px-4 py-3">{quote.customer_name || "-"}</td>
                          <td className="px-4 py-3">{quote.site_name || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">
                              {prettyStatus(quote.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{quote.line_count}</td>
                          <td className="px-4 py-3">{formatDate(quote.valid_until)}</td>
                          <td className="px-4 py-3 font-semibold">{formatMoney(quote.total_per_month)}</td>
                          <td className="px-4 py-3">
                            {isAccepted ? (
                              <button
                                type="button"
                                onClick={() => handleDownloadQuote(quote.id)}
                                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800"
                              >
                                Download Quote
                              </button>
                            ) : (
                              <Link
                                href={`/quotes/${quote.id}`}
                                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800"
                              >
                                Open Quote
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
