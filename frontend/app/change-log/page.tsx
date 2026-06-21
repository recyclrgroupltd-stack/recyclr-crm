"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { apiPath } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

type ChangeLogRow = {
  id: string;
  source: string;
  source_label: string;
  title: string;
  description: string;
  actor: string;
  created_at: string;
  object_id: number | null;
  object_label: string;
  object_detail: string;
  status_label: string;
  href: string;
};

type SourceChoice = {
  value: string;
  label: string;
};

type Summary = {
  total: number;
  containers: number;
  customers: number;
};

const defaultSummary: Summary = {
  total: 0,
  containers: 0,
  customers: 0,
};

function authHeaders() {
  return getAuthHeaders();
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB");
}

function sourceClass(source: string) {
  if (source === "container") return "bg-blue-100 text-blue-800";
  if (source === "customer") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

export default function ChangeLogPage() {
  const [rows, setRows] = useState<ChangeLogRow[]>([]);
  const [sources, setSources] = useState<SourceChoice[]>([
    { value: "all", label: "All changes" },
    { value: "container", label: "Containers" },
    { value: "customer", label: "Customers" },
  ]);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filteredRows = useMemo(() => rows, [rows]);

  async function loadChangeLog() {
    const params = new URLSearchParams();
    params.set("source", source);
    params.set("limit", "150");
    if (search.trim()) params.set("search", search.trim());

    const response = await fetch(apiPath(`/api/containers/change-log/?${params.toString()}`), {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load change log.");

    setRows(Array.isArray(data.rows) ? data.rows : []);
    setSources(Array.isArray(data.sources) ? data.sources : sources);
    setSummary(data.summary || defaultSummary);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        await loadChangeLog();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load change log.");
      } finally {
        setLoading(false);
      }
    }

    const timeout = window.setTimeout(load, 150);
    return () => window.clearTimeout(timeout);
  }, [source, search]);

  return (
    <StaffShell title="Change Log">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Global Change Log</h1>
          <p className="mt-1 text-sm font-medium text-white/75">
            Review lifecycle changes, customer activity, and audit notes across the CRM.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Loaded Changes</div>
            <div className="mt-3 text-3xl font-black">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Container Logs</div>
            <div className="mt-3 text-3xl font-black">{summary.containers}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Customer Activity</div>
            <div className="mt-3 text-3xl font-black">{summary.customers}</div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black">Audit Feed</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest CRM changes first. More modules will appear here as their audit logging is added.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search change, user, customer, bin..."
                className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none"
              />
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none"
              >
                {sources.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-6 text-slate-500">Loading change log...</div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Area</th>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-slate-500">No changes match this view.</td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-violet-50/60">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-1 text-xs font-black ${sourceClass(row.source)}`}>
                            {row.source_label}
                          </span>
                          <div className="mt-2 text-xs font-bold text-slate-500">{row.status_label}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black">{row.object_label}</div>
                          <div className="mt-1 max-w-xs text-xs font-semibold text-slate-500">{row.object_detail || "-"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black">{row.title}</div>
                          <div className="mt-1 max-w-xl text-sm font-semibold text-slate-600">{row.description || "-"}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{row.actor || "Unknown"}</td>
                        <td className="px-4 py-3">
                          <Link href={row.href || "#"} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white hover:bg-violet-800">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
