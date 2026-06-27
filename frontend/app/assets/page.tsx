"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";

type Choice = { value: string; label: string };
type Option = { id: number; name?: string; label?: string };

type AssetEvent = {
  id: number;
  title: string;
  notes: string;
  old_status: string;
  new_status: string;
  created_by: string;
  created_at: string;
};

type Asset = {
  id: number;
  asset_uid: string;
  name: string;
  category: string;
  category_label: string;
  status: string;
  status_label: string;
  serial_number: string;
  location: string;
  assigned_to_id: number | null;
  assigned_to_name: string;
  purchase_date: string;
  purchase_value: number;
  supplier: string;
  warranty_expiry: string;
  notes: string;
  purchase_order_id: number | null;
  purchase_order_number: string;
  expense_claim_id: number | null;
  qr_payload: string;
  qr_url: string;
  events?: AssetEvent[];
};

type Summary = {
  total: number;
  active: number;
  in_repair: number;
  retired: number;
  filtered: number;
};

const emptyAsset = {
  name: "",
  category: "other",
  status: "active",
  serial_number: "",
  location: "",
  assigned_to_id: "",
  purchase_date: "",
  purchase_value: "",
  supplier: "",
  warranty_expiry: "",
  notes: "",
  purchase_order_id: "",
  expense_claim_id: "",
};

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function formatDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB");
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    in_repair: "bg-amber-100 text-amber-800",
    lost: "bg-red-100 text-red-800",
    retired: "bg-slate-100 text-slate-700",
    sold: "bg-blue-100 text-blue-800",
  };
  return classes[status] || "bg-slate-100 text-slate-700";
}

