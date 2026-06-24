"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { canEditPricing, canViewPricing, getAuthHeaders, getStoredUser, StoredUser } from "@/lib/auth";

type PriceItem = {
  id: number;
  waste_type: string;
  bin_size: string;
  price_per_lift: number;
  rental_per_day: number;
  supplier_price_per_lift: number;
  supplier_rental_per_day: number;
  delivery_charge: number;
  minimum_monthly_charge: number;
  target_margin_percent: number;
  effective_from: string;
  effective_to: string;
  sample_monthly_revenue: number;
  sample_monthly_cost: number;
  sample_monthly_margin: number;
  sample_margin_percent: number;
  margin_warning: boolean;
  active: boolean;
  notes: string;
};

type PriceForm = {
  waste_type: string;
  bin_size: string;
  price_per_lift: string;
  rental_per_day: string;
  supplier_price_per_lift: string;
  supplier_rental_per_day: string;
  delivery_charge: string;
  minimum_monthly_charge: string;
  target_margin_percent: string;
  effective_from: string;
  effective_to: string;
  notes: string;
  active: boolean;
};

type EditState = (PriceForm & { id: number }) | null;

const emptyForm: PriceForm = {
  waste_type: "general",
  bin_size: "1100",
  price_per_lift: "",
  rental_per_day: "",
  supplier_price_per_lift: "",
  supplier_rental_per_day: "",
  delivery_charge: "0",
  minimum_monthly_charge: "0",
  target_margin_percent: "30",
  effective_from: "",
  effective_to: "",
  notes: "",
  active: true,
};

const wasteTypeOptions = [
  { value: "general", label: "General Waste" },
  { value: "recycling", label: "Dry Mixed Recycling" },
  { value: "glass", label: "Glass" },
  { value: "food", label: "Food" },
];

function getBinOptionsForWasteType(wasteType: string) {
  if (wasteType === "glass" || wasteType === "food") {
    return [{ value: "240", label: "240L" }];
  }

  return [
    { value: "240", label: "240L" },
    { value: "360", label: "360L" },
    { value: "660", label: "660L" },
    { value: "1100", label: "1100L" },
  ];
}

function getDefaultBinSizeForWasteType(wasteType: string) {
  return wasteType === "glass" || wasteType === "food" ? "240" : "1100";
}

function prettyWasteType(value: string) {
  return wasteTypeOptions.find((option) => option.value === value)?.label || value;
}

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function itemToForm(item: PriceItem): PriceForm {
  return {
    waste_type: item.waste_type,
    bin_size: item.bin_size,
    price_per_lift: item.price_per_lift.toFixed(2),
    rental_per_day: item.rental_per_day.toFixed(2),
    supplier_price_per_lift: item.supplier_price_per_lift.toFixed(2),
    supplier_rental_per_day: item.supplier_rental_per_day.toFixed(2),
    delivery_charge: item.delivery_charge.toFixed(2),
    minimum_monthly_charge: item.minimum_monthly_charge.toFixed(2),
    target_margin_percent: item.target_margin_percent.toFixed(2),
    effective_from: item.effective_from || "",
    effective_to: item.effective_to || "",
    notes: item.notes || "",
    active: item.active,
  };
}

function formToPayload(form: PriceForm) {
  return {
    ...form,
    price_per_lift: Number(form.price_per_lift || 0),
    rental_per_day: Number(form.rental_per_day || 0),
    supplier_price_per_lift: Number(form.supplier_price_per_lift || 0),
    supplier_rental_per_day: Number(form.supplier_rental_per_day || 0),
    delivery_charge: Number(form.delivery_charge || 0),
    minimum_monthly_charge: Number(form.minimum_monthly_charge || 0),
    target_margin_percent: Number(form.target_margin_percent || 0),
  };
}

