"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders } from "../../lib/auth";
import { getWasteStreamStyle } from "../../lib/wasteStreams";

type ServiceRow = {
  id: number;
  customer_id: number | null;
  customer_uid?: string;
  customer_name: string;
  account_manager?: string;
  site_id: number | null;
  site_name: string;
  site_address?: string;
  site_postcode?: string;
  waste_type: string;
  waste_type_label: string;
  bin_size: string;
  bin_size_label: string;
  bin_count: number;
  collections_per_week: number;
  lock_required: boolean;
  metal_bin_required: boolean;
  status: string;
  status_label: string;
  haulier_id: number | null;
  haulier_name: string;
  schedule_type: string;
  schedule_type_label: string;
  collection_days: string[];
  collection_days_label: string;
  start_date: string;
  price_per_lift: number;
  monthly_value: number;
  upcoming_jobs?: number;
  next_job_date?: string;
  container_count?: number;
  active_container_count?: number;
  assigned_container_count?: number;
  required_container_count?: number;
  signed_documents?: boolean;
  readiness?: {
    is_ready: boolean;
    score: number;
    total: number;
    missing: string[];
    warnings: string[];
    checks: Array<{ key: string; label: string; ok: boolean }>;
  };
  notes: string;
  created_at: string;
  updated_at: string;
};

type Summary = {
  total: number;
  pending_schedule: number;
  active: number;
  paused: number;
  ended: number;
};

type SetupOption = {
  value: string;
  label: string;
};

type HaulierOption = {
  id: number;
  name: string;
};

type SetupFormState = {
  haulier_id: string;
  schedule_type: string;
  collection_days: string[];
  collections_per_week: number;
  start_date: string;
  status: string;
  notes: string;
};

type ViewMode = "register" | "setup" | "active" | "value" | "readiness";

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatFrequency(value: number) {
  return `${Number(value || 0)}/week`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status: string) {
  if (status === "pending_schedule") return "bg-amber-100 text-amber-800";
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "paused") return "bg-blue-100 text-blue-800";
  if (status === "ended") return "bg-slate-200 text-slate-700";
  return "bg-violet-100 text-violet-800";
}

