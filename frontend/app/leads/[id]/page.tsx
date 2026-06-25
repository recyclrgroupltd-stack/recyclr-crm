"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppModal from "../../../components/AppModal";
import StaffShell from "../../../components/StaffShell";
import { getAuthHeaders } from "../../../lib/auth";

type LeadForm = {
  company_name: string;
  who_spoke_to: string;
  contact_name: string;
  phone: string;
  secondary_phone: string;
  email: string;
  status: string;
  lead_source: string;
  lead_source_other: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  follow_up_date: string;
  notes: string;
  general_waste_required: boolean;
  general_waste_bin_count: string;
  general_waste_bin_size: string;
  general_waste_collections_per_week: string;
  general_waste_lock_required: boolean;
  general_waste_metal_bin_required: boolean;
  recycling_required: boolean;
  recycling_bin_count: string;
  recycling_bin_size: string;
  recycling_collections_per_week: string;
  recycling_lock_required: boolean;
  recycling_metal_bin_required: boolean;
  glass_required: boolean;
  glass_bin_count: string;
  glass_bin_size: string;
  glass_collections_per_week: string;
  glass_lock_required: boolean;
  glass_metal_bin_required: boolean;
  food_required: boolean;
  food_bin_count: string;
  food_bin_size: string;
  food_collections_per_week: string;
  food_lock_required: boolean;
  food_metal_bin_required: boolean;
};

type PriceItem = {
  waste_type: string;
  bin_size: string;
  price_per_lift: number;
  active: boolean;
};

const leadSourceOptions = ["door", "website", "referral", "phone", "other"];
const generalSizes = ["240", "360", "660", "1100"];
const foodGlassSizes = ["240"];
const numberOptions = Array.from({ length: 51 }, (_, i) => String(i));

const emptyForm: LeadForm = {
  company_name: "",
  who_spoke_to: "",
  contact_name: "",
  phone: "",
  secondary_phone: "",
  email: "",
  status: "new",
  lead_source: "other",
  lead_source_other: "",
  address_line_1: "",
  address_line_2: "",
  town: "",
  county: "",
  postcode: "",
  follow_up_date: "",
  notes: "",
  general_waste_required: false,
  general_waste_bin_count: "",
  general_waste_bin_size: "",
  general_waste_collections_per_week: "",
  general_waste_lock_required: false,
  general_waste_metal_bin_required: false,
  recycling_required: false,
  recycling_bin_count: "",
  recycling_bin_size: "",
  recycling_collections_per_week: "",
  recycling_lock_required: false,
  recycling_metal_bin_required: false,
  glass_required: false,
  glass_bin_count: "",
  glass_bin_size: "240",
  glass_collections_per_week: "",
  glass_lock_required: false,
  glass_metal_bin_required: false,
  food_required: false,
  food_bin_count: "",
  food_bin_size: "240",
  food_collections_per_week: "",
  food_lock_required: false,
  food_metal_bin_required: false,
};

function prettyStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readJsonResponse(response: Response, fallbackMessage: string) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(fallbackMessage);
  }
}

type StreamBoxProps = {
  title: string;
  requiredKey:
    | "general_waste_required"
    | "recycling_required"
    | "glass_required"
    | "food_required";
  binCountKey:
    | "general_waste_bin_count"
    | "recycling_bin_count"
    | "glass_bin_count"
    | "food_bin_count";
  binSizeKey:
    | "general_waste_bin_size"
    | "recycling_bin_size"
    | "glass_bin_size"
    | "food_bin_size";
  collectionsKey:
    | "general_waste_collections_per_week"
    | "recycling_collections_per_week"
    | "glass_collections_per_week"
    | "food_collections_per_week";
  lockKey:
    | "general_waste_lock_required"
    | "recycling_lock_required"
    | "glass_lock_required"
    | "food_lock_required";
  metalKey:
    | "general_waste_metal_bin_required"
    | "recycling_metal_bin_required"
    | "glass_metal_bin_required"
    | "food_metal_bin_required";
  sizes: string[];
  form: LeadForm;
  setForm: React.Dispatch<React.SetStateAction<LeadForm>>;
};