export default function PricingPage() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [newItem, setNewItem] = useState<PriceForm>(emptyForm);

  const canView = canViewPricing(currentUser);
  const canEdit = canEditPricing(currentUser);
  const binOptions = useMemo(() => getBinOptionsForWasteType(newItem.waste_type), [newItem.waste_type]);

  const totals = useMemo(() => {
    const activeItems = items.filter((item) => item.active);
    const lowMargin = activeItems.filter((item) => item.margin_warning).length;
    const averageMargin =
      activeItems.length > 0
        ? activeItems.reduce((sum, item) => sum + Number(item.sample_margin_percent || 0), 0) / activeItems.length
        : 0;

    return { active: activeItems.length, lowMargin, averageMargin };
  }, [items]);

  useEffect(() => {
    setCurrentUser(getStoredUser());
    setMounted(true);
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/pricing/", { headers: getAuthHeaders() });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load pricing.");
      }

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted || !canView) {
      setLoading(false);
      return;
    }
    loadItems();
  }, [mounted, canView]);

  function updateNewWasteType(wasteType: string) {
    setNewItem((current) => ({
      ...current,
      waste_type: wasteType,
      bin_size: getDefaultBinSizeForWasteType(wasteType),
    }));
  }

  async function createItem() {
    if (!newItem.price_per_lift || !newItem.rental_per_day) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch("/api/pricing/create/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(formToPayload(newItem)),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create pricing.");
      }

      setNewItem(emptyForm);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pricing.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: PriceItem) {
    setEditState({ id: item.id, ...itemToForm(item) });
  }

  async function saveEdit() {
    if (!editState) return;
    if (!editState.price_per_lift || !editState.rental_per_day) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(`/api/pricing/${editState.id}/update/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(formToPayload(editState)),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update pricing.");
      }

      setEditState(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pricing.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    try {
      setError("");

      const res = await fetch(`/api/pricing/${id}/delete/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete pricing.");
      }

      if (editState?.id === id) setEditState(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pricing.");
    }
  }

  return (
    <StaffShell title="Pricing">
      {!mounted ? (
        <div className="rounded-lg border border-violet-100 bg-white p-4 text-slate-500 shadow-sm">Loading...</div>
      ) : !canView ? (
        <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">
          You do not have permission to access pricing.
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-white">Pricebook</h1>
            <p className="mt-1 text-sm font-medium text-white/75">
              Manage customer sell rates, supplier costs, effective dates, and quote margin checks.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Active rates</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{totals.active}</div>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Average margin</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{formatPercent(totals.averageMargin)}</div>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Low margin warnings</div>
              <div className={`mt-2 text-3xl font-black ${totals.lowMargin ? "text-red-700" : "text-emerald-700"}`}>
                {totals.lowMargin}
              </div>
            </div>
          </div>

          {canEdit ? (
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-black">Add Pricebook Rate</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Customer prices feed quotes. Supplier costs feed internal margin only.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <select
                  value={newItem.waste_type}
                  onChange={(e) => updateNewWasteType(e.target.value)}
                  className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none"
                >
                  {wasteTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={newItem.bin_size}
                  onChange={(e) => setNewItem({ ...newItem, bin_size: e.target.value })}
                  className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none"
                >
                  {binOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input type="number" step="0.01" placeholder="Customer lift price" value={newItem.price_per_lift} onChange={(e) => setNewItem({ ...newItem, price_per_lift: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400" />
                <input type="number" step="0.01" placeholder="Customer rental/day" value={newItem.rental_per_day} onChange={(e) => setNewItem({ ...newItem, rental_per_day: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400" />
                <input type="number" step="0.01" placeholder="Supplier lift cost" value={newItem.supplier_price_per_lift} onChange={(e) => setNewItem({ ...newItem, supplier_price_per_lift: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400" />
                <input type="number" step="0.01" placeholder="Supplier rental/day" value={newItem.supplier_rental_per_day} onChange={(e) => setNewItem({ ...newItem, supplier_rental_per_day: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400" />
                <input type="number" step="0.01" placeholder="Minimum monthly charge" value={newItem.minimum_monthly_charge} onChange={(e) => setNewItem({ ...newItem, minimum_monthly_charge: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400" />
                <input type="number" step="0.01" placeholder="Target margin %" value={newItem.target_margin_percent} onChange={(e) => setNewItem({ ...newItem, target_margin_percent: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400" />
                <input type="date" value={newItem.effective_from} onChange={(e) => setNewItem({ ...newItem, effective_from: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none" />
                <input type="date" value={newItem.effective_to} onChange={(e) => setNewItem({ ...newItem, effective_to: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none" />
                <input placeholder="Notes" value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 md:col-span-2" />

                <button
                  onClick={createItem}
                  disabled={saving || !newItem.price_per_lift || !newItem.rental_per_day}
                  className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Adding..." : "Add Rate"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-violet-100 bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm">
              You have view-only access to pricing.
            </div>
          )}

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Waste</th>
                      <th className="px-3 py-3">Bin</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Supplier</th>
                      <th className="px-3 py-3">Sample Margin</th>
                      <th className="px-3 py-3">Effective</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => {
                      const isEditing = editState?.id === item.id;
                      return (
                        <tr key={item.id} className="border-t border-slate-100 align-top hover:bg-violet-50/60">
                          <td className="px-3 py-4 font-bold">{prettyWasteType(item.waste_type)}</td>
                          <td className="px-3 py-4">{item.bin_size}L</td>
                          <td className="px-3 py-4">
                            {isEditing ? (
                              <div className="grid gap-2">
                                <input type="number" step="0.01" value={editState.price_per_lift} onChange={(e) => setEditState((current) => (current ? { ...current, price_per_lift: e.target.value } : current))} className="w-32 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none" />
                                <input type="number" step="0.01" value={editState.rental_per_day} onChange={(e) => setEditState((current) => (current ? { ...current, rental_per_day: e.target.value } : current))} className="w-32 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none" />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>Lift {formatMoney(item.price_per_lift)}</div>
                                <div>Rental {formatMoney(item.rental_per_day)}/day</div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            {isEditing ? (
                              <div className="grid gap-2">
                                <input type="number" step="0.01" value={editState.supplier_price_per_lift} onChange={(e) => setEditState((current) => (current ? { ...current, supplier_price_per_lift: e.target.value } : current))} className="w-32 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none" />
                                <input type="number" step="0.01" value={editState.supplier_rental_per_day} onChange={(e) => setEditState((current) => (current ? { ...current, supplier_rental_per_day: e.target.value } : current))} className="w-32 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none" />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>Lift {formatMoney(item.supplier_price_per_lift)}</div>
                                <div>Rental {formatMoney(item.supplier_rental_per_day)}/day</div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            <div className={`rounded-lg px-3 py-2 font-bold ${item.margin_warning ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
                              {formatMoney(item.sample_monthly_margin)} / {formatPercent(item.sample_margin_percent)}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              Target {formatPercent(item.target_margin_percent)}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            {isEditing ? (
                              <div className="grid gap-2">
                                <input type="date" value={editState.effective_from} onChange={(e) => setEditState((current) => (current ? { ...current, effective_from: e.target.value } : current))} className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none" />
                                <input type="date" value={editState.effective_to} onChange={(e) => setEditState((current) => (current ? { ...current, effective_to: e.target.value } : current))} className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none" />
                              </div>
                            ) : (
                              <div className="space-y-1 text-xs font-semibold text-slate-600">
                                <div>From {item.effective_from || "now"}</div>
                                <div>To {item.effective_to || "open"}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            {isEditing ? (
                              <select value={editState.active ? "true" : "false"} onChange={(e) => setEditState((current) => (current ? { ...current, active: e.target.value === "true" } : current))} className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-slate-950 outline-none">
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            ) : item.active ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Active</span>
                            ) : (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">Inactive</span>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <button onClick={saveEdit} disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                                  Save
                                </button>
                                <button onClick={() => setEditState(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => startEdit(item)} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white">
                                  Edit
                                </button>
                                <button onClick={() => deleteItem(item.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white">
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