function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(status)}`}>
      {label || status.replaceAll("_", " ")}
    </span>
  );
}

function WasteStreamChip({ value, label }: { value: string; label: string }) {
  const style = getWasteStreamStyle(value || label);
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${style.chipClass}`}>
      {style.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "violet" | "amber" | "green" | "blue" | "slate";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    violet: "bg-violet-700",
    amber: "bg-amber-500",
    green: "bg-emerald-600",
    blue: "bg-blue-600",
    slate: "bg-slate-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${
        active ? "ring-2 ring-violet-400" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${tones[tone]} text-sm font-black text-white`}>
          {label.charAt(0)}
        </div>
        <div>
          <div className="text-3xl font-black text-slate-950">{value}</div>
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className="mt-1 text-xs font-semibold text-violet-700">{hint}</div>
        </div>
      </div>
    </button>
  );
}

function needsSetup(row: ServiceRow) {
  const needsDays = row.schedule_type !== "on_request" && !row.collection_days?.length;
  const needsStart = row.schedule_type !== "on_request" && !row.start_date;
  return row.status === "pending_schedule" || !row.haulier_id || needsDays || needsStart || !row.readiness?.is_ready;
}

function readinessLabel(row: ServiceRow) {
  if (row.readiness?.is_ready) return "Ready";
  return `${row.readiness?.score || 0}/${row.readiness?.total || 5}`;
}

function readinessClass(row: ServiceRow) {
  if (row.readiness?.is_ready) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if ((row.readiness?.score || 0) >= 3) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function ReadinessBadge({ row }: { row: ServiceRow }) {
  return (
    <span className={`inline-flex min-w-[70px] justify-center rounded-full border px-3 py-1 text-xs font-black ${readinessClass(row)}`}>
      {readinessLabel(row)}
    </span>
  );
}

function ReadinessChecklist({ row }: { row: ServiceRow }) {
  const checks = row.readiness?.checks || [];
  if (!checks.length) return <span className="text-xs font-semibold text-slate-500">No readiness data.</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {checks.map((check) => (
        <span
          key={check.key}
          title={check.label}
          className={`rounded-full px-2 py-1 text-[11px] font-black ${
            check.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          }`}
        >
          {check.ok ? "OK" : "Missing"} {check.label}
        </span>
      ))}
    </div>
  );
}

export default function ServicesPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    pending_schedule: 0,
    active: 0,
    paused: 0,
    ended: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("register");
  const [hauliers, setHauliers] = useState<HaulierOption[]>([]);
  const [scheduleTypes, setScheduleTypes] = useState<SetupOption[]>([]);
  const [days, setDays] = useState<SetupOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);
  const [setupForm, setSetupForm] = useState<SetupFormState>({
    haulier_id: "",
    schedule_type: "weekly",
    collection_days: [],
    collections_per_week: 1,
    start_date: "",
    status: "pending_schedule",
    notes: "",
  });

  useEffect(() => {
    document.title = "Services - Recyclr";
    loadPage();
  }, []);

  useEffect(() => {
    if (!selectedService) return;
    const oldBody = document.body.style.overflow;
    const oldHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldBody;
      document.documentElement.style.overflow = oldHtml;
    };
  }, [selectedService]);

  async function parseJsonResponse(response: Response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      if ((response.headers.get("content-type") || "").includes("text/html")) {
        throw new Error("Services backend returned an HTML page. Check backend URLs and restart Django.");
      }
      throw new Error(text || "Invalid JSON response.");
    }
  }

  async function loadPage() {
    try {
      setLoading(true);
      setError("");
      const [servicesResponse, setupResponse] = await Promise.all([
        fetch("/api/services/", { headers: getAuthHeaders() }),
        fetch("/api/services/setup-options/", { headers: getAuthHeaders() }),
      ]);
      const servicesData = await parseJsonResponse(servicesResponse);
      const setupData = await parseJsonResponse(setupResponse);

      if (!servicesResponse.ok || !servicesData.success) {
        throw new Error(servicesData.message || "Failed to load services.");
      }
      if (!setupResponse.ok || !setupData.success) {
        throw new Error(setupData.message || "Failed to load setup options.");
      }

      setRows(Array.isArray(servicesData.rows) ? servicesData.rows : []);
      setSummary(
        servicesData.summary || {
          total: 0,
          pending_schedule: 0,
          active: 0,
          paused: 0,
          ended: 0,
        },
      );
      setHauliers(Array.isArray(setupData.hauliers) ? setupData.hauliers : []);
      setScheduleTypes(setupData.filters?.schedule_types || []);
      setDays(setupData.filters?.days || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services.");
    } finally {
      setLoading(false);
    }
  }

  const setupRows = useMemo(() => rows.filter(needsSetup), [rows]);
  const notReadyRows = useMemo(() => rows.filter((row) => !row.readiness?.is_ready), [rows]);
  const activeRows = useMemo(() => rows.filter((row) => row.status === "active"), [rows]);
  const monthlyTotal = useMemo(
    () => rows.filter((row) => row.status === "active").reduce((sum, row) => sum + Number(row.monthly_value || 0), 0),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    let data = [...rows];

    if (viewMode === "setup") data = setupRows;
    if (viewMode === "readiness") data = notReadyRows;
    if (viewMode === "active") data = activeRows;
    if (viewMode === "value") data = [...activeRows].sort((a, b) => Number(b.monthly_value || 0) - Number(a.monthly_value || 0));

    if (statusFilter !== "all") {
      data = data.filter((row) => row.status === statusFilter);
    }

    if (term) {
      data = data.filter((row) =>
        [
          row.customer_name,
          row.customer_uid,
          row.account_manager,
          row.site_name,
          row.site_address,
          row.site_postcode,
          row.waste_type_label,
          row.bin_size_label,
          row.haulier_name,
          row.status_label,
          row.collection_days_label,
          row.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }

    return data;
  }, [rows, setupRows, notReadyRows, activeRows, viewMode, statusFilter, search]);

  function openSetup(service: ServiceRow) {
    setSelectedService(service);
    setSetupForm({
      haulier_id: service.haulier_id ? String(service.haulier_id) : "",
      schedule_type: service.schedule_type || "weekly",
      collection_days: Array.isArray(service.collection_days) ? service.collection_days : [],
      collections_per_week: Math.max(Number(service.collections_per_week || 1), 1),
      start_date: service.start_date || "",
      status: service.status || "pending_schedule",
      notes: service.notes || "",
    });
  }

  function closeSetup() {
    if (!saving) setSelectedService(null);
  }

  const maxSelectableDays = Math.max(Number(setupForm.collections_per_week || 1), 1);

  function setCollectionsPerWeek(value: number) {
    setSetupForm((prev) => ({
      ...prev,
      collections_per_week: value,
      collection_days: prev.collection_days.slice(0, value),
    }));
  }

  function toggleCollectionDay(day: string) {
    setSetupForm((prev) => {
      const exists = prev.collection_days.includes(day);
      if (exists) return { ...prev, collection_days: prev.collection_days.filter((item) => item !== day) };
      if (prev.collection_days.length >= maxSelectableDays) return prev;
      return { ...prev, collection_days: [...prev.collection_days, day] };
    });
  }

  const modalMonthlyValue = useMemo(() => {
    if (!selectedService) return 0;
    return Number(
      (
        Number(selectedService.bin_count || 0) *
        Number(selectedService.price_per_lift || 0) *
        Number(setupForm.collections_per_week || 0) *
        4.33
      ).toFixed(2),
    );
  }, [selectedService, setupForm.collections_per_week]);

  async function saveSetup() {
    if (!selectedService) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const response = await fetch(`/api/services/${selectedService.id}/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          haulier_id: setupForm.haulier_id ? Number(setupForm.haulier_id) : null,
          schedule_type: setupForm.schedule_type,
          collection_days: setupForm.collection_days,
          collections_per_week: setupForm.collections_per_week,
          start_date: setupForm.start_date || null,
          status: setupForm.status,
          notes: setupForm.notes,
        }),
      });
      const data = await parseJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to update service.");
      setMessage(data.message || "Service updated successfully.");
      setSelectedService(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service.");
    } finally {
      setSaving(false);
    }
  }

  function renderCustomer(row: ServiceRow) {
    const content = (
      <>
        <span className="font-black text-slate-950">{row.customer_name || "-"}</span>
        <span className="block text-xs font-semibold text-slate-500">
          {row.customer_uid || "Customer"} {row.account_manager ? `- ${row.account_manager}` : ""}
        </span>
      </>
    );
    if (!row.customer_id) return content;
    return <Link href={`/customers/${row.customer_id}`} className="hover:text-violet-700">{content}</Link>;
  }

  return (
    <StaffShell title="Services">
      <div className="space-y-5">
        {(message || error) && (
          <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
            {error || message}
          </div>
        )}

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-3xl font-black text-slate-950">Services</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Control active collections, pending schedules, haulier assignment, and service value.
            </p>
          </div>
          <Link href="/services/new" className="rounded-md bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-violet-800">
            Add Service
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Services" value={summary.total} hint="All records" tone="violet" active={viewMode === "register" && statusFilter === "all"} onClick={() => { setViewMode("register"); setStatusFilter("all"); }} />
          <StatCard label="Not Ready" value={notReadyRows.length} hint="Missing setup checks" tone="amber" active={viewMode === "readiness"} onClick={() => { setViewMode("readiness"); setStatusFilter("all"); }} />
          <StatCard label="Active" value={summary.active} hint="Live services" tone="green" active={statusFilter === "active"} onClick={() => { setViewMode("active"); setStatusFilter("active"); }} />
          <StatCard label="Paused" value={summary.paused} hint="Temporarily stopped" tone="blue" active={statusFilter === "paused"} onClick={() => { setViewMode("register"); setStatusFilter("paused"); }} />
          <StatCard label="Monthly Value" value={formatMoney(monthlyTotal)} hint="Active contracted value" tone="slate" active={viewMode === "value"} onClick={() => { setViewMode("value"); setStatusFilter("all"); }} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-72 flex-1">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Customer, site, postcode, stream, haulier..."
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-violet-500"
                />
              </label>
              <label className="min-w-52">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-black text-slate-950"
                >
                  <option value="all">All statuses</option>
                  <option value="pending_schedule">Pending schedule</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {[
                ["register", "Register"],
                ["setup", "Needs Setup"],
                ["readiness", "Not Ready"],
                ["active", "Active"],
                ["value", "Value"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setViewMode(value as ViewMode);
                    if (value !== "active") setStatusFilter("all");
                    if (value === "active") setStatusFilter("active");
                  }}
                  className={`rounded-md px-4 py-2 text-xs font-black transition ${
                    viewMode === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Readiness Queue</h2>
                <p className="text-sm font-semibold text-slate-600">Services blocked from going cleanly live.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">{notReadyRows.length}</span>
            </div>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {notReadyRows.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">
                  All services are ready.
                </div>
              )}
              {notReadyRows.slice(0, 8).map((row) => (
                <button key={row.id} type="button" onClick={() => openSetup(row)} className="w-full rounded-md bg-amber-50 p-3 text-left transition hover:bg-amber-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-slate-950">{row.customer_name}</div>
                      <div className="text-xs font-semibold text-slate-600">{row.site_name} - {row.waste_type_label}</div>
                    </div>
                    <ReadinessBadge row={row} />
                  </div>
                  {!!row.readiness?.missing?.length && (
                    <div className="mt-2 text-xs font-bold text-amber-900">
                      Missing: {row.readiness.missing.slice(0, 3).join(", ")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-xl font-black text-slate-950">Service Register</h2>
              <p className="text-sm font-semibold text-slate-600">{filteredRows.length} matching services.</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-black text-slate-600">Loading services...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold text-slate-500">No services found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Site</th>
                    <th className="px-4 py-3">Stream</th>
                    <th className="px-4 py-3">Bin</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Haulier</th>
                    <th className="px-4 py-3">Next Job</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Monthly</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className={needsSetup(row) ? "bg-amber-50/55" : "bg-white"}>
                      <td className="px-4 py-4">{renderCustomer(row)}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-950">{row.site_name || "-"}</div>
                        <div className="text-xs font-semibold text-slate-500">{row.site_postcode || row.site_address || "-"}</div>
                      </td>
                      <td className="px-4 py-4"><WasteStreamChip value={row.waste_type} label={row.waste_type_label} /></td>
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-700">
                        {row.bin_count} x {row.bin_size_label}
                        <div className="text-xs font-semibold text-slate-500">
                          {row.lock_required ? "Lock " : ""}{row.metal_bin_required ? "Metal bin" : ""}
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          {row.container_count || 0}/{row.required_container_count || row.bin_count} containers assigned
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-950">{row.schedule_type_label || "-"}</div>
                        <div className="text-xs font-semibold text-slate-500">{row.collection_days_label || "No days set"} - {formatFrequency(row.collections_per_week)}</div>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-700">{row.haulier_name || "Unassigned"}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-950">{formatDate(row.next_job_date)}</div>
                        <div className="text-xs font-semibold text-slate-500">{row.upcoming_jobs || 0} upcoming</div>
                      </td>
                      <td className="min-w-72 px-4 py-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <ReadinessBadge row={row} />
                          {!!row.readiness?.warnings?.length && (
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-black text-orange-800">
                              {row.readiness.warnings.length} warning{row.readiness.warnings.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <ReadinessChecklist row={row} />
                        {!!row.readiness?.missing?.length && (
                          <div className="mt-2 text-xs font-semibold text-red-700">
                            Missing: {row.readiness.missing.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4"><StatusPill status={row.status} label={row.status_label} /></td>
                      <td className="whitespace-nowrap px-4 py-4 font-black text-slate-950">{formatMoney(row.monthly_value)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openSetup(row)} className="rounded-md bg-violet-700 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-800">
                            {needsSetup(row) ? "Set Up" : "Edit"}
                          </button>
                          <Link href={`/services/${row.id}`} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 transition hover:bg-slate-50">
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedService && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  {selectedService.status === "pending_schedule" ? "Set Up Service" : "Edit Service"}
                </h2>
                <p className="text-sm font-semibold text-slate-600">
                  {selectedService.customer_name} - {selectedService.site_name} - {selectedService.waste_type_label}
                </p>
              </div>
              <button type="button" onClick={closeSetup} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900 hover:bg-slate-50">
                Close
              </button>
            </div>

            <div className={`mt-5 rounded-lg border p-4 ${readinessClass(selectedService)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black">Service readiness</div>
                  <div className="text-xs font-semibold">
                    {selectedService.readiness?.is_ready ? "This service has the basics covered." : "Complete the missing items before this service is treated as ready."}
                  </div>
                </div>
                <ReadinessBadge row={selectedService} />
              </div>
              <div className="mt-3">
                <ReadinessChecklist row={selectedService} />
              </div>
              {!!selectedService.readiness?.missing?.length && (
                <div className="mt-3 rounded-md bg-white/70 p-3 text-xs font-bold">
                  Missing: {selectedService.readiness.missing.join(", ")}
                </div>
              )}
              {!!selectedService.readiness?.warnings?.length && (
                <div className="mt-3 rounded-md bg-white/70 p-3 text-xs font-bold">
                  Warnings: {selectedService.readiness.warnings.join(" ")}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Haulier</span>
                <select value={setupForm.haulier_id} onChange={(event) => setSetupForm((prev) => ({ ...prev, haulier_id: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-bold text-slate-950">
                  <option value="">Select haulier</option>
                  {hauliers.map((haulier) => <option key={haulier.id} value={haulier.id}>{haulier.name}</option>)}
                </select>
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Schedule Type</span>
                <select value={setupForm.schedule_type} onChange={(event) => setSetupForm((prev) => ({ ...prev, schedule_type: event.target.value, collection_days: event.target.value === "on_request" ? [] : prev.collection_days }))} className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-bold text-slate-950">
                  {scheduleTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Collections per Week</span>
                <select value={setupForm.collections_per_week} onChange={(event) => setCollectionsPerWeek(Number(event.target.value))} className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-bold text-slate-950">
                  {[1, 2, 3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{formatFrequency(count)}</option>)}
                </select>
              </label>
              <div className="rounded-lg bg-emerald-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Monthly Value</div>
                <div className="mt-2 text-3xl font-black text-slate-950">{formatMoney(modalMonthlyValue)}</div>
              </div>
              {setupForm.schedule_type !== "on_request" && (
                <div className="md:col-span-2">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">Collection Days</div>
                  <div className="mt-2 rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    Select up to {maxSelectableDays} day{maxSelectableDays === 1 ? "" : "s"} for this service.
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {days.map((item) => {
                      const active = setupForm.collection_days.includes(item.value);
                      const disabled = !active && setupForm.collection_days.length >= maxSelectableDays;
                      return (
                        <button key={item.value} type="button" onClick={() => toggleCollectionDay(item.value)} disabled={disabled} className={`rounded-md border px-4 py-3 text-sm font-black transition ${active ? "border-violet-700 bg-violet-700 text-white" : disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-900 hover:bg-violet-50"}`}>
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Start Date</span>
                <input type="date" value={setupForm.start_date} onChange={(event) => setSetupForm((prev) => ({ ...prev, start_date: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-bold text-slate-950" />
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
                <select value={setupForm.status} onChange={(event) => setSetupForm((prev) => ({ ...prev, status: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-bold text-slate-950">
                  <option value="pending_schedule">Pending Schedule</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</span>
                <textarea rows={5} value={setupForm.notes} onChange={(event) => setSetupForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={closeSetup} disabled={saving} className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900 hover:bg-slate-50 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={saveSetup} disabled={saving} className="rounded-md bg-violet-700 px-5 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-60">
                {saving ? "Saving..." : selectedService.status === "pending_schedule" ? "Set Up Service" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