function SearchableLinkSelect({
  label,
  value,
  placeholder,
  emptyLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  emptyLabel: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => String(option.id) === value);
  const filteredOptions = options.filter((option) => {
    const text = `${option.label || ""} ${option.name || ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-left text-sm font-bold text-slate-950"
      >
        <span className={selected ? "max-h-10 overflow-hidden" : "text-slate-500"}>{selected?.label || label}</span>
        <span className="shrink-0 text-slate-400">v</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-lg border border-violet-100 bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-md border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-bold outline-none"
              placeholder={placeholder}
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-500 hover:bg-violet-50"
            >
              {emptyLabel}
            </button>
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(String(option.id));
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm font-bold hover:bg-violet-50 ${String(option.id) === value ? "bg-violet-100 text-violet-800" : "text-slate-800"}`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm font-semibold text-slate-500">No matches found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function readApiJson(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      response.status === 404
        ? "Assets backend is not deployed yet. Wait for Render to finish deploying the latest commit, then refresh."
        : fallbackMessage
    );
  }
  return response.json();
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, in_repair: 0, retired: 0, filtered: 0 });
  const [categories, setCategories] = useState<Choice[]>([]);
  const [statuses, setStatuses] = useState<Choice[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<Option[]>([]);
  const [expenses, setExpenses] = useState<Option[]>([]);
  const [form, setForm] = useState(emptyAsset);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedForm = useMemo(() => {
    if (!selected) return null;
    return {
      name: selected.name || "",
      category: selected.category || "other",
      status: selected.status || "active",
      serial_number: selected.serial_number || "",
      location: selected.location || "",
      assigned_to_id: selected.assigned_to_id ? String(selected.assigned_to_id) : "",
      purchase_date: selected.purchase_date || "",
      purchase_value: String(selected.purchase_value || ""),
      supplier: selected.supplier || "",
      warranty_expiry: selected.warranty_expiry || "",
      notes: selected.notes || "",
      purchase_order_id: selected.purchase_order_id ? String(selected.purchase_order_id) : "",
      expense_claim_id: selected.expense_claim_id ? String(selected.expense_claim_id) : "",
      change_note: "",
    };
  }, [selected]);
  const [editForm, setEditForm] = useState<Record<string, string> | null>(null);

  async function loadOptions() {
    const response = await fetch("/api/assets/options/", { headers: getAuthHeaders() });
    const data = await readApiJson(response, "Could not load asset options.");
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load asset options.");
    setCategories(data.categories || []);
    setStatuses(data.statuses || []);
    setStaff(data.staff || []);
    setPurchaseOrders(data.purchase_orders || []);
    setExpenses(data.expenses || []);
  }

  async function loadAssets() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    const response = await fetch(`/api/assets/?${params.toString()}`, { headers: getAuthHeaders() });
    const data = await readApiJson(response, "Could not load assets.");
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load assets.");
    setAssets(data.rows || []);
    setSummary(data.summary || { total: 0, active: 0, in_repair: 0, retired: 0, filtered: 0 });
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadOptions(), loadAssets()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load assets.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadAssets().catch((err) => setError(err instanceof Error ? err.message : "Could not load assets."));
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    setEditForm(selectedForm);
  }, [selectedForm]);

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const response = await fetch("/api/assets/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(form),
      });
      const data = await readApiJson(response, "Could not create asset.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not create asset.");
      setMessage(data.message || "Asset created.");
      setForm(emptyAsset);
      await loadAssets();
      await openAsset(data.asset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create asset.");
    } finally {
      setSaving(false);
    }
  }

  async function openAsset(assetId: number) {
    const response = await fetch(`/api/assets/${assetId}/`, { headers: getAuthHeaders() });
    const data = await readApiJson(response, "Could not open asset.");
    if (!response.ok || !data.success) throw new Error(data.message || "Could not open asset.");
    setSelected(data.asset);
  }

  async function updateAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editForm) return;
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const response = await fetch(`/api/assets/${selected.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(editForm),
      });
      const data = await readApiJson(response, "Could not update asset.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not update asset.");
      setMessage(data.message || "Asset updated.");
      setSelected(data.asset);
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update asset.");
    } finally {
      setSaving(false);
    }
  }

  function printAssetLabel(asset: Asset) {
    const html = `<!doctype html>
<html>
<head>
<title>${asset.asset_uid} label</title>
<style>
@page { size: 70mm 35mm; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #07102d; }
.label { width: 70mm; height: 35mm; display: grid; grid-template-columns: 26mm 1fr; gap: 3mm; padding: 3mm; border: 1px solid #111; }
img { width: 24mm; height: 24mm; }
.brand { font-size: 8pt; font-weight: 800; color: #1683d8; }
.id { margin-top: 1mm; font-size: 16pt; font-weight: 900; letter-spacing: .5px; }
.name { margin-top: 1mm; font-size: 8pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { margin-top: 1mm; font-size: 7pt; color: #3b4a63; }
button { margin: 8px; padding: 8px 12px; }
@media print { button { display: none; } }
</style>
</head>
<body>
<button onclick="window.print()">Print</button>
<div class="label">
  <div><img src="${asset.qr_url}" alt="QR"></div>
  <div>
    <div class="brand">Recyclr Group Ltd</div>
    <div class="id">${asset.asset_uid}</div>
    <div class="name">${asset.name}</div>
    <div class="meta">${asset.category_label} | ${asset.status_label}</div>
    <div class="meta">${asset.serial_number ? `S/N ${asset.serial_number}` : "Scan for asset record"}</div>
  </div>
</div>
</body>
</html>`;
    const printWindow = window.open("", "_blank", "width=520,height=420");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }

  return (
    <StaffShell title="Assets">
      <div className="space-y-4">
        <div className="rounded-lg bg-white p-5 text-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">Asset Register</h1>
              <p className="mt-1 text-sm font-semibold text-slate-600">Track company assets, link purchase records, and print QR labels.</p>
            </div>
            <button type="button" onClick={loadAssets} className="rounded-lg border border-violet-100 px-4 py-2 text-sm font-bold text-violet-700">
              Refresh
            </button>
          </div>
        </div>

        {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Total Assets", summary.total],
            ["Active", summary.active],
            ["In Repair", summary.in_repair],
            ["Retired / Sold", summary.retired],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white p-5 text-slate-950">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-2 text-3xl font-black">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          <form onSubmit={createAsset} className="rounded-lg bg-white p-5 text-slate-950">
            <h2 className="text-lg font-black">Add Asset</h2>
            <div className="mt-4 grid gap-3">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Asset name, e.g. Samsung tablet" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                  {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                  {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
              <input value={form.serial_number} onChange={(event) => setForm({ ...form, serial_number: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Serial number" />
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Location" />
              <select value={form.assigned_to_id} onChange={(event) => setForm({ ...form, assigned_to_id: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                <option value="">Unassigned</option>
                {staff.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.purchase_date} onChange={(event) => setForm({ ...form, purchase_date: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" />
                <input value={form.purchase_value} onChange={(event) => setForm({ ...form, purchase_value: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Value" />
              </div>
              <input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Supplier" />
              <SearchableLinkSelect
                label="Link purchase order"
                value={form.purchase_order_id}
                placeholder="Search PO, supplier, description, amount..."
                emptyLabel="No linked purchase order"
                options={purchaseOrders}
                onChange={(value) => setForm({ ...form, purchase_order_id: value })}
              />
              <SearchableLinkSelect
                label="Link expense"
                value={form.expense_claim_id}
                placeholder="Search expense, merchant, staff, amount..."
                emptyLabel="No linked expense"
                options={expenses}
                onChange={(value) => setForm({ ...form, expense_claim_id: value })}
              />
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Notes" />
              <button disabled={saving} className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {saving ? "Saving..." : "Create Asset"}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="rounded-lg bg-white p-5 text-slate-950">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Search ID, name, serial, location..." />
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                  <option value="all">All categories</option>
                  {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                  <option value="all">All statuses</option>
                  {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td className="px-4 py-5 text-slate-500" colSpan={7}>Loading assets...</td></tr>
                    ) : assets.length === 0 ? (
                      <tr><td className="px-4 py-5 text-slate-500" colSpan={7}>No assets found.</td></tr>
                    ) : assets.map((asset) => (
                      <tr key={asset.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <div className="font-black text-violet-700">{asset.asset_uid}</div>
                          <div className="font-bold">{asset.name}</div>
                          <div className="text-xs font-semibold text-slate-500">{asset.serial_number || "No serial"}</div>
                        </td>
                        <td className="px-4 py-3 font-bold">{asset.category_label}</td>
                        <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-black ${statusClass(asset.status)}`}>{asset.status_label}</span></td>
                        <td className="px-4 py-3 font-bold">{asset.assigned_to_name || "-"}</td>
                        <td className="px-4 py-3 font-bold">{asset.location || "-"}</td>
                        <td className="px-4 py-3 font-bold">{formatMoney(asset.purchase_value)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openAsset(asset.id).catch((err) => setError(err.message))} className="rounded-md bg-violet-700 px-3 py-2 text-xs font-black text-white">Open</button>
                            <button type="button" onClick={() => printAssetLabel(asset)} className="rounded-md border border-violet-100 px-3 py-2 text-xs font-black text-violet-700">Print Label</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selected && editForm ? (
              <div className="rounded-lg bg-white p-5 text-slate-950">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{selected.asset_uid}</h2>
                    <p className="text-sm font-semibold text-slate-500">{selected.name}</p>
                  </div>
                  <button type="button" onClick={() => printAssetLabel(selected)} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white">Print Asset Label</button>
                </div>

                <form onSubmit={updateAsset} className="mt-4 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="rounded-lg border border-slate-200 p-4 text-center">
                    <img src={selected.qr_url} alt={`QR for ${selected.asset_uid}`} className="mx-auto h-32 w-32" />
                    <div className="mt-2 text-lg font-black">{selected.asset_uid}</div>
                    <div className="text-xs font-bold text-slate-500">70mm x 35mm label</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" />
                    <input value={editForm.serial_number} onChange={(event) => setEditForm({ ...editForm, serial_number: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Serial number" />
                    <select value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                      {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                    <select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                      {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                    <input value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Location" />
                    <select value={editForm.assigned_to_id} onChange={(event) => setEditForm({ ...editForm, assigned_to_id: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold">
                      <option value="">Unassigned</option>
                      {staff.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                    <input type="date" value={editForm.purchase_date} onChange={(event) => setEditForm({ ...editForm, purchase_date: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" />
                    <input value={editForm.purchase_value} onChange={(event) => setEditForm({ ...editForm, purchase_value: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Value" />
                    <input value={editForm.supplier} onChange={(event) => setEditForm({ ...editForm, supplier: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" placeholder="Supplier" />
                    <input type="date" value={editForm.warranty_expiry} onChange={(event) => setEditForm({ ...editForm, warranty_expiry: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold" />
                    <SearchableLinkSelect
                      label="No linked PO"
                      value={editForm.purchase_order_id}
                      placeholder="Search PO, supplier, description, amount..."
                      emptyLabel="No linked purchase order"
                      options={purchaseOrders}
                      onChange={(value) => setEditForm({ ...editForm, purchase_order_id: value })}
                    />
                    <SearchableLinkSelect
                      label="No linked expense"
                      value={editForm.expense_claim_id}
                      placeholder="Search expense, merchant, staff, amount..."
                      emptyLabel="No linked expense"
                      options={expenses}
                      onChange={(value) => setEditForm({ ...editForm, expense_claim_id: value })}
                    />
                    <textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} className="min-h-24 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold md:col-span-2" placeholder="Notes" />
                    <input value={editForm.change_note} onChange={(event) => setEditForm({ ...editForm, change_note: event.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold md:col-span-2" placeholder="Change note" />
                    <button disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">
                      {saving ? "Saving..." : "Save Asset"}
                    </button>
                  </div>
                </form>

                <div className="mt-5">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Asset History</h3>
                  <div className="mt-2 space-y-2">
                    {selected.events?.length ? selected.events.map((event) => (
                      <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div className="font-black">{event.title}</div>
                        <div className="text-xs font-semibold text-slate-500">{formatDate(event.created_at)} {event.created_by ? `- ${event.created_by}` : ""}</div>
                        {event.notes ? <div className="mt-1 font-semibold text-slate-700">{event.notes}</div> : null}
                      </div>
                    )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">No asset history yet.</div>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
