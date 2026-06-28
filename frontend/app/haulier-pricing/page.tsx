"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
  emergency_phone: string;
  website: string;
  address: string;
  account_reference: string;
  payment_terms_days: number;
  waste_carrier_license: string;
  environmental_permit: string;
  insurance_expiry: string;
  sla_notes: string;
  notes: string;
  active: boolean;
  created_at: string;
  rate_count: number;
  coverage_count: number;
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

type HaulierCoverage = {
  id: number;
  haulier_id: number;
  haulier_name: string;
  waste_type: string;
  waste_type_label: string;
  postcode_area: string;
  collection_days: string[];
  service_type: string;
  service_type_label: string;
  lead_time_days: number;
  minimum_lift_charge: number;
  fuel_surcharge_percent: number;
  requires_po: boolean;
  booking_cutoff: string;
  vehicle_notes: string;
  restrictions: string;
  active: boolean;
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
  { value: "cardboard", label: "Cardboard" },
  { value: "glass", label: "Glass" },
  { value: "food", label: "Food" },
  { value: "paper", label: "Paper" },
];

const binOptions = [
  { value: "240", label: "240L" },
  { value: "360", label: "360L" },
  { value: "660", label: "660L" },
  { value: "1100", label: "1100L" },
];

const dayOptions = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const serviceTypeOptions = [
  { value: "scheduled", label: "Scheduled" },
  { value: "adhoc", label: "Ad hoc" },
  { value: "both", label: "Scheduled and ad hoc" },
];

const emptyHaulier = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  emergency_phone: "",
  website: "",
  address: "",
  account_reference: "",
  payment_terms_days: "30",
  waste_carrier_license: "",
  environmental_permit: "",
  insurance_expiry: "",
  sla_notes: "",
  notes: "",
  active: true,
};

const emptyRate = {
  haulier_id: "",
  waste_type: "general",
  bin_size: "1100",
  price_per_lift: "",
  weight_limit_kg: "",
  excess_per_kg: "",
  notes: "",
  active: true,
};

const emptyCoverage = {
  haulier_id: "",
  waste_type: "general",
  postcode_area: "",
  collection_days: [] as string[],
  service_type: "scheduled",
  lead_time_days: "2",
  minimum_lift_charge: "",
  fuel_surcharge_percent: "",
  requires_po: false,
  booking_cutoff: "",
  vehicle_notes: "",
  restrictions: "",
  active: true,
};

const emptyPortalUser = {
  haulier_id: "",
  full_name: "",
  email: "",
  can_view_all_sites: true,
  notes: "",
};

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

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned a non-JSON response. Please redeploy the backend.");
  }
}

function toggleDay(days: string[], day: string) {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
}

function daysLabel(days: string[]) {
  if (!days || days.length === 0) return "No regular day";
  return dayOptions.filter((day) => days.includes(day.value)).map((day) => day.label).join(", ");
}

