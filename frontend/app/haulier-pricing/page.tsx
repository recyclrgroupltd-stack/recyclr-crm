"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import {
  canEditHauliers,
  canViewHauliers,
  getAuthHeaders,
  getStoredUser,
  StoredUser,
} from "@/lib/auth";

type Haulier = {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  created_at: string;
  rate_count: number;
  portal_user_count: number;
};

type HaulierRate = {
  id: number;
  haulier_id: number;
  haulier_name: string;
  waste_type: string;
  waste_type_label: string;
  bin_size: string;
  bin_size_label: string;
  price_per_lift: number;
  weight_limit_kg: number;
  excess_per_kg: number;
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

type PortalUser = {
  id: number;
  haulier_id: number;
  haulier_name: string;
  full_name: string;
  email: string;
  is_active: boolean;
  must_set_password: boolean;
  can_view_all_sites: boolean;
  notes: string;
  last_login_at: string;
  created_at: string;
};

const wasteOptions = [
  { value: "general", label: "General Waste" },
  { value: "mixed_recycling", label: "Mixed Recycling" },
  { value: "glass", label: "Glass" },
  { value: "food", label: "Food" },
];

const binOptions = [
  { value: "240", label: "240L" },
  { value: "360", label: "360L" },
  { value: "660", label: "660L" },
  { value: "1100", label: "1100L" },
];

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

export default function HaulierPricingPage() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [hauliers, setHauliers] = useState<Haulier[]>([]);
  const [rates, setRates] = useState<HaulierRate[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canView = canViewHauliers(currentUser);
  const canEdit = canEditHauliers(currentUser);

  const [selectedHaulier, setSelectedHaulier] = useState("all");

  const [newHaulier, setNewHaulier] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    notes: "",
    active: true,
  });

  const [newRate, setNewRate] = useState({
    haulier_id: "",
    waste_type: "general",
    bin_size: "1100",
    price_per_lift: "",
    weight_limit_kg: "",
    excess_per_kg: "",
    notes: "",
    active: true,
  });

  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [editRate, setEditRate] = useState({
    haulier_id: "",
    waste_type: "general",
    bin_size: "1100",
    price_per_lift: "",
    weight_limit_kg: "",
    excess_per_kg: "",
    notes: "",
    active: true,
  });

  const [newPortalUser, setNewPortalUser] = useState({
    haulier_id: "",
    full_name: "",
    email: "",
    can_view_all_sites: true,
    notes: "",
  });

  async function loadHauliers() {
    const res = await fetch("http://127.0.0.1:8000/api/hauliers/", { headers: getAuthHeaders() });
    const data = await res.json();
    setHauliers(Array.isArray(data) ? data : []);
  }

  async function loadRates() {
    const params = new URLSearchParams();

    if (selectedHaulier !== "all") {
      params.set("haulier_id", selectedHaulier);
    }

    const res = await fetch(`http://127.0.0.1:8000/api/hauliers/rates/?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    setRates(Array.isArray(data) ? data : []);
  }

  async function loadPortalUsers() {
    const params = new URLSearchParams();

    if (selectedHaulier !== "all") {
      params.set("haulier_id", selectedHaulier);
    }

    const res = await fetch(`http://127.0.0.1:8000/api/hauliers/portal/users/?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    setPortalUsers(Array.isArray(data) ? data : []);
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadHauliers(), loadRates(), loadPortalUsers()]);
    } catch (err) {
      console.error(err);
      setError("Failed to load haulier data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = getStoredUser();
    setCurrentUser(stored);

    if (canViewHauliers(stored)) {
      loadAll();
    } else {
      setLoading(false);
      setError("You do not have permission to view haulier pricing.");
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    loadRates();
    loadPortalUsers();
  }, [selectedHaulier, canView]);

  async function createHaulier() {
    try {
      setMessage("");
      setError("");

      const res = await fetch("http://127.0.0.1:8000/api/hauliers/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(newHaulier),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create haulier.");
      }

      setNewHaulier({
        name: "",
        contact_name: "",
        email: "",
        phone: "",
        notes: "",
        active: true,
      });

      setMessage(data.message || "Haulier created.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create haulier.");
    }
  }

  async function createRate() {
    try {
      setMessage("");
      setError("");

      const res = await fetch("http://127.0.0.1:8000/api/hauliers/rates/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...newRate,
          haulier_id: Number(newRate.haulier_id),
          price_per_lift: newRate.price_per_lift || 0,
          weight_limit_kg: newRate.weight_limit_kg || 0,
          excess_per_kg: newRate.excess_per_kg || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create haulier rate.");
      }

      setNewRate({
        haulier_id: "",
        waste_type: "general",
        bin_size: "1100",
        price_per_lift: "",
        weight_limit_kg: "",
        excess_per_kg: "",
        notes: "",
        active: true,
      });

      setMessage(data.message || "Haulier rate created.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create haulier rate.");
    }
  }

  async function createPortalUser() {
    try {
      setMessage("");
      setError("");

      const res = await fetch("http://127.0.0.1:8000/api/hauliers/portal/users/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...newPortalUser,
          haulier_id: Number(newPortalUser.haulier_id),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create portal user.");
      }

      setNewPortalUser({
        haulier_id: "",
        full_name: "",
        email: "",
        can_view_all_sites: true,
        notes: "",
      });

      setMessage(data.message || "Portal user created.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create portal user.");
    }
  }

  async function resendSetupEmail(userId: number) {
    try {
      setMessage("");
      setError("");

      const res = await fetch(`http://127.0.0.1:8000/api/hauliers/portal/users/${userId}/resend-setup/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to re-send setup email.");
      }

      setMessage(data.message || "Setup email re-sent.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to re-send setup email.");
    }
  }

  function startEdit(rate: HaulierRate) {
    setEditingRateId(rate.id);
    setEditRate({
      haulier_id: String(rate.haulier_id),
      waste_type: rate.waste_type,
      bin_size: rate.bin_size,
      price_per_lift: String(rate.price_per_lift),
      weight_limit_kg: String(rate.weight_limit_kg),
      excess_per_kg: String(rate.excess_per_kg),
      notes: rate.notes || "",
      active: rate.active,
    });
  }

  function cancelEdit() {
    setEditingRateId(null);
    setEditRate({
      haulier_id: "",
      waste_type: "general",
      bin_size: "1100",
      price_per_lift: "",
      weight_limit_kg: "",
      excess_per_kg: "",
      notes: "",
      active: true,
    });
  }

  async function saveEdit(rateId: number) {
    try {
      setMessage("");
      setError("");

      const res = await fetch(`http://127.0.0.1:8000/api/hauliers/rates/${rateId}/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...editRate,
          haulier_id: Number(editRate.haulier_id),
          price_per_lift: editRate.price_per_lift || 0,
          weight_limit_kg: editRate.weight_limit_kg || 0,
          excess_per_kg: editRate.excess_per_kg || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update haulier rate.");
      }

      setMessage(data.message || "Haulier rate updated.");
      setEditingRateId(null);
      await loadRates();
      await loadHauliers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update haulier rate.");
    }
  }

  const displayedRates = useMemo(() => rates, [rates]);
  const displayedPortalUsers = useMemo(() => portalUsers, [portalUsers]);

  return (
    <StaffShell title="Haulier Pricing">
      <div className="space-y-6">
        {(message || error) && (
          <div className="space-y-3">
            {message ? (
              <div className="rounded-lg border border-emerald-200 bg-white p-4 font-semibold text-emerald-700 shadow-sm">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Add Haulier</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Add a haulier / supplier company to use later in rates, reporting and portal users.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Haulier Name</label>
                  <input
                    value={newHaulier.name}
                    onChange={(e) => setNewHaulier((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Contact Name</label>
                    <input
                      value={newHaulier.contact_name}
                      onChange={(e) =>
                        setNewHaulier((current) => ({ ...current, contact_name: e.target.value }))
                      }
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Phone</label>
                    <input
                      value={newHaulier.phone}
                      onChange={(e) => setNewHaulier((current) => ({ ...current, phone: e.target.value }))}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
                  <input
                    value={newHaulier.email}
                    onChange={(e) => setNewHaulier((current) => ({ ...current, email: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Notes</label>
                  <textarea
                    value={newHaulier.notes}
                    onChange={(e) => setNewHaulier((current) => ({ ...current, notes: e.target.value }))}
                    rows={5}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <button
                    onClick={createHaulier}
                    disabled={!canEdit}
                    className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Haulier
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Add Haulier Rate</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Add a new saved rate for a haulier.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Haulier</label>
                  <select
                    value={newRate.haulier_id}
                    onChange={(e) => setNewRate((current) => ({ ...current, haulier_id: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  >
                    <option value="" className="bg-white text-black">
                      Select haulier
                    </option>
                    {hauliers.map((haulier) => (
                      <option key={haulier.id} value={haulier.id} className="bg-white text-black">
                        {haulier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Waste Type</label>
                    <select
                      value={newRate.waste_type}
                      onChange={(e) => setNewRate((current) => ({ ...current, waste_type: e.target.value }))}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      {wasteOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-white text-black">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Bin Size</label>
                    <select
                      value={newRate.bin_size}
                      onChange={(e) => setNewRate((current) => ({ ...current, bin_size: e.target.value }))}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      {binOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-white text-black">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Lift Rate (GBP )</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newRate.price_per_lift}
                      onChange={(e) => setNewRate((current) => ({ ...current, price_per_lift: e.target.value }))}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Weight Limit (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newRate.weight_limit_kg}
                      onChange={(e) => setNewRate((current) => ({ ...current, weight_limit_kg: e.target.value }))}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Excess per kg (GBP )</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newRate.excess_per_kg}
                      onChange={(e) => setNewRate((current) => ({ ...current, excess_per_kg: e.target.value }))}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Notes</label>
                  <textarea
                    value={newRate.notes}
                    onChange={(e) => setNewRate((current) => ({ ...current, notes: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <button
                    onClick={createRate}
                    disabled={!canEdit}
                    className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Haulier Rate
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Add Portal User</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Create a haulier portal user and send them a create-password email automatically.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Haulier</label>
                  <select
                    value={newPortalUser.haulier_id}
                    onChange={(e) => setNewPortalUser((current) => ({ ...current, haulier_id: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  >
                    <option value="" className="bg-white text-black">
                      Select haulier
                    </option>
                    {hauliers.map((haulier) => (
                      <option key={haulier.id} value={haulier.id} className="bg-white text-black">
                        {haulier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Full Name</label>
                  <input
                    value={newPortalUser.full_name}
                    onChange={(e) => setNewPortalUser((current) => ({ ...current, full_name: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
                  <input
                    value={newPortalUser.email}
                    onChange={(e) => setNewPortalUser((current) => ({ ...current, email: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={newPortalUser.can_view_all_sites}
                    onChange={(e) =>
                      setNewPortalUser((current) => ({
                        ...current,
                        can_view_all_sites: e.target.checked,
                      }))
                    }
                  />
                  Can view all sites
                </label>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Notes</label>
                  <textarea
                    value={newPortalUser.notes}
                    onChange={(e) => setNewPortalUser((current) => ({ ...current, notes: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <button
                    onClick={createPortalUser}
                    disabled={!canEdit}
                    className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Create Portal User
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm min-w-0">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Manage Rates</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Select a haulier to view and edit their stored rates.
                  </p>
                </div>

                <div className="w-full xl:w-[280px]">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Haulier
                  </label>
                  <select
                    value={selectedHaulier}
                    onChange={(e) => setSelectedHaulier(e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  >
                    <option value="all" className="bg-white text-black">
                      All hauliers
                    </option>
                    {hauliers.map((haulier) => (
                      <option key={haulier.id} value={haulier.id} className="bg-white text-black">
                        {haulier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-800">
                    <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Haulier</th>
                        <th className="px-4 py-3 font-medium">Waste</th>
                        <th className="px-4 py-3 font-medium">Bin</th>
                        <th className="px-4 py-3 font-medium">Lift</th>
                        <th className="px-4 py-3 font-medium">Weight</th>
                        <th className="px-4 py-3 font-medium">Excess</th>
                        <th className="px-4 py-3 font-medium">Notes</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRates.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            No rates found.
                          </td>
                        </tr>
                      ) : (
                        displayedRates.map((rate) => (
                          <tr key={rate.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                            {editingRateId === rate.id ? (
                              <>
                                <td className="px-4 py-3">
                                  <select
                                    value={editRate.haulier_id}
                                    onChange={(e) => setEditRate((current) => ({ ...current, haulier_id: e.target.value }))}
                                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  >
                                    {hauliers.map((haulier) => (
                                      <option key={haulier.id} value={haulier.id} className="bg-white text-black">
                                        {haulier.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={editRate.waste_type}
                                    onChange={(e) => setEditRate((current) => ({ ...current, waste_type: e.target.value }))}
                                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  >
                                    {wasteOptions.map((option) => (
                                      <option key={option.value} value={option.value} className="bg-white text-black">
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={editRate.bin_size}
                                    onChange={(e) => setEditRate((current) => ({ ...current, bin_size: e.target.value }))}
                                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  >
                                    {binOptions.map((option) => (
                                      <option key={option.value} value={option.value} className="bg-white text-black">
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editRate.price_per_lift}
                                    onChange={(e) => setEditRate((current) => ({ ...current, price_per_lift: e.target.value }))}
                                    className="w-28 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editRate.weight_limit_kg}
                                    onChange={(e) => setEditRate((current) => ({ ...current, weight_limit_kg: e.target.value }))}
                                    className="w-28 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editRate.excess_per_kg}
                                    onChange={(e) => setEditRate((current) => ({ ...current, excess_per_kg: e.target.value }))}
                                    className="w-28 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    value={editRate.notes}
                                    onChange={(e) => setEditRate((current) => ({ ...current, notes: e.target.value }))}
                                    className="w-full min-w-[200px] rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-slate-950 outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveEdit(rate.id)}
                                      className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 font-bold text-violet-700">{rate.haulier_name}</td>
                                <td className="px-4 py-3">{rate.waste_type_label}</td>
                                <td className="px-4 py-3 font-semibold">{rate.bin_size_label}</td>
                                <td className="px-4 py-3 font-semibold">{formatMoney(rate.price_per_lift)}</td>
                                <td className="px-4 py-3">{rate.weight_limit_kg} kg</td>
                                <td className="px-4 py-3">{formatMoney(rate.excess_per_kg)}</td>
                                <td className="px-4 py-3 text-slate-600">{rate.notes || "-"}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => startEdit(rate)}
                                    disabled={!canEdit}
                                    className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm min-w-0">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Portal Users</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Create and manage haulier portal users. New users receive a create-password email automatically.
                  </p>
                </div>

                <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800">
                  {displayedPortalUsers.length} user{displayedPortalUsers.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-800">
                    <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Haulier</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Password</th>
                        <th className="px-4 py-3 font-medium">Last Login</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPortalUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No portal users found.
                          </td>
                        </tr>
                      ) : (
                        displayedPortalUsers.map((user) => (
                          <tr key={user.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                            <td className="px-4 py-3 font-bold text-violet-700">{user.full_name}</td>
                            <td className="px-4 py-3">{user.email}</td>
                            <td className="px-4 py-3 font-semibold">{user.haulier_name}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                                {user.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                                {user.must_set_password ? "Setup pending" : "Set"}
                              </span>
                            </td>
                            <td className="px-4 py-3">{formatDateTime(user.last_login_at)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => resendSetupEmail(user.id)}
                                disabled={!canEdit}
                                className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Re-send Setup
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-violet-100 bg-white p-6 text-slate-500 shadow-sm">
            Loading haulier data...
          </div>
        ) : null}
      </div>
    </StaffShell>
  );
}
