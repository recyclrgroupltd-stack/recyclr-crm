"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";
import { apiPath, friendlyApiError, readApiPayload } from "@/lib/apiBase";
import { getWasteStreamStyle } from "@/lib/wasteStreams";

type Choice = { value: string; label: string };

type ServiceOption = {
  id: number;
  site_id: number;
  customer_id: number;
  customer_name: string;
  site_name: string;
  waste_stream: string;
  bin_size: string;
  bin_count: number;
  label: string;
};

type MovementRow = {
  id: number;
  movement_type: string;
  movement_type_label: string;
  status: string;
  status_label: string;
  scheduled_date: string;
  customer_name: string;
  site_name: string;
  container_uid: string;
  waste_stream: string;
  waste_stream_label: string;
  bin_size: string;
  bin_size_label: string;
  quantity: number;
  reason: string;
  created_by: string;
  billable_to_customer: boolean;
  charge_amount: number;
  charge_reason: string;
  billed_at: string;
};

type Summary = {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  billable: number;
};

const emptySummary: Summary = {
  total: 0,
  scheduled: 0,
  completed: 0,
  cancelled: 0,
  billable: 0,
};

const today = new Date().toISOString().slice(0, 10);

export default function ContainerMovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [wasteStreams, setWasteStreams] = useState<Choice[]>([]);
  const [binSizes, setBinSizes] = useState<Choice[]>([]);
  const [movementTypes, setMovementTypes] = useState<Choice[]>([]);
  const [movementStatuses, setMovementStatuses] = useState<Choice[]>([]);
  const [statusFilter, setStatusFilter] = useState("scheduled");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    movement_type: "delivery",
    scheduled_date: today,
    service_id: "",
    waste_stream: "general",
    bin_size: "240",
    quantity: "1",
    reason: "",
    billable_to_customer: false,
    charge_amount: "",
    charge_reason: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === form.service_id),
    [form.service_id, services],
  );

  async function loadOptions() {
    const response = await fetch(apiPath("/api/containers/options/"), { headers: getAuthHeaders() });
    const data = await readApiPayload(response, "Could not load bin options.");
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load bin options.");
    setServices(data.services || []);
    setWasteStreams(data.waste_streams || []);
    setBinSizes(data.bin_sizes || []);
  }

  async function loadMovements() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (search.trim()) params.set("search", search.trim());
    const response = await fetch(apiPath(`/api/containers/movements/?${params.toString()}`), { headers: getAuthHeaders() });
    const data = await readApiPayload(response, "Could not load deliveries.");
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load deliveries.");
    setRows(data.rows || []);
    setSummary(data.summary || emptySummary);
    setMovementTypes(data.movement_types || []);
    setMovementStatuses(data.movement_statuses || []);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadOptions(), loadMovements()]);
      } catch (err) {
        setError(friendlyApiError(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadMovements().catch((err) => setError(friendlyApiError(err)));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    if (!selectedService) return;
    setForm((current) => ({
      ...current,
      waste_stream: selectedService.waste_stream || current.waste_stream,
      bin_size: selectedService.bin_size || current.bin_size,
      quantity: String(selectedService.bin_count || current.quantity || "1"),
    }));
  }, [selectedService?.id]);

  async function scheduleMovement() {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const response = await fetch(apiPath("/api/containers/movements/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          service_id: form.service_id || null,
          site_id: selectedService?.site_id || null,
        }),
      });
      const data = await readApiPayload(response, "Could not schedule bin movement.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not schedule bin movement.");
      setMessage(data.message || "Bin movement scheduled.");
      setForm((current) => ({
        ...current,
        scheduled_date: today,
        reason: "",
        billable_to_customer: false,
        charge_amount: "",
        charge_reason: "",
      }));
      await loadMovements();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateMovement(row: MovementRow, action: "complete" | "cancel" | "reopen") {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const response = await fetch(apiPath(`/api/containers/movements/${row.id}/`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action }),
      });
      const data = await readApiPayload(response, "Could not update movement.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not update movement.");
      setMessage(data.message || "Movement updated.");
      await loadMovements();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffShell title="Bin Deliveries">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Bin Deliveries & Collections</h1>
          <p className="mt-1 text-sm font-medium text-white/75">
            Scheduled bin drops, contract collections, replacement deliveries, and billable damaged-bin charges.
          </p>
        </div>

        {message || error ? (
          <div className={`rounded-lg border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Scheduled", summary.scheduled],
            ["Completed", summary.completed],
            ["Cancelled", summary.cancelled],
            ["Unbilled Charges", summary.billable],
            ["Loaded", summary.total],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-3 text-3xl font-black">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 2xl:grid-cols-[420px_1fr]">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">Schedule Movement</h2>
            <p className="mt-1 text-sm text-slate-500">
              Auto-created movements appear in the list, but staff can manually add rare deliveries or collections here.
            </p>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Type</label>
                  <select value={form.movement_type} onChange={(e) => setForm((current) => ({ ...current, movement_type: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                    {(movementTypes.length ? movementTypes : [{ value: "delivery", label: "Delivery" }, { value: "collection", label: "Collection" }]).map((choice) => (
                      <option key={choice.value} value={choice.value}>{choice.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Date</label>
                  <input type="date" value={form.scheduled_date} onChange={(e) => setForm((current) => ({ ...current, scheduled_date: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Customer Service</label>
                <select value={form.service_id} onChange={(e) => setForm((current) => ({ ...current, service_id: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                  <option value="">Choose a service...</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.customer_name} - {service.site_name} - {service.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Stream</label>
                  <select value={form.waste_stream} onChange={(e) => setForm((current) => ({ ...current, waste_stream: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                    {wasteStreams.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Size</label>
                  <select value={form.bin_size} onChange={(e) => setForm((current) => ({ ...current, bin_size: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                    {binSizes.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Qty</label>
                  <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Reason</label>
                <textarea rows={3} value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm font-bold">
                <input type="checkbox" checked={form.billable_to_customer} onChange={(e) => setForm((current) => ({ ...current, billable_to_customer: e.target.checked }))} />
                Charge this movement to the customer on next invoice
              </label>

              {form.billable_to_customer ? (
                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <input type="number" min="0" step="0.01" placeholder="Amount" value={form.charge_amount} onChange={(e) => setForm((current) => ({ ...current, charge_amount: e.target.value }))} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                  <input placeholder="Charge reason" value={form.charge_reason} onChange={(e) => setForm((current) => ({ ...current, charge_reason: e.target.value }))} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                </div>
              ) : null}

              <button onClick={scheduleMovement} disabled={saving || !form.service_id} className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:bg-slate-300">
                {saving ? "Working..." : "Schedule Movement"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-black">Movement Board</h2>
                <p className="mt-1 text-sm text-slate-500">Complete or cancel the scheduled work once the bin has moved.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, site, bin..." className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                  <option value="all">All types</option>
                  {movementTypes.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                  <option value="all">All statuses</option>
                  {movementStatuses.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-slate-500">Loading movements...</div>
              ) : rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-slate-500">
                  No bin movements match this view.
                </div>
              ) : (
                rows.map((row) => {
                  const stream = getWasteStreamStyle(row.waste_stream);
                  return (
                    <div key={row.id} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-violet-100 px-2 py-1 text-xs font-black text-violet-800">{row.movement_type_label}</span>
                            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{row.status_label}</span>
                            <span className={`rounded px-2 py-1 text-xs font-black ${stream.chipClass}`}>{row.waste_stream_label}</span>
                            {row.billable_to_customer ? <span className="rounded bg-red-100 px-2 py-1 text-xs font-black text-red-700">Billable GBP {row.charge_amount.toFixed(2)}</span> : null}
                          </div>
                          <div className="mt-3 text-lg font-black">{row.customer_name}</div>
                          <div className="text-sm font-semibold text-slate-500">{row.site_name}</div>
                          <div className="mt-2 text-sm font-bold text-slate-700">
                            {row.quantity} x {row.bin_size_label}
                            {row.container_uid ? ` - ${row.container_uid}` : ""}
                          </div>
                          {row.reason ? <div className="mt-2 text-sm text-slate-600">{row.reason}</div> : null}
                          {row.charge_reason ? <div className="mt-2 text-sm font-semibold text-red-700">{row.charge_reason}</div> : null}
                        </div>

                        <div className="min-w-[170px]">
                          <div className="rounded-lg bg-slate-50 p-3 text-sm">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Scheduled</div>
                            <div className="mt-1 font-black">{row.scheduled_date || "Not set"}</div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            {row.status === "scheduled" ? (
                              <>
                                <button onClick={() => updateMovement(row, "complete")} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Done</button>
                                <button onClick={() => updateMovement(row, "cancel")} disabled={saving} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => updateMovement(row, "reopen")} disabled={saving} className="w-full rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Reopen</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