export default function HaulierPricingPage() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [hauliers, setHauliers] = useState<Haulier[]>([]);
  const [rates, setRates] = useState<HaulierRate[]>([]);
  const [coverageEntries, setCoverageEntries] = useState<HaulierCoverage[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [selectedHaulier, setSelectedHaulier] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newHaulier, setNewHaulier] = useState(emptyHaulier);
  const [newRate, setNewRate] = useState(emptyRate);
  const [newCoverage, setNewCoverage] = useState(emptyCoverage);
  const [newPortalUser, setNewPortalUser] = useState(emptyPortalUser);
  const [editingCoverageId, setEditingCoverageId] = useState<number | null>(null);
  const [editCoverage, setEditCoverage] = useState(emptyCoverage);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [editRate, setEditRate] = useState(emptyRate);

  const canView = canViewHauliers(currentUser);
  const canEdit = canEditHauliers(currentUser);

  async function loadHauliers() {
    const res = await fetch("/api/hauliers/", { headers: getAuthHeaders() });
    const data = await readJson(res);
    setHauliers(Array.isArray(data) ? data : []);
  }

  async function loadRates() {
    const params = new URLSearchParams();
    if (selectedHaulier !== "all") params.set("haulier_id", selectedHaulier);
    const res = await fetch(`/api/hauliers/rates/?${params.toString()}`, { headers: getAuthHeaders() });
    const data = await readJson(res);
    setRates(Array.isArray(data) ? data : []);
  }

  async function loadCoverage() {
    const params = new URLSearchParams();
    if (selectedHaulier !== "all") params.set("haulier_id", selectedHaulier);
    const res = await fetch(`/api/hauliers/coverage/?${params.toString()}`, { headers: getAuthHeaders() });
    const data = await readJson(res);
    setCoverageEntries(Array.isArray(data) ? data : []);
  }

  async function loadPortalUsers() {
    const params = new URLSearchParams();
    if (selectedHaulier !== "all") params.set("haulier_id", selectedHaulier);
    const res = await fetch(`/api/hauliers/portal/users/?${params.toString()}`, { headers: getAuthHeaders() });
    const data = await readJson(res);
    setPortalUsers(Array.isArray(data) ? data : []);
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadHauliers(), loadRates(), loadCoverage(), loadPortalUsers()]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load haulier network data.");
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
      setError("You do not have permission to view hauliers.");
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    loadRates();
    loadCoverage();
    loadPortalUsers();
  }, [selectedHaulier, canView]);

  const selectedHaulierName = useMemo(() => {
    if (selectedHaulier === "all") return "All hauliers";
    return hauliers.find((haulier) => String(haulier.id) === selectedHaulier)?.name || "Selected haulier";
  }, [hauliers, selectedHaulier]);

  const activeHauliers = hauliers.filter((haulier) => haulier.active).length;
  const activeCoverage = coverageEntries.filter((entry) => entry.active).length;
  const activeRates = rates.filter((rate) => rate.active).length;

  async function createHaulier() {
    try {
      setMessage("");
      setError("");
      const res = await fetch("/api/hauliers/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...newHaulier, payment_terms_days: Number(newHaulier.payment_terms_days || 30) }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create haulier.");
      setNewHaulier(emptyHaulier);
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
      const res = await fetch("/api/hauliers/rates/", {
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
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create haulier rate.");
      setNewRate(emptyRate);
      setMessage(data.message || "Haulier rate created.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create haulier rate.");
    }
  }

  async function createCoverage() {
    try {
      setMessage("");
      setError("");
      const res = await fetch("/api/hauliers/coverage/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...newCoverage,
          haulier_id: Number(newCoverage.haulier_id),
          lead_time_days: Number(newCoverage.lead_time_days || 2),
          minimum_lift_charge: newCoverage.minimum_lift_charge || 0,
          fuel_surcharge_percent: newCoverage.fuel_surcharge_percent || 0,
        }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to add coverage.");
      setNewCoverage(emptyCoverage);
      setMessage(data.message || "Coverage added.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to add coverage.");
    }
  }

  async function createPortalUser() {
    try {
      setMessage("");
      setError("");
      const res = await fetch("/api/hauliers/portal/users/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...newPortalUser, haulier_id: Number(newPortalUser.haulier_id) }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create portal user.");
      setNewPortalUser(emptyPortalUser);
      setMessage(data.message || "Portal user created.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create portal user.");
    }
  }

  function startEditRate(rate: HaulierRate) {
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

  async function saveRate(rateId: number) {
    try {
      setMessage("");
      setError("");
      const res = await fetch(`/api/hauliers/rates/${rateId}/`, {
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
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update rate.");
      setEditingRateId(null);
      setMessage(data.message || "Rate updated.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update rate.");
    }
  }

  function startEditCoverage(entry: HaulierCoverage) {
    setEditingCoverageId(entry.id);
    setEditCoverage({
      haulier_id: String(entry.haulier_id),
      waste_type: entry.waste_type,
      postcode_area: entry.postcode_area,
      collection_days: entry.collection_days || [],
      service_type: entry.service_type,
      lead_time_days: String(entry.lead_time_days),
      minimum_lift_charge: String(entry.minimum_lift_charge),
      fuel_surcharge_percent: String(entry.fuel_surcharge_percent),
      requires_po: entry.requires_po,
      booking_cutoff: entry.booking_cutoff || "",
      vehicle_notes: entry.vehicle_notes || "",
      restrictions: entry.restrictions || "",
      active: entry.active,
    });
  }

  async function saveCoverage(coverageId: number) {
    try {
      setMessage("");
      setError("");
      const res = await fetch(`/api/hauliers/coverage/${coverageId}/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...editCoverage,
          haulier_id: Number(editCoverage.haulier_id),
          lead_time_days: Number(editCoverage.lead_time_days || 2),
          minimum_lift_charge: editCoverage.minimum_lift_charge || 0,
          fuel_surcharge_percent: editCoverage.fuel_surcharge_percent || 0,
        }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update coverage.");
      setEditingCoverageId(null);
      setMessage(data.message || "Coverage updated.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update coverage.");
    }
  }

  async function deleteCoverage(coverageId: number) {
    if (!confirm("Remove this haulier coverage entry?")) return;
    try {
      setMessage("");
      setError("");
      const res = await fetch(`/api/hauliers/coverage/${coverageId}/`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to remove coverage.");
      setMessage(data.message || "Coverage removed.");
      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to remove coverage.");
    }
  }

  async function resendSetupEmail(userId: number) {
    try {
      setMessage("");
      setError("");
      const res = await fetch(`/api/hauliers/portal/users/${userId}/resend-setup/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to re-send setup email.");
      setMessage(data.message || "Setup email re-sent.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to re-send setup email.");
    }
  }

  const inputClass = "w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none";
  const labelClass = "mb-2 block text-xs font-black uppercase tracking-wide text-slate-400";

  return (
    <StaffShell title="Hauliers">
      <div className="space-y-6">
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-950">Haulier Network</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Manage hauliers, pricing, service coverage, collection days, portal users, and operational rules.
              </p>
            </div>
            <div className="w-full xl:w-[320px]">
              <label className={labelClass}>Network Filter</label>
              <select value={selectedHaulier} onChange={(e) => setSelectedHaulier(e.target.value)} className={inputClass}>
                <option value="all" className="bg-white text-black">All hauliers</option>
                {hauliers.map((haulier) => (
                  <option key={haulier.id} value={haulier.id} className="bg-white text-black">
                    {haulier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className="space-y-3">
            {message ? <div className="rounded-lg border border-emerald-200 bg-white p-4 font-semibold text-emerald-700 shadow-sm">{message}</div> : null}
            {error ? <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">{error}</div> : null}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Active hauliers" value={activeHauliers} />
          <SummaryCard label="Coverage rules" value={activeCoverage} />
          <SummaryCard label="Saved rates" value={activeRates} />
          <SummaryCard label="Portal users" value={portalUsers.length} />
          <SummaryCard label="Filtered view" value={selectedHaulierName} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Panel title="Add Haulier" subtitle="Store the supplier profile, compliance notes, and operations contact details.">
              <div className="space-y-4">
                <Field label="Haulier Name" value={newHaulier.name} onChange={(value) => setNewHaulier((current) => ({ ...current, name: value }))} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Contact Name" value={newHaulier.contact_name} onChange={(value) => setNewHaulier((current) => ({ ...current, contact_name: value }))} />
                  <Field label="Phone" value={newHaulier.phone} onChange={(value) => setNewHaulier((current) => ({ ...current, phone: value }))} />
                </div>
                <Field label="Email" value={newHaulier.email} onChange={(value) => setNewHaulier((current) => ({ ...current, email: value }))} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Emergency Phone" value={newHaulier.emergency_phone} onChange={(value) => setNewHaulier((current) => ({ ...current, emergency_phone: value }))} />
                  <Field label="Account Ref" value={newHaulier.account_reference} onChange={(value) => setNewHaulier((current) => ({ ...current, account_reference: value }))} />
                </div>
                <Field label="Website" value={newHaulier.website} onChange={(value) => setNewHaulier((current) => ({ ...current, website: value }))} />
                <TextArea label="Address" value={newHaulier.address} onChange={(value) => setNewHaulier((current) => ({ ...current, address: value }))} rows={3} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Payment Terms Days" type="number" value={newHaulier.payment_terms_days} onChange={(value) => setNewHaulier((current) => ({ ...current, payment_terms_days: value }))} />
                  <Field label="Insurance Expiry" type="date" value={newHaulier.insurance_expiry} onChange={(value) => setNewHaulier((current) => ({ ...current, insurance_expiry: value }))} />
                </div>
                <Field label="Waste Carrier Licence" value={newHaulier.waste_carrier_license} onChange={(value) => setNewHaulier((current) => ({ ...current, waste_carrier_license: value }))} />
                <Field label="Environmental Permit" value={newHaulier.environmental_permit} onChange={(value) => setNewHaulier((current) => ({ ...current, environmental_permit: value }))} />
                <TextArea label="SLA / Booking Notes" value={newHaulier.sla_notes} onChange={(value) => setNewHaulier((current) => ({ ...current, sla_notes: value }))} rows={3} />
                <TextArea label="General Notes" value={newHaulier.notes} onChange={(value) => setNewHaulier((current) => ({ ...current, notes: value }))} rows={3} />
                <button onClick={createHaulier} disabled={!canEdit} className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  Save Haulier
                </button>
              </div>
            </Panel>

            <Panel title="Add Rate" subtitle="Price per stream and bin size. This feeds quotes and margin checks.">
              <div className="space-y-4">
                <SelectField label="Haulier" value={newRate.haulier_id} onChange={(value) => setNewRate((current) => ({ ...current, haulier_id: value }))}>
                  <option value="" className="bg-white text-black">Select haulier</option>
                  {hauliers.map((haulier) => <option key={haulier.id} value={haulier.id} className="bg-white text-black">{haulier.name}</option>)}
                </SelectField>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField label="Waste Stream" value={newRate.waste_type} onChange={(value) => setNewRate((current) => ({ ...current, waste_type: value }))}>
                    {wasteOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                  </SelectField>
                  <SelectField label="Bin Size" value={newRate.bin_size} onChange={(value) => setNewRate((current) => ({ ...current, bin_size: value }))}>
                    {binOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                  </SelectField>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Lift Rate" type="number" value={newRate.price_per_lift} onChange={(value) => setNewRate((current) => ({ ...current, price_per_lift: value }))} />
                  <Field label="Weight Limit Kg" type="number" value={newRate.weight_limit_kg} onChange={(value) => setNewRate((current) => ({ ...current, weight_limit_kg: value }))} />
                  <Field label="Excess Per Kg" type="number" value={newRate.excess_per_kg} onChange={(value) => setNewRate((current) => ({ ...current, excess_per_kg: value }))} />
                </div>
                <TextArea label="Rate Notes" value={newRate.notes} onChange={(value) => setNewRate((current) => ({ ...current, notes: value }))} rows={3} />
                <button onClick={createRate} disabled={!canEdit} className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  Save Rate
                </button>
              </div>
            </Panel>

            <Panel title="Add Coverage" subtitle="Where a haulier works, what stream they collect, and what days they run.">
              <div className="space-y-4">
                <SelectField label="Haulier" value={newCoverage.haulier_id} onChange={(value) => setNewCoverage((current) => ({ ...current, haulier_id: value }))}>
                  <option value="" className="bg-white text-black">Select haulier</option>
                  {hauliers.map((haulier) => <option key={haulier.id} value={haulier.id} className="bg-white text-black">{haulier.name}</option>)}
                </SelectField>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField label="Waste Stream" value={newCoverage.waste_type} onChange={(value) => setNewCoverage((current) => ({ ...current, waste_type: value }))}>
                    {wasteOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                  </SelectField>
                  <Field label="Postcode Area" value={newCoverage.postcode_area} placeholder="LE, LE1, NG*, CV1-CV6" onChange={(value) => setNewCoverage((current) => ({ ...current, postcode_area: value }))} />
                </div>
                <DayPicker days={newCoverage.collection_days} onChange={(day) => setNewCoverage((current) => ({ ...current, collection_days: toggleDay(current.collection_days, day) }))} />
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField label="Service Type" value={newCoverage.service_type} onChange={(value) => setNewCoverage((current) => ({ ...current, service_type: value }))}>
                    {serviceTypeOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                  </SelectField>
                  <Field label="Lead Time Days" type="number" value={newCoverage.lead_time_days} onChange={(value) => setNewCoverage((current) => ({ ...current, lead_time_days: value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Minimum Lift Charge" type="number" value={newCoverage.minimum_lift_charge} onChange={(value) => setNewCoverage((current) => ({ ...current, minimum_lift_charge: value }))} />
                  <Field label="Fuel Surcharge %" type="number" value={newCoverage.fuel_surcharge_percent} onChange={(value) => setNewCoverage((current) => ({ ...current, fuel_surcharge_percent: value }))} />
                </div>
                <Field label="Booking Cutoff" value={newCoverage.booking_cutoff} placeholder="Before 2pm day before" onChange={(value) => setNewCoverage((current) => ({ ...current, booking_cutoff: value }))} />
                <label className="flex items-center gap-3 rounded-lg bg-violet-50 p-3 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={newCoverage.requires_po} onChange={(e) => setNewCoverage((current) => ({ ...current, requires_po: e.target.checked }))} />
                  Haulier requires PO for bookings
                </label>
                <TextArea label="Vehicle / Access Notes" value={newCoverage.vehicle_notes} onChange={(value) => setNewCoverage((current) => ({ ...current, vehicle_notes: value }))} rows={3} />
                <TextArea label="Restrictions" value={newCoverage.restrictions} onChange={(value) => setNewCoverage((current) => ({ ...current, restrictions: value }))} rows={3} />
                <button onClick={createCoverage} disabled={!canEdit} className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  Save Coverage
                </button>
              </div>
            </Panel>

            <Panel title="Add Portal User" subtitle="Give hauliers access to their job portal.">
              <div className="space-y-4">
                <SelectField label="Haulier" value={newPortalUser.haulier_id} onChange={(value) => setNewPortalUser((current) => ({ ...current, haulier_id: value }))}>
                  <option value="" className="bg-white text-black">Select haulier</option>
                  {hauliers.map((haulier) => <option key={haulier.id} value={haulier.id} className="bg-white text-black">{haulier.name}</option>)}
                </SelectField>
                <Field label="Full Name" value={newPortalUser.full_name} onChange={(value) => setNewPortalUser((current) => ({ ...current, full_name: value }))} />
                <Field label="Email" value={newPortalUser.email} onChange={(value) => setNewPortalUser((current) => ({ ...current, email: value }))} />
                <label className="flex items-center gap-3 rounded-lg bg-violet-50 p-3 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={newPortalUser.can_view_all_sites} onChange={(e) => setNewPortalUser((current) => ({ ...current, can_view_all_sites: e.target.checked }))} />
                  Can view all sites
                </label>
                <TextArea label="Notes" value={newPortalUser.notes} onChange={(value) => setNewPortalUser((current) => ({ ...current, notes: value }))} rows={3} />
                <button onClick={createPortalUser} disabled={!canEdit} className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  Create Portal User
                </button>
              </div>
            </Panel>
          </div>

          <div className="min-w-0 space-y-6">
            <Panel title="Haulier Directory" subtitle="Operational profile and coverage health.">
              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Haulier</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Compliance</th>
                      <th className="px-4 py-3">Coverage</th>
                      <th className="px-4 py-3">Rates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hauliers.length === 0 ? (
                      <EmptyRow colSpan={5} text="No hauliers found." />
                    ) : (
                      hauliers.map((haulier) => (
                        <tr key={haulier.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                          <td className="px-4 py-3">
                            <div className="font-black text-violet-700">{haulier.name}</div>
                            <div className="text-xs text-slate-500">{haulier.account_reference || "No account ref"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{haulier.contact_name || "-"}</div>
                            <div className="text-xs text-slate-500">{haulier.email || haulier.phone || "-"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs">Carrier: {haulier.waste_carrier_license || "-"}</div>
                            <div className="text-xs">Insurance: {haulier.insurance_expiry || "-"}</div>
                          </td>
                          <td className="px-4 py-3 font-bold">{haulier.coverage_count}</td>
                          <td className="px-4 py-3 font-bold">{haulier.rate_count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>

            <Panel title="Coverage & Collection Days" subtitle="Use this to see who can collect each stream, in each area, on each day.">
              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Haulier</th>
                      <th className="px-4 py-3">Stream</th>
                      <th className="px-4 py-3">Postcodes</th>
                      <th className="px-4 py-3">Days</th>
                      <th className="px-4 py-3">Rules</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageEntries.length === 0 ? (
                      <EmptyRow colSpan={6} text="No coverage rules found." />
                    ) : (
                      coverageEntries.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100 align-top hover:bg-violet-50/60">
                          {editingCoverageId === entry.id ? (
                            <>
                              <td className="px-4 py-3">
                                <select value={editCoverage.haulier_id} onChange={(e) => setEditCoverage((current) => ({ ...current, haulier_id: e.target.value }))} className={inputClass}>
                                  {hauliers.map((haulier) => <option key={haulier.id} value={haulier.id} className="bg-white text-black">{haulier.name}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <select value={editCoverage.waste_type} onChange={(e) => setEditCoverage((current) => ({ ...current, waste_type: e.target.value }))} className={inputClass}>
                                  {wasteOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <input value={editCoverage.postcode_area} onChange={(e) => setEditCoverage((current) => ({ ...current, postcode_area: e.target.value }))} className={inputClass} />
                              </td>
                              <td className="px-4 py-3"><DayPicker days={editCoverage.collection_days} compact onChange={(day) => setEditCoverage((current) => ({ ...current, collection_days: toggleDay(current.collection_days, day) }))} /></td>
                              <td className="px-4 py-3">
                                <div className="grid gap-2">
                                  <select value={editCoverage.service_type} onChange={(e) => setEditCoverage((current) => ({ ...current, service_type: e.target.value }))} className={inputClass}>
                                    {serviceTypeOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                                  </select>
                                  <input type="number" value={editCoverage.lead_time_days} onChange={(e) => setEditCoverage((current) => ({ ...current, lead_time_days: e.target.value }))} className={inputClass} />
                                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                    <input type="checkbox" checked={editCoverage.requires_po} onChange={(e) => setEditCoverage((current) => ({ ...current, requires_po: e.target.checked }))} />
                                    PO required
                                  </label>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => saveCoverage(entry.id)} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white">Save</button>
                                  <button onClick={() => setEditingCoverageId(null)} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700">Cancel</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-violet-700">{entry.haulier_name}</td>
                              <td className="px-4 py-3">{entry.waste_type_label}</td>
                              <td className="px-4 py-3 font-black">{entry.postcode_area}</td>
                              <td className="px-4 py-3">{daysLabel(entry.collection_days)}</td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                <div>{entry.service_type_label}</div>
                                <div>{entry.lead_time_days} day lead time</div>
                                <div>{entry.requires_po ? "PO required" : "No PO required"}</div>
                                {entry.booking_cutoff ? <div>Cutoff: {entry.booking_cutoff}</div> : null}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => startEditCoverage(entry)} disabled={!canEdit} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Edit</button>
                                  <button onClick={() => deleteCoverage(entry.id)} disabled={!canEdit} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Remove</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>

            <Panel title="Pricing Matrix" subtitle="Stored supplier costs for quote and margin checks.">
              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Haulier</th>
                      <th className="px-4 py-3">Stream</th>
                      <th className="px-4 py-3">Bin</th>
                      <th className="px-4 py-3">Lift</th>
                      <th className="px-4 py-3">Weight</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.length === 0 ? (
                      <EmptyRow colSpan={6} text="No rates found." />
                    ) : (
                      rates.map((rate) => (
                        <tr key={rate.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                          {editingRateId === rate.id ? (
                            <>
                              <td className="px-4 py-3">
                                <select value={editRate.haulier_id} onChange={(e) => setEditRate((current) => ({ ...current, haulier_id: e.target.value }))} className={inputClass}>
                                  {hauliers.map((haulier) => <option key={haulier.id} value={haulier.id} className="bg-white text-black">{haulier.name}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <select value={editRate.waste_type} onChange={(e) => setEditRate((current) => ({ ...current, waste_type: e.target.value }))} className={inputClass}>
                                  {wasteOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <select value={editRate.bin_size} onChange={(e) => setEditRate((current) => ({ ...current, bin_size: e.target.value }))} className={inputClass}>
                                  {binOptions.map((option) => <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-3"><input type="number" value={editRate.price_per_lift} onChange={(e) => setEditRate((current) => ({ ...current, price_per_lift: e.target.value }))} className={inputClass} /></td>
                              <td className="px-4 py-3"><input type="number" value={editRate.weight_limit_kg} onChange={(e) => setEditRate((current) => ({ ...current, weight_limit_kg: e.target.value }))} className={inputClass} /></td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => saveRate(rate.id)} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white">Save</button>
                                  <button onClick={() => setEditingRateId(null)} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700">Cancel</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-violet-700">{rate.haulier_name}</td>
                              <td className="px-4 py-3">{rate.waste_type_label}</td>
                              <td className="px-4 py-3">{rate.bin_size_label}</td>
                              <td className="px-4 py-3 font-bold">{formatMoney(rate.price_per_lift)}</td>
                              <td className="px-4 py-3">{rate.weight_limit_kg} kg</td>
                              <td className="px-4 py-3"><button onClick={() => startEditRate(rate)} disabled={!canEdit} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Edit</button></td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>

            <Panel title="Portal Users" subtitle="Haulier contacts with portal access.">
              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Haulier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Login</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portalUsers.length === 0 ? (
                      <EmptyRow colSpan={5} text="No portal users found." />
                    ) : (
                      portalUsers.map((user) => (
                        <tr key={user.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                          <td className="px-4 py-3">
                            <div className="font-bold text-violet-700">{user.full_name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </td>
                          <td className="px-4 py-3">{user.haulier_name}</td>
                          <td className="px-4 py-3">{user.is_active ? "Active" : "Inactive"} / {user.must_set_password ? "Setup pending" : "Password set"}</td>
                          <td className="px-4 py-3">{formatDateTime(user.last_login_at)}</td>
                          <td className="px-4 py-3"><button onClick={() => resendSetupEmail(user.id)} disabled={!canEdit} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Re-send Setup</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          </div>
        </div>

        {loading ? <div className="rounded-lg border border-violet-100 bg-white p-6 text-slate-500 shadow-sm">Loading haulier network...</div> : null}
      </div>
    </StaffShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-black">{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
      >
        {children}
      </select>
    </div>
  );
}

function DayPicker({ days, onChange, compact = false }: { days: string[]; onChange: (day: string) => void; compact?: boolean }) {
  return (
    <div>
      {!compact ? <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Collection Days</label> : null}
      <div className="flex flex-wrap gap-2">
        {dayOptions.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => onChange(day.value)}
            className={`rounded-lg px-3 py-2 text-xs font-black ${
              days.includes(day.value)
                ? "bg-violet-700 text-white"
                : "border border-violet-100 bg-violet-50 text-violet-700"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-slate-200"><div className="overflow-x-auto">{children}</div></div>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
        {text}
      </td>
    </tr>
  );
}
