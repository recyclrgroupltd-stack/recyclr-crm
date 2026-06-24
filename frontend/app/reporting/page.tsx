"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";

type OptionItem = {
  id?: number;
  value?: string;
  label: string;
};

type ReportOptions = {
  datasets: OptionItem[];
  customers: { id: number; label: string }[];
  sites: { id: number; label: string }[];
  hauliers: { id: number; label: string }[];
  statuses: { value: string; label: string }[];
  waste_types: { value: string; label: string }[];
  quick_reports: { value: string; label: string }[];
};

type ReportResult = {
  success: boolean;
  title: string;
  columns: string[];
  rows: string[][];
  row_count: number;
};

export default function ReportingPage() {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [dataset, setDataset] = useState("customers");
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("all");
  const [siteId, setSiteId] = useState("all");
  const [status, setStatus] = useState("all");
  const [wasteType, setWasteType] = useState("all");
  const [haulierId, setHaulierId] = useState("all");

  useEffect(() => {
    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setError("");

        const response = await fetch("/api/reporting/options/", { headers: getAuthHeaders() });
        const data = await response.json();

        if (!response.ok) {
          throw new Error("Failed to load reporting options.");
        }

        setOptions(data);
      } catch (err) {
        console.error(err);
        setError("Could not load reporting options.");
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  const showCustomer = useMemo(
    () => dataset === "sites" || dataset === "services" || dataset === "quotes" || dataset === "collections",
    [dataset]
  );

  const showSite = useMemo(
    () => dataset === "sites" || dataset === "services" || dataset === "quotes" || dataset === "collections",
    [dataset]
  );

  const showStatus = useMemo(
    () =>
      dataset === "customers" ||
      dataset === "services" ||
      dataset === "quotes" ||
      dataset === "leads" ||
      dataset === "collections",
    [dataset]
  );

  const showWasteType = useMemo(
    () => dataset === "services" || dataset === "haulier_rates" || dataset === "collections",
    [dataset]
  );

  const showHaulier = useMemo(
    () => dataset === "haulier_rates",
    [dataset]
  );

  async function runQuickReport(reportCode: string) {
    try {
      setRunning(true);
      setError("");

      const params = new URLSearchParams();
      params.set("quick_report", reportCode);

      const response = await fetch(`/api/reporting/run/?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to run report.");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not run report.");
    } finally {
      setRunning(false);
    }
  }

  async function runCustomReport() {
    try {
      setRunning(true);
      setError("");

      const params = new URLSearchParams();
      params.set("dataset", dataset);

      if (search.trim()) params.set("search", search.trim());
      if (customerId !== "all") params.set("customer_id", customerId);
      if (siteId !== "all") params.set("site_id", siteId);
      if (status !== "all") params.set("status", status);
      if (wasteType !== "all") params.set("waste_type", wasteType);
      if (haulierId !== "all") params.set("haulier_id", haulierId);

      const response = await fetch(`/api/reporting/run/?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to run report.");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not run report.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <StaffShell title="Reporting">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <h2 className="text-xl font-semibold">Management Quick Reports</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
          
          </p>

          {loadingOptions || !options ? (
            <div className="mt-5 text-slate-500">Loading quick reports...</div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {options.quick_reports.map((report) => (
                <button
                  key={report.value}
                  onClick={() => runQuickReport(report.value)}
                  disabled={running}
                  className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/20 disabled:opacity-60"
                >
                  <div className="font-semibold">{report.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-xl font-semibold">Custom Report Builder</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Use this when you want something more specific than the management quick reports.
            </p>

            {loadingOptions || !options ? (
              <div className="mt-6 text-slate-500">Loading report builder...</div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Dataset</label>
                  <select
                    value={dataset}
                    onChange={(e) => setDataset(e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  >
                    {options.datasets.map((item) => (
                      <option key={item.value} value={item.value} className="bg-white text-black">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Search</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search report data..."
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>

                {showCustomer ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Customer</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All customers</option>
                      {options.customers.map((item) => (
                        <option key={item.id} value={item.id} className="bg-white text-black">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {showSite ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Site</label>
                    <select
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All sites</option>
                      {options.sites.map((item) => (
                        <option key={item.id} value={item.id} className="bg-white text-black">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {showStatus ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All statuses</option>
                      {options.statuses.map((item) => (
                        <option key={item.value} value={item.value} className="bg-white text-black">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {showWasteType ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Waste Type</label>
                    <select
                      value={wasteType}
                      onChange={(e) => setWasteType(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All waste types</option>
                      {options.waste_types.map((item) => (
                        <option key={item.value} value={item.value} className="bg-white text-black">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {showHaulier ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Haulier</label>
                    <select
                      value={haulierId}
                      onChange={(e) => setHaulierId(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All hauliers</option>
                      {options.hauliers.map((item) => (
                        <option key={item.id} value={item.id} className="bg-white text-black">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="pt-2">
                  <button
                    onClick={runCustomReport}
                    disabled={running}
                    className="w-full rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:opacity-60"
                  >
                    {running ? "Generating..." : "Generate Custom Report"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm min-w-0">
            <div>
              <h2 className="text-xl font-semibold">
                {result?.title || "Report Results"}
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {result ? `${result.row_count} row(s) returned.` : "Run a report to see results."}
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              {!result ? (
                <div className="p-6 text-slate-500">No report generated yet.</div>
              ) : result.rows.length === 0 ? (
                <div className="p-6 text-slate-500">No rows found for this report.</div>
              ) : (
                <div className="max-h-[700px] overflow-auto">
                  <table className="min-w-full text-left text-sm text-white">
                    <thead className="sticky top-0 bg-[#5c4aa3] text-slate-600">
                      <tr>
                        {result.columns.map((column) => (
                          <th
                            key={column}
                            className="border-b border-r border-white/10 px-4 py-3 font-bold last:border-r-0"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, index) => (
                        <tr key={index} className="bg-[#5f48b8]">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={`${index}-${cellIndex}`}
                              className="border-r border-t border-white/10 px-4 py-3 align-top last:border-r-0"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}