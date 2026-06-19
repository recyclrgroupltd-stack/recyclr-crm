"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";

type Quote = {
  id: number;
  quote_number: string;
  title: string;
  customer_id: number | null;
  customer_name: string;
  site_name: string;
  contact_name: string;
  email: string;
  status: string;
  total_per_month: number;
};

type SigningPack = {
  id: number;
  quote_id: number;
  quote_number: string;
  quote_title: string;
  customer_name: string;
  site_name: string;
  status: string;
  signer_name: string;
  signer_email: string;
  message: string;
  public_url: string;
  sent_at: string;
  viewed_at: string;
  signed_at: string;
  expires_at: string;
  document_count: number;
  signed_document_count: number;
  signed_documents: Array<{ id: number; title: string; absolute_download_url: string }>;
};

function prettyStatus(status: string) {
  return (status || "draft").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

export default function ContractSigningPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [packs, setPacks] = useState<SigningPack[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const acceptedQuotes = useMemo(
    () => quotes.filter((quote) => quote.status === "accepted" && quote.customer_id),
    [quotes]
  );

  const selectedQuote = useMemo(
    () => acceptedQuotes.find((quote) => String(quote.id) === selectedQuoteId),
    [acceptedQuotes, selectedQuoteId]
  );

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      const [quoteResponse, packResponse] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/quotes/"),
        fetch("http://127.0.0.1:8000/api/documents/signing-packs/", { headers: getAuthHeaders() }),
      ]);
      const quoteData = await quoteResponse.json();
      const packData = await packResponse.json();
      if (!quoteResponse.ok) throw new Error("Could not load quotes.");
      if (!packResponse.ok || !packData.success) throw new Error(packData.message || "Could not load signing packs.");
      setQuotes(Array.isArray(quoteData) ? quoteData : []);
      setPacks(packData.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load contract signing data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedQuote) return;
    setSignerName(selectedQuote.contact_name || "");
    setSignerEmail(selectedQuote.email || "");
  }, [selectedQuote]);

  async function createPack(sendNow = false) {
    if (!selectedQuoteId) {
      setError("Choose an accepted quote first.");
      return;
    }

    try {
      setError("");
      setNotice("");
      const response = await fetch("http://127.0.0.1:8000/api/documents/signing-packs/create/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          quote_id: Number(selectedQuoteId),
          signer_name: signerName,
          signer_email: signerEmail,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not create signing pack.");

      if (sendNow) {
        await sendPack(data.pack.id, signerName, signerEmail, message, false);
      } else {
        setNotice("Signing pack created.");
        await loadAll();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create signing pack.");
    }
  }

  async function sendPack(packId: number, name?: string, email?: string, customMessage?: string, reload = true) {
    try {
      setBusyId(packId);
      setError("");
      setNotice("");
      const response = await fetch(`http://127.0.0.1:8000/api/documents/signing-packs/${packId}/send/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          signer_name: name,
          signer_email: email,
          message: customMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not send signing pack.");
      setNotice(data.message || "Signing pack sent.");
      if (reload) await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send signing pack.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelPack(packId: number) {
    try {
      setBusyId(packId);
      setError("");
      const response = await fetch(`http://127.0.0.1:8000/api/documents/signing-packs/${packId}/cancel/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not cancel signing pack.");
      setNotice("Signing pack cancelled.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel signing pack.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setNotice("Signing link copied.");
  }

  return (
    <StaffShell title="Contract Signing">
      <div className="space-y-6">
        <section className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black">Contract Signing</h1>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Create secure signing links for accepted quotes and track viewed, signed, expired, and cancelled packs.
              </p>
            </div>
            <button onClick={loadAll} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white">
              Refresh
            </button>
          </div>
        </section>

        {notice ? <div className="rounded-lg border border-emerald-200 bg-white p-4 font-semibold text-emerald-700 shadow-sm">{notice}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">{error}</div> : null}

        <section className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <h2 className="text-xl font-black">Create Signing Pack</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Accepted Quote</span>
              <select
                value={selectedQuoteId}
                onChange={(event) => setSelectedQuoteId(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
              >
                <option value="">Select quote</option>
                {acceptedQuotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quote_number} - {quote.customer_name || quote.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Signer Name</span>
              <input
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Signer Email</span>
              <input
                value={signerEmail}
                onChange={(event) => setSignerEmail(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Email Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Optional note to include in the signing email"
              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => createPack(false)} className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white">
              Create Pack
            </button>
            <button onClick={() => createPack(true)} className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-white">
              Create & Send
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Signing Packs</h2>
              <p className="text-sm font-medium text-slate-600">{packs.length} packs found</p>
            </div>
          </div>
          {loading ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-5 text-slate-600">Loading signing packs...</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Quote</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Signer</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sent</th>
                      <th className="px-4 py-3">Viewed</th>
                      <th className="px-4 py-3">Signed</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No signing packs yet.
                        </td>
                      </tr>
                    ) : (
                      packs.map((pack) => (
                        <tr key={pack.id} className="border-t border-slate-100 align-top hover:bg-violet-50/60">
                          <td className="px-4 py-3">
                            <div className="font-bold text-violet-700">{pack.quote_number}</div>
                            <div className="text-xs text-slate-500">{pack.document_count} docs</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{pack.customer_name}</div>
                            <div className="text-xs text-slate-500">{pack.site_name || "-"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{pack.signer_name || "-"}</div>
                            <div className="text-xs text-slate-500">{pack.signer_email || "-"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                              {prettyStatus(pack.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatDate(pack.sent_at)}</td>
                          <td className="px-4 py-3">{formatDate(pack.viewed_at)}</td>
                          <td className="px-4 py-3">{formatDate(pack.signed_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[260px] flex-wrap gap-2">
                              <button onClick={() => copyLink(pack.public_url)} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700">
                                Copy Link
                              </button>
                              <button
                                onClick={() => sendPack(pack.id, pack.signer_name, pack.signer_email, pack.message)}
                                disabled={busyId === pack.id || pack.status === "signed" || pack.status === "cancelled"}
                                className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Send
                              </button>
                              <button
                                onClick={() => cancelPack(pack.id)}
                                disabled={busyId === pack.id || pack.status === "signed" || pack.status === "cancelled"}
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              {pack.signed_documents.map((document) => (
                                <a
                                  key={document.id}
                                  href={document.absolute_download_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white"
                                >
                                  {document.title}
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </StaffShell>
  );
}
