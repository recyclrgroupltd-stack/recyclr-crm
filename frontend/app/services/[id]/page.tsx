"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import StaffShell from "../../../components/StaffShell";

type SiteOption = {
  id: number;
  site_name: string;
};

type HaulierOption = {
  id: number;
  name: string;
};

type ChoiceOption = {
  value: string;
  label: string;
};

type ServiceForm = {
  customer_id: number | "";
  site_id: number | "";
  haulier_id: number | "";
  waste_type: string;
  bin_size: string;
  bin_count: string;
  collections_per_week: string;
  lock_required: boolean;
  metal_bin_required: boolean;
  status: string;
  schedule_type: string;
  collection_days: string[];
  schedule_start_date: string;
};

const emptyForm: ServiceForm = {
  customer_id: "",
  site_id: "",
  haulier_id: "",
  waste_type: "general",
  bin_size: "240",
  bin_count: "1",
  collections_per_week: "1",
  lock_required: false,
  metal_bin_required: false,
  status: "active",
  schedule_type: "weekly",
  collection_days: [],
  schedule_start_date: "",
};

function prettyStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normaliseRole(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function canEditServices(role: string) {
  const r = normaliseRole(role);
  return ["admin", "admin1", "admin_1", "manager", "admin_2", "admin2", "operations", "ops"].includes(r);
}

export default function ServiceDetailPage() {
  const params = useParams();
  const serviceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [customerName, setCustomerName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [availableSites, setAvailableSites] = useState<SiteOption[]>([]);
  const [availableHauliers, setAvailableHauliers] = useState<HaulierOption[]>([]);
  const [scheduleTypes, setScheduleTypes] = useState<ChoiceOption[]>([]);
  const [collectionDayChoices, setCollectionDayChoices] = useState<ChoiceOption[]>([]);
  const [pricePerLift, setPricePerLift] = useState(0);
  const [monthlyValue, setMonthlyValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [mounted, setMounted] = useState(false);

  const canEdit = canEditServices(staffRole);

  const showMetalBin =
    form.waste_type === "general" || form.waste_type === "mixed_recycling";
  const showMetalOption =
    showMetalBin && (form.bin_size === "660" || form.bin_size === "1100");

  const allowedBinSizes =
    form.waste_type === "glass" || form.waste_type === "food"
      ? ["240"]
      : ["240", "360", "660", "1100"];

  const requiresScheduleDays = form.schedule_type !== "on_request";

  useEffect(() => {
    const role = window.localStorage.getItem("staff_role") || "";
    setStaffRole(role);
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadService() {
      if (!serviceId) return;

      try {
        setError("");
        const [serviceResponse, setupResponse, createOptionsResponse] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/services/${serviceId}/`, {
            headers: {
              "X-Staff-Username":
                window.localStorage.getItem("staff_username") ||
                window.localStorage.getItem("username") ||
                "",
            },
          }),
          fetch("http://127.0.0.1:8000/api/services/setup-options/", {
            headers: {
              "X-Staff-Username":
                window.localStorage.getItem("staff_username") ||
                window.localStorage.getItem("username") ||
                "",
            },
          }),
          fetch("http://127.0.0.1:8000/api/services/create/options/", {
            headers: {
              "X-Staff-Username":
                window.localStorage.getItem("staff_username") ||
                window.localStorage.getItem("username") ||
                "",
            },
          }),
        ]);

        const data = await serviceResponse.json();
        const setupData = await setupResponse.json();
        const createOptionsData = await createOptionsResponse.json();

        if (!serviceResponse.ok || !data.success) {
          throw new Error(data.message || "Failed to load service.");
        }

        const service = data.service || {};
        const filters = data.filters || setupData.filters || {};
        const sites = Array.isArray(createOptionsData.sites)
          ? createOptionsData.sites.filter((site: SiteOption & { customer_id?: number }) => site.customer_id === service.customer_id)
          : [];

        setForm({
          customer_id: service.customer_id || "",
          site_id: service.site_id || "",
          haulier_id: service.haulier_id || "",
          waste_type: service.waste_type || "general",
          bin_size: service.bin_size || "240",
          bin_count: String(service.bin_count ?? 1),
          collections_per_week: String(service.collections_per_week ?? 1),
          lock_required: Boolean(service.lock_required),
          metal_bin_required: Boolean(service.metal_bin_required),
          status: service.status || "active",
          schedule_type: service.schedule_type || "weekly",
          collection_days: Array.isArray(service.collection_days) ? service.collection_days : [],
          schedule_start_date: service.start_date || "",
        });

        setCustomerName(service.customer_name || "");
        setSiteName(service.site_name || "");
        setAvailableSites(sites);
        setAvailableHauliers(setupData.hauliers || []);
        setScheduleTypes(filters.schedule_types || []);
        setCollectionDayChoices(filters.days || []);
        setPricePerLift(service.price_per_lift || 0);
        setMonthlyValue(service.monthly_value || 0);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load service.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (!mounted) return;
    loadService();
  }, [serviceId, mounted]);

  useEffect(() => {
    if ((form.waste_type === "glass" || form.waste_type === "food") && form.bin_size !== "240") {
      setForm((prev) => ({
        ...prev,
        bin_size: "240",
        metal_bin_required: false,
      }));
    }

    if (!(form.bin_size === "660" || form.bin_size === "1100")) {
      setForm((prev) => ({
        ...prev,
        metal_bin_required: false,
      }));
    }
  }, [form.waste_type, form.bin_size]);

  useEffect(() => {
    if (form.schedule_type === "on_request") {
      setForm((prev) => ({
        ...prev,
        collection_days: [],
        schedule_start_date: "",
      }));
      return;
    }

    if (!form.collection_days.length) {
      setForm((prev) => ({
        ...prev,
        collection_days: ["monday"],
      }));
    }
  }, [form.schedule_type]);

  function toggleCollectionDay(day: string) {
    if (!canEdit || !requiresScheduleDays) return;

    setForm((prev) => {
      const exists = prev.collection_days.includes(day);

      if (exists) {
        return {
          ...prev,
          collection_days: prev.collection_days.filter((item) => item !== day),
        };
      }

      return {
        ...prev,
        collection_days: [...prev.collection_days, day],
      };
    });
  }

  async function handleSave() {
    if (!serviceId || !canEdit) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/services/${serviceId}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Staff-Username":
            window.localStorage.getItem("staff_username") ||
            window.localStorage.getItem("username") ||
            "",
        },
        body: JSON.stringify({
          ...form,
          start_date: form.schedule_start_date || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save service.");
      }

      setMessage("Service saved successfully.");
      setCustomerName(data.service?.customer_name || customerName);
      setSiteName(data.service?.site_name || siteName);
      setPricePerLift(data.service?.price_per_lift || 0);
      setMonthlyValue(data.service?.monthly_value || 0);
      setAvailableSites(data.service?.available_sites || availableSites);
      setAvailableHauliers(data.service?.available_hauliers || availableHauliers);
      setForm((prev) => ({
        ...prev,
        haulier_id: data.service?.haulier_id || "",
        schedule_type: data.service?.schedule_type || prev.schedule_type,
        collection_days: data.service?.collection_days || prev.collection_days,
        schedule_start_date: data.service?.start_date || "",
      }));
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save service.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffShell title={siteName ? `${siteName} Service` : "Service"}>
      {!mounted ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading service...
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading service...
        </div>
      ) : error && !customerName ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="font-black">{error}</div>
          <Link
            href="/services"
            className="mt-4 inline-flex rounded-md bg-white px-4 py-2 text-sm font-black text-red-800 ring-1 ring-red-200 transition hover:bg-red-100"
          >
            Back to Services
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {(message || error) && (
            <div
              className={`rounded-2xl border p-4 backdrop-blur-lg ${
                error
                  ? "border-red-300/30 bg-red-500/20"
                  : "border-emerald-300/30 bg-emerald-500/20"
              }`}
            >
              {error || message}
            </div>
          )}

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{siteName || "Service"}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Service record #{serviceId}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{customerName}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  {prettyStatus(form.status)}
                </span>
                <Link
                  href="/services"
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Back to Services
                </Link>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold">Contract Setup</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Customer</label>
                <input
                  value={customerName}
                  disabled
                  className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Site</label>
                <select
                  value={String(form.site_id)}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      site_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                >
                  {availableSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Waste Type</label>
                <select
                  value={form.waste_type}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      waste_type: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                >
                  <option value="general">General Waste</option>
                  <option value="mixed_recycling">Mixed Recycling</option>
                  <option value="glass">Glass</option>
                  <option value="food">Food</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Bin Size</label>
                <select
                  value={form.bin_size}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bin_size: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                >
                  {allowedBinSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}L
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Bin Count</label>
                <input
                  type="number"
                  min="1"
                  value={form.bin_count}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bin_count: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Collections / Week</label>
                <input
                  type="number"
                  min="1"
                  value={form.collections_per_week}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      collections_per_week: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Price / Lift</label>
                <input
                  value={`GBP ${pricePerLift.toFixed(2)}`}
                  disabled
                  className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Monthly Value</label>
                <input
                  value={`GBP ${monthlyValue.toFixed(2)}`}
                  disabled
                  className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Status</label>
                <select
                  value={form.status}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.lock_required}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      lock_required: e.target.checked,
                    }))
                  }
                />
                <span className="text-sm text-white/90">Lock required</span>
              </label>

              {showMetalOption ? (
                <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.metal_bin_required}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        metal_bin_required: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-white/90">Metal bin required</span>
                </label>
              ) : null}
            </div>

            <div className="mt-8 mb-6">
              <h3 className="text-lg font-semibold">Operational Setup</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Assigned Haulier
                </label>
                <select
                  value={String(form.haulier_id)}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      haulier_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                >
                  <option value="">Leave unassigned for now</option>
                  {availableHauliers.map((haulier) => (
                    <option key={haulier.id} value={haulier.id}>
                      {haulier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Schedule Type</label>
                <select
                  value={form.schedule_type}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      schedule_type: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                >
                  {scheduleTypes.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={requiresScheduleDays ? "" : "opacity-60"}>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Schedule Start Date
                </label>
                <input
                  type="date"
                  value={form.schedule_start_date}
                  disabled={!canEdit || !requiresScheduleDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      schedule_start_date: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                />
              </div>
            </div>

            <div className={`mt-4 ${requiresScheduleDays ? "" : "opacity-60"}`}>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Collection Days
              </label>
              <div className="flex flex-wrap gap-3">
                {collectionDayChoices.map((choice) => {
                  const selected = form.collection_days.includes(choice.value);

                  return (
                    <button
                      key={choice.value}
                      type="button"
                      disabled={!canEdit || !requiresScheduleDays}
                      onClick={() => toggleCollectionDay(choice.value)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? "border-white bg-white text-[#412a8a]"
                          : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                      } disabled:opacity-60`}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              {!requiresScheduleDays ? (
                <p className="mt-2 text-sm text-slate-500">
                  On-request services do not need scheduled collection days.
                </p>
              ) : null}
            </div>

            {canEdit ? (
              <div className="mt-6">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Service"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-500">
                You have view-only access to services.
              </div>
            )}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