function StreamBox({
  title,
  requiredKey,
  binCountKey,
  binSizeKey,
  collectionsKey,
  lockKey,
  metalKey,
  sizes,
  form,
  setForm,
}: StreamBoxProps) {
  const enabled = form[requiredKey];
  const showMetal = form[binSizeKey] === "660" || form[binSizeKey] === "1100";

  return (
    <div
      className={`rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm ${
        !enabled ? "opacity-70" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form[requiredKey]}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                [requiredKey]: event.target.checked,
              }))
            }
          />
          Required
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">Bin Count</label>
          <select
            value={form[binCountKey]}
            disabled={!enabled}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                [binCountKey]: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-50"
          >
            <option value="">Select</option>
            {numberOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">Bin Size</label>
          <select
            value={form[binSizeKey]}
            disabled={!enabled}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                [binSizeKey]: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-50"
          >
            <option value="">Select</option>
            {sizes.map((value) => (
              <option key={value} value={value}>
                {value}L
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">
            Collections / Week
          </label>
          <select
            value={form[collectionsKey]}
            disabled={!enabled}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                [collectionsKey]: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-50"
          >
            <option value="">Select</option>
            {numberOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form[lockKey]}
            disabled={!enabled}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                [lockKey]: event.target.checked,
              }))
            }
          />
          Lock required
        </label>

        {showMetal && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form[metalKey]}
              disabled={!enabled}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [metalKey]: event.target.checked,
                }))
              }
            />
            Metal bin required
          </label>
        )}
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [convertedCustomerId, setConvertedCustomerId] = useState<number | null>(null);
  const [convertedCustomerName, setConvertedCustomerName] = useState("");
  const [monthlyValue, setMonthlyValue] = useState<number>(0);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);

  const [showQuoteValidityModal, setShowQuoteValidityModal] = useState(false);
  const [quoteValidUntil, setQuoteValidUntil] = useState("");

  const today = useMemo(() => formatDateForInput(new Date()), []);
  const defaultValidUntil = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return formatDateForInput(date);
  }, []);

  useEffect(() => {
    document.title = `${form.company_name || "Lead"} - Recyclr`;
  }, [form.company_name]);

  useEffect(() => {
    if (!quoteValidUntil) {
      setQuoteValidUntil(defaultValidUntil);
    }
  }, [defaultValidUntil, quoteValidUntil]);

  const liveMonthlyValue = useMemo(() => {
    if (!priceItems.length) return monthlyValue;

    function streamValue(
      wasteType: string,
      required: boolean,
      binCount: string,
      binSize: string,
      collectionsPerWeek: string
    ) {
      if (!required || !binCount || !binSize || !collectionsPerWeek) return 0;

      const count = Number(binCount);
      const collections = Number(collectionsPerWeek);
      if (!Number.isFinite(count) || !Number.isFinite(collections) || count <= 0 || collections <= 0) return 0;

      const lookupWasteType = wasteType === "mixed_recycling" ? "recycling" : wasteType;
      const priceItem = priceItems.find(
        (item) => item.active && item.waste_type === lookupWasteType && item.bin_size === binSize
      );

      if (!priceItem) return 0;
      return count * collections * 4.33 * Number(priceItem.price_per_lift || 0);
    }

    return (
      streamValue(
        "general",
        form.general_waste_required,
        form.general_waste_bin_count,
        form.general_waste_bin_size,
        form.general_waste_collections_per_week
      ) +
      streamValue(
        "mixed_recycling",
        form.recycling_required,
        form.recycling_bin_count,
        form.recycling_bin_size,
        form.recycling_collections_per_week
      ) +
      streamValue(
        "glass",
        form.glass_required,
        form.glass_bin_count,
        form.glass_bin_size,
        form.glass_collections_per_week
      ) +
      streamValue(
        "food",
        form.food_required,
        form.food_bin_count,
        form.food_bin_size,
        form.food_collections_per_week
      )
    );
  }, [form, monthlyValue, priceItems]);

  function buildQuoteLinesFromLead() {
    const lines: Array<{
      waste_type: string;
      bin_size: string;
      bin_count: number;
      collections_per_week: number;
      sort_order: number;
    }> = [];

    if (
      form.general_waste_required &&
      form.general_waste_bin_size &&
      form.general_waste_bin_count &&
      form.general_waste_collections_per_week
    ) {
      lines.push({
        waste_type: "general",
        bin_size: form.general_waste_bin_size,
        bin_count: Number(form.general_waste_bin_count),
        collections_per_week: Number(form.general_waste_collections_per_week),
        sort_order: lines.length,
      });
    }

    if (
      form.recycling_required &&
      form.recycling_bin_size &&
      form.recycling_bin_count &&
      form.recycling_collections_per_week
    ) {
      lines.push({
        waste_type: "mixed_recycling",
        bin_size: form.recycling_bin_size,
        bin_count: Number(form.recycling_bin_count),
        collections_per_week: Number(form.recycling_collections_per_week),
        sort_order: lines.length,
      });
    }

    if (
      form.glass_required &&
      form.glass_bin_size &&
      form.glass_bin_count &&
      form.glass_collections_per_week
    ) {
      lines.push({
        waste_type: "glass",
        bin_size: form.glass_bin_size,
        bin_count: Number(form.glass_bin_count),
        collections_per_week: Number(form.glass_collections_per_week),
        sort_order: lines.length,
      });
    }

    if (
      form.food_required &&
      form.food_bin_size &&
      form.food_bin_count &&
      form.food_collections_per_week
    ) {
      lines.push({
        waste_type: "food",
        bin_size: form.food_bin_size,
        bin_count: Number(form.food_bin_count),
        collections_per_week: Number(form.food_collections_per_week),
        sort_order: lines.length,
      });
    }

    return lines.filter(
      (line) =>
        Number.isFinite(line.bin_count) &&
        Number.isFinite(line.collections_per_week) &&
        line.bin_count > 0 &&
        line.collections_per_week > 0
    );
  }

  async function saveLeadData(showSuccessMessage = true) {
    if (!leadId) {
      throw new Error("Lead not found.");
    }

    const payload = Object.fromEntries(
      Object.entries(form).filter(([key]) => key !== "status")
    );

    const response = await fetch(`/api/leads/${leadId}/`, {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });

    const data = await readJsonResponse(response, "The CRM returned an unexpected response while saving the lead.");

    if (!response.ok) {
      throw new Error(data.message || "Failed to save lead.");
    }

    setMonthlyValue(data.lead?.estimated_monthly_value || 0);
    setConvertedCustomerId(data.lead?.converted_customer_id ?? null);
    setConvertedCustomerName(data.lead?.converted_customer_name || "");

    if (showSuccessMessage) {
      setMessage("Lead saved successfully.");
    }

    return data;
  }

  useEffect(() => {
    async function loadLead() {
      if (!leadId) return;

      try {
        setError("");
        const response = await fetch(`/api/leads/${leadId}/`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load lead.");
        }

        setForm({
          company_name: data.company_name || "",
          who_spoke_to: data.who_spoke_to || "",
          contact_name: data.contact_name || "",
          phone: data.phone || "",
          secondary_phone: data.secondary_phone || "",
          email: data.email || "",
          status: data.status || "new",
          lead_source: data.lead_source || "other",
          lead_source_other: data.lead_source_other || "",
          address_line_1: data.address_line_1 || "",
          address_line_2: data.address_line_2 || "",
          town: data.town || "",
          county: data.county || "",
          postcode: data.postcode || "",
          follow_up_date: data.follow_up_date || "",
          notes: data.notes || "",
          general_waste_required: Boolean(data.general_waste_required),
          general_waste_bin_count: data.general_waste_bin_count?.toString?.() || "",
          general_waste_bin_size: data.general_waste_bin_size || "",
          general_waste_collections_per_week:
            data.general_waste_collections_per_week?.toString?.() || "",
          general_waste_lock_required: Boolean(data.general_waste_lock_required),
          general_waste_metal_bin_required: Boolean(data.general_waste_metal_bin_required),
          recycling_required: Boolean(data.recycling_required),
          recycling_bin_count: data.recycling_bin_count?.toString?.() || "",
          recycling_bin_size: data.recycling_bin_size || "",
          recycling_collections_per_week:
            data.recycling_collections_per_week?.toString?.() || "",
          recycling_lock_required: Boolean(data.recycling_lock_required),
          recycling_metal_bin_required: Boolean(data.recycling_metal_bin_required),
          glass_required: Boolean(data.glass_required),
          glass_bin_count: data.glass_bin_count?.toString?.() || "",
          glass_bin_size: data.glass_bin_size || "240",
          glass_collections_per_week: data.glass_collections_per_week?.toString?.() || "",
          glass_lock_required: Boolean(data.glass_lock_required),
          glass_metal_bin_required: Boolean(data.glass_metal_bin_required),
          food_required: Boolean(data.food_required),
          food_bin_count: data.food_bin_count?.toString?.() || "",
          food_bin_size: data.food_bin_size || "240",
          food_collections_per_week: data.food_collections_per_week?.toString?.() || "",
          food_lock_required: Boolean(data.food_lock_required),
          food_metal_bin_required: Boolean(data.food_metal_bin_required),
        });

        setConvertedCustomerId(data.converted_customer_id);
        setConvertedCustomerName(data.converted_customer_name || "");
        setMonthlyValue(data.estimated_monthly_value || 0);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load lead.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadLead();
  }, [leadId]);

  useEffect(() => {
    async function loadPricing() {
      try {
        const response = await fetch("/api/pricing/", {
          headers: getAuthHeaders(),
        });
        const data = await readJsonResponse(response, "The CRM returned an unexpected response while loading the lead.");

        if (response.ok && Array.isArray(data)) {
          setPriceItems(data);
        }
      } catch (err) {
        console.error("Could not load pricing for live lead estimate.", err);
      }
    }

    loadPricing();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await saveLeadData(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save lead.");
      }
    } finally {
      setSaving(false);
    }
  }

  function openCreateQuoteModal() {
    setMessage("");
    setError("");
    setQuoteValidUntil((current) => current || defaultValidUntil);
    setShowQuoteValidityModal(true);
  }

  function closeCreateQuoteModal() {
    if (creatingQuote) return;
    setShowQuoteValidityModal(false);
  }

  function setQuoteValidityDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setQuoteValidUntil(formatDateForInput(date));
  }

  async function confirmCreateQuote() {
    if (!leadId) return;

    if (!quoteValidUntil) {
      setError("Please choose how long the quote should be valid for.");
      return;
    }

    if (quoteValidUntil < today) {
      setError("Valid until date cannot be in the past.");
      return;
    }

    setCreatingQuote(true);
    setMessage("");
    setError("");

    try {
      await saveLeadData(false);

      const lines = buildQuoteLinesFromLead();

      if (lines.length === 0) {
        throw new Error("Add at least one valid waste stream before creating a quote.");
      }

      const response = await fetch("/api/quotes/", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          title: form.company_name ? `${form.company_name} Quote` : "New Quote",
          lead_id: Number(leadId),
          contact_name: form.contact_name || form.who_spoke_to || "",
          email: form.email || "",
          status: "draft",
          valid_until: quoteValidUntil,
          notes: form.notes || "",
          internal_notes: "",
          lines,
        }),
      });

      const data = await readJsonResponse(response, "The CRM returned an unexpected response while creating the quote.");

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create quote.");
      }

      const quoteId = data.quote?.id;
      if (!quoteId) {
        throw new Error("Quote was created but the CRM did not return its ID.");
      }

      const staffUsername =
        window.localStorage.getItem("staff_username") ||
        window.localStorage.getItem("username") ||
        "System";

      const sendResponse = await fetch(`/api/quotes/${quoteId}/send/`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          created_by: staffUsername,
        }),
      });

      const sendData = await readJsonResponse(sendResponse, "The quote was created, but the CRM could not email it automatically.");

      if (!sendResponse.ok || !sendData.success) {
        throw new Error(
          `Quote created but email failed: ${sendData.message || "Could not email quote."} Open /quotes/${quoteId} to send it manually.`
        );
      }

      setShowQuoteValidityModal(false);
      router.push(`/quotes/${quoteId}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not create quote.");
      }
    } finally {
      setCreatingQuote(false);
    }
  }

  return (
    <StaffShell title={form.company_name || "Lead"}>
      {loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading lead...
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
                <h2 className="text-2xl font-semibold">{form.company_name || "Lead"}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Lead record #{leadId || "-"}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
                  {prettyStatus(form.status)}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
                  Est. GBP {liveMonthlyValue.toFixed(2)}
                </span>

                <button
                  onClick={openCreateQuoteModal}
                  disabled={creatingQuote || saving}
                  className="rounded-xl bg-white px-4 py-2 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
                >
                  {creatingQuote ? "Creating Quote..." : "Create Quote"}
                </button>

                {convertedCustomerId && (
                  <Link
                    href={`/customers/${convertedCustomerId}`}
                    className="rounded-xl bg-white px-4 py-2 font-semibold text-[#412a8a] transition hover:bg-gray-200"
                  >
                    {convertedCustomerName || "Open Customer"}
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Company Name
                </label>
                <input
                  value={form.company_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Who Spoke To
                </label>
                <input
                  value={form.who_spoke_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, who_spoke_to: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Contact Name
                </label>
                <input
                  value={form.contact_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Secondary Phone
                </label>
                <input
                  value={form.secondary_phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, secondary_phone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Lead Source
                </label>
                <select
                  value={form.lead_source}
                  onChange={(e) => setForm((prev) => ({ ...prev, lead_source: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  {leadSourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {prettyStatus(source)}
                    </option>
                  ))}
                </select>
              </div>

              {form.lead_source === "other" && (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">
                    Other Lead Source
                  </label>
                  <input
                    value={form.lead_source_other}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lead_source_other: e.target.value }))
                    }
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Address Line 1
                </label>
                <input
                  value={form.address_line_1}
                  onChange={(e) => setForm((prev) => ({ ...prev, address_line_1: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Address Line 2
                </label>
                <input
                  value={form.address_line_2}
                  onChange={(e) => setForm((prev) => ({ ...prev, address_line_2: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Town</label>
                <input
                  value={form.town}
                  onChange={(e) => setForm((prev) => ({ ...prev, town: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">County</label>
                <input
                  value={form.county}
                  onChange={(e) => setForm((prev) => ({ ...prev, county: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Postcode</label>
                <input
                  value={form.postcode}
                  onChange={(e) => setForm((prev) => ({ ...prev, postcode: e.target.value }))}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Follow Up Date
                </label>
                <input
                  type="date"
                  value={form.follow_up_date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, follow_up_date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-600">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StreamBox
              title="General Waste"
              requiredKey="general_waste_required"
              binCountKey="general_waste_bin_count"
              binSizeKey="general_waste_bin_size"
              collectionsKey="general_waste_collections_per_week"
              lockKey="general_waste_lock_required"
              metalKey="general_waste_metal_bin_required"
              sizes={generalSizes}
              form={form}
              setForm={setForm}
            />

            <StreamBox
              title="Dry Mixed Recycling"
              requiredKey="recycling_required"
              binCountKey="recycling_bin_count"
              binSizeKey="recycling_bin_size"
              collectionsKey="recycling_collections_per_week"
              lockKey="recycling_lock_required"
              metalKey="recycling_metal_bin_required"
              sizes={generalSizes}
              form={form}
              setForm={setForm}
            />

            <StreamBox
              title="Glass"
              requiredKey="glass_required"
              binCountKey="glass_bin_count"
              binSizeKey="glass_bin_size"
              collectionsKey="glass_collections_per_week"
              lockKey="glass_lock_required"
              metalKey="glass_metal_bin_required"
              sizes={foodGlassSizes}
              form={form}
              setForm={setForm}
            />

            <StreamBox
              title="Food"
              requiredKey="food_required"
              binCountKey="food_bin_count"
              binSizeKey="food_bin_size"
              collectionsKey="food_collections_per_week"
              lockKey="food_lock_required"
              metalKey="food_metal_bin_required"
              sizes={foodGlassSizes}
              form={form}
              setForm={setForm}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saving || creatingQuote}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Lead"}
            </button>

            <button
              onClick={openCreateQuoteModal}
              disabled={creatingQuote || saving}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
            >
              {creatingQuote ? "Creating Quote..." : "Create Quote"}
            </button>

            <Link
              href="/leads"
              className="rounded-lg border border-violet-100 bg-white px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-50"
            >
              Back to Leads
            </Link>
          </div>

          {showQuoteValidityModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120a2e]/90 px-4">
              <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-[#4f35a8] p-6 shadow-2xl">
                <div className="mb-5">
                  <h3 className="text-2xl font-semibold text-white">Create Quote</h3>
                  <p className="mt-2 text-sm text-white/75">
                    Choose how long this quote should stay valid for before it expires.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setQuoteValidityDays(7)}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    7 Days
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuoteValidityDays(14)}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    14 Days
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuoteValidityDays(30)}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    30 Days
                  </button>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    min={today}
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeCreateQuoteModal}
                    disabled={creatingQuote}
                    className="rounded-lg border border-violet-100 bg-white px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmCreateQuote}
                    disabled={creatingQuote}
                    className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
                  >
                    {creatingQuote ? "Creating Quote..." : "Create Quote"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </StaffShell>
  );
}
