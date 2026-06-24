"use client";

import { useEffect, useState } from "react";
import StaffShell from "../../components/StaffShell";

type QuoteDocument = {
  id: number;
  version_number: number;
  created_at: string;
  file_size_bytes: number;
  filename: string;
  download_url: string;
  notes: string;
  quote_id: number;
  quote_number: string;
  quote_title: string;
  customer_name: string;
  site_name: string;
  contact_name: string;
  email: string;
  status: string;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function prettyStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function QuoteDocumentsPage() {
  const [documents, setDocuments] = useState<QuoteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadDocuments(searchTerm = "") {
    try {
      setLoading(true);
      setError("");

      const query = searchTerm.trim()
        ? `?search=${encodeURIComponent(searchTerm.trim())}`
        : "";

      const response = await fetch(`/api/quotes/documents/search/${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load saved PDFs.");
      }

      setDocuments(data.results || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load saved PDFs.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    loadDocuments(search);
  }

  return (
    <StaffShell title="Saved Quote PDFs">
      <div className="space-y-6">
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <h2 className="text-xl font-semibold">Saved Quote PDFs</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Search saved quote documents by customer, site, quote number, title or keyword.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, site, quote number, title, email..."
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200"
            >
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            Loading saved PDFs...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-300/30 bg-red-500/20 p-6 text-white backdrop-blur-lg">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-white">
                <thead className="bg-black/10 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Quote</th>
                    <th className="px-4 py-3 font-medium">Version</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                        No saved PDFs found.
                      </td>
                    </tr>
                  ) : (
                    documents.map((document) => (
                      <tr
                        key={document.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-4 py-3 font-semibold">{document.quote_number}</td>
                        <td className="px-4 py-3">v{String(document.version_number).padStart(3, "0")}</td>
                        <td className="px-4 py-3">{document.quote_title || "-"}</td>
                        <td className="px-4 py-3">{document.customer_name || "-"}</td>
                        <td className="px-4 py-3">{document.site_name || "-"}</td>
                        <td className="px-4 py-3">{prettyStatus(document.status || "draft")}</td>
                        <td className="px-4 py-3">{formatDate(document.created_at)}</td>
                        <td className="px-4 py-3">{formatBytes(document.file_size_bytes)}</td>
                        <td className="px-4 py-3">
                          <a
                            href={`${document.download_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-200"
                          >
                            Download
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </StaffShell>
  );
}