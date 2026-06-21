"use client";

import { useEffect, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";
import { getWasteStreamStyle } from "@/lib/wasteStreams";

type Choice = {
  value: string;
  label: string;
};

type ContainerRow = {
  id: number;
  container_uid: string;
  bin_size: string;
  bin_size_label: string;
  waste_stream: string;
  waste_stream_label: string;
  status: string;
  status_label: string;
  site_id: number | null;
  site_name: string;
  customer_name: string;
  location_label?: string;
  location_detail?: string;
  service_id: number | null;
  qr_payload: string;
  qr_url: string;
  assigned_at: string;
  delivered_at: string;
  eol_at: string;
  notes: string;
  history?: ContainerHistory[];
};

type ContainerHistory = {
  id: number;
  title: string;
  notes: string;
  status: string;
  status_label: string;
  reported_by: string;
  created_at: string;
  resolved_at: string;
};

type Summary = {
  total: number;
  inactive: number;
  assigned: number;
  active: number;
  maintenance: number;
  eol: number;
  filtered: number;
};

type LabelSettings = {
  width_mm: number;
  height_mm: number;
};

const defaultSummary: Summary = {
  total: 0,
  inactive: 0,
  assigned: 0,
  active: 0,
  maintenance: 0,
  eol: 0,
  filtered: 0,
};

const emptyBatch = {
  bin_size: "240",
  waste_stream: "general",
  quantity: "1",
  supplier: "",
  delivery_date: "",
  notes: "",
};

function authHeaders() {
  return getAuthHeaders();
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const classes: Record<string, string> = {
    inactive: "bg-slate-100 text-slate-700",
    assigned: "bg-amber-100 text-amber-800",
    active: "bg-emerald-100 text-emerald-800",
    maintenance: "bg-blue-100 text-blue-800",
    eol: "bg-red-100 text-red-800",
  };

  return (
    <span className={`rounded px-2 py-1 text-xs font-black ${classes[status] || "bg-slate-100 text-slate-700"}`}>
      {label}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB");
}

function containerLocationLabel(container: ContainerRow) {
  if (container.location_label) return container.location_label;
  if (container.status === "eol") return "EOL";
  return container.site_name || "In stock";
}

function containerLocationDetail(container: ContainerRow) {
  if (container.location_detail) return container.location_detail;
  if (container.status === "eol") return "End of life";
  return container.customer_name || "Not currently at a customer site";
}

export default function ContainersPage() {
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [binSizes, setBinSizes] = useState<Choice[]>([]);
  const [wasteStreams, setWasteStreams] = useState<Choice[]>([]);
  const [statuses, setStatuses] = useState<Choice[]>([]);
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({ width_mm: 50, height_mm: 50 });
  const [batch, setBatch] = useState(emptyBatch);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContainer, setSelectedContainer] = useState<ContainerRow | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedNotes, setSelectedNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadOptions() {
    const response = await fetch("http://127.0.0.1:8000/api/containers/options/", {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load container options.");
    setBinSizes(data.bin_sizes || []);
    setWasteStreams(data.waste_streams || []);
    setStatuses(data.statuses || []);
    setLabelSettings(data.label_settings || { width_mm: 50, height_mm: 50 });
  }

  async function loadContainers() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    const response = await fetch(`http://127.0.0.1:8000/api/containers/?${params.toString()}`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load containers.");
    setRows(data.rows || []);
    setSummary(data.summary || defaultSummary);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadOptions(), loadContainers()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load containers.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadContainers().catch((err) => setError(err instanceof Error ? err.message : "Could not load containers."));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [search, statusFilter]);

  async function createBatch() {
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const response = await fetch("http://127.0.0.1:8000/api/containers/batches/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(batch),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not add containers.");
      setMessage(data.message || "Containers added.");
      setBatch(emptyBatch);
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add containers.");
    } finally {
      setSaving(false);
    }
  }

  async function openContainer(row: ContainerRow) {
    setSelectedContainer(row);
    setSelectedStatus(row.status);
    setSelectedNotes(row.notes || "");
    setShowHistory(false);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/containers/${row.id}/`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.success && data.container) {
        setSelectedContainer(data.container);
        setSelectedStatus(data.container.status || row.status);
        setSelectedNotes(data.container.notes || "");
      }
    } catch {
      // Keep the already-open row available if the detail refresh fails.
    }
  }

  async function saveContainer() {
    if (!selectedContainer) return;

    try {
      let eolReactivationReason = "";
      if (selectedContainer.status === "eol" && selectedStatus !== "eol") {
        const reason = window.prompt("Why is this container being changed from EOL?");
        if (!reason || !reason.trim()) {
          setError("Add a reason before changing an EOL container back to another status.");
          return;
        }
        eolReactivationReason = reason.trim();
      }

      setSaving(true);
      setMessage("");
      setError("");
      const response = await fetch(`http://127.0.0.1:8000/api/containers/${selectedContainer.id}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          status: selectedStatus,
          notes: selectedNotes,
          eol_reactivation_reason: eolReactivationReason,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not update container.");
      setMessage(data.message || "Container updated.");
      setSelectedContainer(data.container || null);
      setSelectedStatus(data.container?.status || "");
      setSelectedNotes(data.container?.notes || "");
      await loadContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update container.");
    } finally {
      setSaving(false);
    }
  }

  function printQrLabel(container: ContainerRow) {
    const width = Number(labelSettings.width_mm || 50);
    const height = Number(labelSettings.height_mm || 50);
    const printWindow = window.open("", "_blank", "width=480,height=640");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${container.container_uid} QR Label</title>
          <style>
            @page { size: ${width}mm ${height}mm; margin: 0; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              width: ${width}mm;
              height: ${height}mm;
              font-family: Arial, sans-serif;
              color: #111827;
            }
            .label {
              width: ${width}mm;
              height: ${height}mm;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 1.5mm;
              text-align: center;
              overflow: hidden;
            }
            img { width: ${Math.max(20, Math.min(width, height) - 16)}mm; height: ${Math.max(20, Math.min(width, height) - 16)}mm; object-fit: contain; }
            .id { font-size: 8pt; font-weight: 800; line-height: 1.1; word-break: break-word; }
            .meta { font-size: 6pt; line-height: 1.1; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${container.qr_url}" alt="QR" />
            <div class="id">${container.container_uid}</div>
            <div class="meta">${container.waste_stream_label} - ${container.bin_size_label}</div>
          </div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <StaffShell title="Containers">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Container Inventory</h1>
          <p className="mt-1 text-sm font-medium text-white/75">
            Track stock, site containers, QR labels, and lifecycle status.
          </p>
        </div>

        {message || error ? (
          <div className={`rounded-lg border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["In Stock", summary.inactive],
            ["Assigned", summary.assigned],
            ["Active", summary.active],
            ["Maintenance", summary.maintenance],
            ["EOL", summary.eol],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-3 text-3xl font-black">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">Add Container Delivery</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add delivered bins into stock. Services will auto-assign matching stock containers.
            </p>
            <div className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Bin Size</label>
                  <select value={batch.bin_size} onChange={(e) => setBatch((current) => ({ ...current, bin_size: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                    {binSizes.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Quantity</label>
                  <input type="number" min="1" value={batch.quantity} onChange={(e) => setBatch((current) => ({ ...current, quantity: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Waste Stream</label>
                <select value={batch.waste_stream} onChange={(e) => setBatch((current) => ({ ...current, waste_stream: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                  {wasteStreams.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Supplier</label>
                <input value={batch.supplier} onChange={(e) => setBatch((current) => ({ ...current, supplier: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Delivery Date</label>
                <input type="date" value={batch.delivery_date} onChange={(e) => setBatch((current) => ({ ...current, delivery_date: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Notes</label>
                <textarea rows={3} value={batch.notes} onChange={(e) => setBatch((current) => ({ ...current, notes: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
              </div>
              <button onClick={createBatch} disabled={saving} className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:bg-slate-300">
                {saving ? "Working..." : "Generate Containers"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-black">Containers</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Click a container to update status, print its QR label, or review location.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, site, customer..." className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                  <option value="all">All statuses</option>
                  {statuses.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-6 text-slate-500">Loading containers...</div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Container</th>
                      <th className="px-4 py-3">Stream</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-slate-500">No containers match this view.</td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const stream = getWasteStreamStyle(row.waste_stream);
                        return (
                          <tr key={row.id} onClick={() => openContainer(row)} className="cursor-pointer border-t border-slate-100 align-top hover:bg-violet-50/60">
                            <td className="px-4 py-3 font-mono text-xs font-black text-violet-700">{row.container_uid}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded px-2 py-1 text-xs font-black ${stream.chipClass}`}>{row.waste_stream_label}</span>
                            </td>
                            <td className="px-4 py-3 font-bold">{row.bin_size_label}</td>
                            <td className="px-4 py-3"><StatusPill status={row.status} label={row.status_label} /></td>
                            <td className="px-4 py-3">
                              <div className="font-bold">{containerLocationLabel(row)}</div>
                              <div className="text-xs text-slate-500">{containerLocationDetail(row)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <img src={row.qr_url} alt={`${row.container_uid} QR`} className="h-14 w-14 rounded border border-slate-200 bg-white p-1" />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selectedContainer ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{selectedContainer.container_uid}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {selectedContainer.waste_stream_label} - {selectedContainer.bin_size_label}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowHistory((current) => !current)} className="rounded-lg border border-violet-200 px-4 py-2 text-sm font-bold text-violet-700">
                    Change Log
                  </button>
                  <button onClick={() => setSelectedContainer(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <img src={selectedContainer.qr_url} alt={`${selectedContainer.container_uid} QR`} className="mx-auto h-44 w-44 rounded border border-slate-200 bg-white p-2" />
                  {selectedContainer.status === "eol" ? (
                    <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                      QR visible. Printing disabled for EOL containers.
                    </div>
                  ) : (
                    <button onClick={() => printQrLabel(selectedContainer)} className="mt-4 w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800">
                      Print QR Label
                    </button>
                  )}
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Label size: {labelSettings.width_mm}mm x {labelSettings.height_mm}mm
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">Current Location</div>
                    <div className="mt-2 text-lg font-black">{containerLocationLabel(selectedContainer)}</div>
                    <div className="text-sm font-semibold text-slate-500">{containerLocationDetail(selectedContainer)}</div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Status</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none">
                      {statuses.map((choice) => {
                        const needsSite = ["assigned", "active"].includes(choice.value);
                        return (
                          <option key={choice.value} value={choice.value} disabled={needsSite && !selectedContainer.site_id}>
                            {choice.label}
                          </option>
                        );
                      })}
                    </select>
                    {!selectedContainer.site_id ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        In-stock containers become assigned automatically when the CRM creates customer services.
                      </p>
                    ) : null}
                    {selectedStatus === "eol" && selectedContainer.site_id ? (
                      <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                        Saving this as EOL will try to assign a matching in-stock replacement to this site automatically.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Notes</label>
                    <textarea rows={4} value={selectedNotes} onChange={(e) => setSelectedNotes(e.target.value)} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                  </div>

                  <div className="grid gap-3 text-sm font-semibold text-slate-600 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-xs font-black uppercase text-slate-400">Assigned</div>
                      {formatDate(selectedContainer.assigned_at)}
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-xs font-black uppercase text-slate-400">Delivered</div>
                      {formatDate(selectedContainer.delivered_at)}
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-xs font-black uppercase text-slate-400">EOL</div>
                      {formatDate(selectedContainer.eol_at)}
                    </div>
                  </div>

                  <button onClick={saveContainer} disabled={saving} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300">
                    {saving ? "Saving..." : "Save Container"}
                  </button>

                  {showHistory ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-black">Change Log</div>
                      <div className="mt-3 space-y-3">
                        {(selectedContainer.history || []).length === 0 ? (
                          <div className="text-sm font-semibold text-slate-500">No history saved for this bin yet.</div>
                        ) : (
                          (selectedContainer.history || []).map((event) => (
                            <div key={event.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-black">{event.title}</div>
                                <div className="text-xs font-bold text-slate-500">{formatDate(event.created_at)}</div>
                              </div>
                              {event.notes ? <div className="mt-2 text-sm font-semibold text-slate-700">{event.notes}</div> : null}
                              <div className="mt-2 text-xs font-bold text-slate-500">
                                {event.reported_by ? `Changed by ${event.reported_by}` : "Changed by unknown staff"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </StaffShell>
  );
}
