"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StaffShell from "../../../components/StaffShell";

type CustomerOption = {
  id: number;
  business_name: string;
};

type SiteOption = {
  id: number;
  customer_id: number;
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
  collection_days: ["monday"],
  schedule_start_date: "",
};

function normaliseRole(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function canEditServices(role: string) {
  const r = normaliseRole(role);
  return ["admin", "admin1", "admin_1", "manager", "admin_2", "admin2", "operations", "ops"].includes(r);
}

export default function NewServicePage() {
  const router = useRouter();

  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [hauliers, setHauliers] = useState<HaulierOption[]>([]);
  const [scheduleTypes, setScheduleTypes] = useState<ChoiceOption[]>([]);
  const [collectionDayChoices, setCollectionDayChoices] = useState<ChoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [mounted, setMounted] = useState(false);

  const canEdit = canEditServices(staffRole);

  const filteredSites = useMemo(() => {
    if (!form.customer_id) return [];
    return sites.filter((site) => site.customer_id === Number(form.customer_id));
  }, [sites, form.customer_id]);

  const allowedBinSizes =
    form.waste_type === "glass" || form.waste_type === "food"
      ? ["240"]
      : ["240", "360", "660", "1100"];

  const showMetalOption =
    (form.waste_type === "general" || form.waste_type === "mixed_recycling") &&
    (form.bin_size === "660" || form.bin_size === "1100");

  const requiresScheduleDays = form.schedule_type !== "on_request";

  useEffect(() => {
    const role = window.localStorage.getItem("staff_role") || "";
    setStaffRole(role);
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/services/create/options/", {
          headers: {
            "X-Staff-Username":
              window.localStorage.getItem("staff_username") ||
              window.localStorage.getItem("username") ||
              "",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load create options.");
        }

        setCustomers(data.customers || []);
        setSites(data.sites || []);
        setHauliers(data.hauliers || []);
        setScheduleTypes(data.schedule_type_choices || []);
        setCollectionDayChoices(data.collection_day_choices || []);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load customer/site options.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (!mounted) return;

    if (!canEdit) {
      setLoading(false);
      setError("You do not have permission to create services.");
      return;
    }

    loadOptions();
  }, [mounted, canEdit]);

  useEffect(() => {
    if (form.customer_id && !filteredSites.some((site) => site.id === form.site_id)) {
      setForm((prev) => ({
        ...prev,
        site_id: filteredSites.length ? filteredSites[0].id : "",
      }));
    }
  }, [form.customer_id, filteredSites, form.site_id]);

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
    setSaving(true);
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/services/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Staff-Username":
            window.localStorage.getItem("staff_username") ||
            window.localStorage.getItem("username") ||
            "",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create service.");
      }

      router.push(`/services/${data.service.id}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not create service.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffShell title="New Service">
      {!mounted ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading create form...
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading create form...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/20 p-4 backdrop-blur-lg">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Create Service</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Add a new waste service and set up the operational schedule.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold">Contract Setup</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Customer</label>
                <select
                  value={String(form.customer_id)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      customer_id: e.target.value ? Number(e.target.value) : "",
                      site_id: "",
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.business_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Site</label>
                <select
                  value={String(form.site_id)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      site_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  <option value="">Select site</option>
                  {filteredSites.map((site) => (
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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      waste_type: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bin_size: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      bin_count: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Collections / Week</label>
                <input
                  type="number"
                  min="1"
                  value={form.collections_per_week}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      collections_per_week: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.lock_required}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        lock_required: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-white/90">Lock required</span>
                </label>
              </div>
            </div>

            {showMetalOption ? (
              <div className="mt-4">
                <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.metal_bin_required}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        metal_bin_required: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-white/90">Metal bin required</span>
                </label>
              </div>
            ) : null}

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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      haulier_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  <option value="">Leave unassigned for now</option>
                  {hauliers.map((haulier) => (
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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      schedule_type: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
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
                  disabled={!requiresScheduleDays}
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
                      disabled={!requiresScheduleDays}
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
                  On-request services do not need scheduled collection days yet.
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Service"}
              </button>

              <Link
                href="/services"
                className="rounded-lg border border-violet-100 bg-white px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-50"
              >
                Back
              </Link>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
