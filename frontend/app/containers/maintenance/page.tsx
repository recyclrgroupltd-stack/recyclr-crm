"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";

type ContainerRow = {
  id: number;
  container_uid: string;
  bin_size_label: string;
  waste_stream_label: string;
  status: string;
  status_label: string;
  site_name: string;
  customer_name: string;
};

type MaintenanceEvent = {
  id: number;
  container_id: number;
  container_uid: string;
  container_status: string;
  bin_size_label: string;
  waste_stream_label: string;
  site_name: string;
  customer_name: string;
  title: string;
  notes: string;
  status: string;
  status_label: string;
  reported_by: string;
  created_at: string;
};

function authHeaders() {
  return {
    "X-Staff-Username":
      window.localStorage.getItem("staff_username") ||
      window.localStorage.getItem("username") ||
      "",
  };
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

export default function ContainerMaintenancePage() {
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [containerSearch, setContainerSearch] = useState("");
  const [form, setForm] = useState({ container_id: "", title: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredContainers = useMemo(() => {
    const term = containerSearch.trim().toLowerCase();
    if (!term) return containers.slice(0, 30);
    return containers
      .filter((container) =>
        [
          container.container_uid,
          container.bin_size_label,
          container.waste_stream_label,
          container.site_name,
          container.customer_name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 30);
  }, [containerSearch, containers]);

  async function loadData() {
    const [containersResponse, eventsResponse] = await Promise.all([
      fetch("http://127.0.0.1:8000/api/containers/?status=all", { headers: authHeaders() }),
      fetch("http://127.0.0.1:8000/api/containers/maintenance/", { headers: authHeaders() }),
    ]);
    const containersData = await containersResponse.json();
    const eventsData = await eventsResponse.json();
    if (!containersResponse.ok || !containersData.success) throw new Error(containersData.message || "Could not load containers.");
    if (!eventsResponse.ok || !eventsData.success) throw new Error(eventsData.message || "Could not load maintenance.");
    setContainers(containersData.rows || []);
    setEvents(eventsData.events || []);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load maintenance.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createEvent() {
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const response = await fetch("http://127.0.0.1:8000/api/containers/maintenance/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not create maintenance event.");
      setMessage(data.message || "Maintenance event created.");
      setForm({ container_id: "", title: "", notes: "" });
      setContainerSearch("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create maintenance event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffShell title="Container Maintenance">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Container Maintenance</h1>
          <p className="mt-1 text-sm font-medium text-white/75">Record repairs, damage, inspections, and end-of-life decisions.</p>
        </div>

        {(message || error) ? (
          <div className={`rounded-lg border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">New Maintenance Record</h2>
            <p className="mt-1 text-sm text-slate-500">The selected container will be moved into Maintenance status.</p>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Find Container</label>
                <input value={containerSearch} onChange={(e) => setContainerSearch(e.target.value)} placeholder="Search CONT ID, customer, site..." className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-100 bg-white">
                  {filteredContainers.map((container) => {
                    const selected = String(container.id) === String(form.container_id);
                    return (
                      <button
                        key={container.id}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, container_id: String(container.id) }));
                          setContainerSearch(container.container_uid);
                        }}
                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 ${selected ? "bg-violet-50 text-violet-800" : "hover:bg-slate-50"}`}
                      >
                        <span className="block font-mono font-black">{container.container_uid}</span>
                        <span className="block text-xs text-slate-500">
                          {container.bin_size_label} {container.waste_stream_label} {container.site_name ? `- ${container.site_name}` : "- in stock"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Issue</label>
                <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Notes</label>
                <textarea rows={5} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-sm font-bold outline-none" />
              </div>
              <button onClick={createEvent} disabled={saving || !form.container_id || !form.title.trim()} className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:bg-slate-300">
                {saving ? "Saving..." : "Create Maintenance Record"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">Maintenance History</h2>
            <p className="mt-1 text-sm text-slate-500">{events.length} records logged.</p>

            {loading ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-6 text-slate-500">Loading maintenance...</div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Container</th>
                      <th className="px-4 py-3">Issue</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-slate-500">No maintenance records yet.</td>
                      </tr>
                    ) : (
                      events.map((event) => (
                        <tr key={event.id} className="border-t border-slate-100 align-top hover:bg-violet-50/60">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-black text-violet-700">{event.container_uid}</div>
                            <div className="text-xs text-slate-500">{event.bin_size_label} {event.waste_stream_label}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold">{event.title}</div>
                            <div className="mt-1 max-w-md text-xs text-slate-500">{event.notes || "-"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold">{event.site_name || "In stock"}</div>
                            <div className="text-xs text-slate-500">{event.customer_name || ""}</div>
                          </td>
                          <td className="px-4 py-3 font-bold">{event.status_label}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(event.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
