"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StaffShell from "../../../components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";

type QuoteLine = {
  id?: number;
  waste_type: string;
  bin_size: string;
  bin_count: number;
  collections_per_week: number;
  price_per_lift: number;
  rental_per_day: number;
  supplier_price_per_lift?: number;
  supplier_rental_per_day?: number;
  collection_charge_per_month?: number;
  bin_rental_per_month?: number;
  line_total_per_month?: number;
  supplier_cost_per_month?: number;
  margin_per_month?: number;
  margin_percent?: number;
  target_margin_percent?: number;
  sort_order: number;
};

type QuoteDetail = {
  id: number;
  quote_number: string;
  title: string;
  lead_id: number | null;
  lead_name: string;
  customer_id: number | null;
  customer_name: string;
  site_id: number | null;
  site_name: string;
  contact_name: string;
  email: string;
  sic_code: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  contract_start_date: string;
  status: string;
  valid_until: string;
  subtotal_per_month: number;
  bin_rental_per_month: number;
  total_per_month: number;
  supplier_cost_per_month?: number;
  margin_per_month?: number;
  margin_percent?: number;
  notes: string;
  internal_notes: string;
  lines: QuoteLine[];
};

const wasteTypeOptions = [
  { value: "general", label: "General Waste" },
  { value: "mixed_recycling", label: "Mixed Recycling" },
  { value: "glass", label: "Glass" },
  { value: "food", label: "Food" },
];

function getBinSizeOptionsForWasteType(wasteType: string) {
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
  if (wasteType === "glass" || wasteType === "food") {
    return "240";
  }

  return "1100";
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();

  const quoteId = Number(params?.id);

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [priceLookupError, setPriceLookupError] = useState("");
  const [staffUsername, setStaffUsername] = useState("Staff Portal");
  const [missingConvertFields, setMissingConvertFields] = useState<string[]>([]);

  const convertFieldLabels: Record<string, string> = {
    contract_start_date: "Contract Start Date",
    contact_name: "Contact Name",
    email: "Email",
    sic_code: "SIC Code",
    address_line_1: "Address Line 1",
    town: "Town / City",
    postcode: "Postcode",
  };

  function missingClass(field: string) {
    return missingConvertFields.includes(field)
      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
      : "border-violet-100 bg-violet-50";
  }

  function requiredLabelClass(field: string) {
    return `mb-2 block text-sm font-bold ${
      missingConvertFields.includes(field) ? "text-red-700" : "text-slate-600"
    }`;
  }

  function formatTodayForInput() {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function clearMissingField(field: string) {
    setMissingConvertFields((current) => current.filter((item) => item !== field));
  }
  useEffect(() => {
    const storedUsername =
      window.localStorage.getItem("staff_username") ||
      window.localStorage.getItem("username") ||
      "Staff Portal";

    setStaffUsername(storedUsername);
  }, []);

  useEffect(() => {
    async function loadQuote() {
      if (!quoteId || Number.isNaN(quoteId)) return;

      try {
        const response = await fetch(`/api/quotes/${quoteId}/`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error("Failed to load quote.");
        }

        setQuote(data);
        const warning = window.sessionStorage.getItem(`quote:${quoteId}:warning`);
        const successMessage = window.sessionStorage.getItem(`quote:${quoteId}:message`);
        window.sessionStorage.removeItem(`quote:${quoteId}:warning`);
        window.sessionStorage.removeItem(`quote:${quoteId}:message`);
        if (warning) {
          setError(warning);
        } else if (successMessage) {
          setMessage(successMessage);
        }
      } catch {
        setError("Could not load quote.");
      } finally {
        setLoading(false);
      }
    }

    loadQuote();
  }, [quoteId]);

  const calculatedPreview = useMemo(() => {
    if (!quote) {
      return {
        subtotal: 0,
        rental: 0,
        total: 0,
        cost: 0,
        margin: 0,
        marginPercent: 0,
      };
    }

    const subtotal = quote.lines.reduce((sum, line) => {
      const collection =
        Number(line.bin_count || 0) *
        Number(line.collections_per_week || 0) *
        4.33 *
        Number(line.price_per_lift || 0);

      return sum + collection;
    }, 0);

    const rental = quote.lines.reduce((sum, line) => {
      const rentalValue = Number(line.bin_count || 0) * 30 * Number(line.rental_per_day || 0);

      return sum + rentalValue;
    }, 0);

    const cost = quote.lines.reduce((sum, line) => {
      const collectionCost =
        Number(line.bin_count || 0) *
        Number(line.collections_per_week || 0) *
        4.33 *
        Number(line.supplier_price_per_lift || 0);

      const rentalCost =
        Number(line.bin_count || 0) *
        30 *
        Number(line.supplier_rental_per_day || 0);

      return sum + collectionCost + rentalCost;
    }, 0);

    const total = subtotal + rental;
    const margin = total - cost;

    return {
      subtotal,
      rental,
      total,
      cost,
      margin,
      marginPercent: total > 0 ? (margin / total) * 100 : 0,
    };
  }, [quote]);

  function updateField<K extends keyof QuoteDetail>(field: K, value: QuoteDetail[K]) {
    setQuote((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: value,
      };
    });
    clearMissingField(String(field));
  }

  function updateLineFromLookup(
    index: number,
    pricePerLift: number,
    rentalPerDay: number,
    supplierPricePerLift: number,
    supplierRentalPerDay: number,
    targetMarginPercent: number,
    resolvedBinSize?: string
  ) {
    setQuote((current) => {
      if (!current) return current;

      const nextLines = [...current.lines];
      const line = nextLines[index];
      if (!line) return current;

      nextLines[index] = {
        ...line,
        price_per_lift: pricePerLift,
        rental_per_day: rentalPerDay,
        supplier_price_per_lift: supplierPricePerLift,
        supplier_rental_per_day: supplierRentalPerDay,
        target_margin_percent: targetMarginPercent,
        bin_size: resolvedBinSize || line.bin_size,
      };

      return {
        ...current,
        lines: nextLines,
      };
    });
  }

  async function lookupPrice(index: number, wasteType: string, binSize: string) {
    try {
      const response = await fetch(
        `/api/quotes/price-lookup/?waste_type=${encodeURIComponent(
          wasteType
        )}&bin_size=${encodeURIComponent(binSize)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to look up price.");
      }

      updateLineFromLookup(
        index,
        Number(data.price_per_lift || 0),
        Number(data.rental_per_day || 0),
        Number(data.supplier_price_per_lift || 0),
        Number(data.supplier_rental_per_day || 0),
        Number(data.target_margin_percent || 0),
        data.bin_size || binSize
      );

      if (!data.found) {
        setPriceLookupError("One or more quote lines do not have a matching active pricebook item.");
      } else {
        setPriceLookupError("");
      }
    } catch {
      updateLineFromLookup(index, 0, 0, 0, 0, 0, binSize);
      setPriceLookupError("Could not auto-fill one or more prices from the pricebook.");
    }
  }

  function updateLine(index: number, field: keyof QuoteLine, value: string | number) {
    setQuote((current) => {
      if (!current) return current;

      const nextLines = [...current.lines];
      const currentLine = nextLines[index];

      if (!currentLine) return current;

      const updatedLine: QuoteLine = {
        ...currentLine,
        [field]: value,
      };

      if (field === "waste_type") {
        const nextWasteType = String(value);
        const allowedSizes = getBinSizeOptionsForWasteType(nextWasteType).map((item) => item.value);

        if (!allowedSizes.includes(updatedLine.bin_size)) {
          updatedLine.bin_size = getDefaultBinSizeForWasteType(nextWasteType);
        }
      }

      nextLines[index] = updatedLine;

      return {
        ...current,
        lines: nextLines,
      };
    });

    if (field === "waste_type") {
      const nextWasteType = String(value);

      setQuote((current) => {
        if (!current) return current;

        const line = current.lines[index];
        if (!line) return current;

        const allowedSizes = getBinSizeOptionsForWasteType(nextWasteType).map((item) => item.value);
        const finalBinSize = allowedSizes.includes(line.bin_size)
          ? line.bin_size
          : getDefaultBinSizeForWasteType(nextWasteType);

        const nextLines = [...current.lines];
        nextLines[index] = {
          ...line,
          waste_type: nextWasteType,
          bin_size: finalBinSize,
        };

        return {
          ...current,
          lines: nextLines,
        };
      });

      const currentAllowedSizes = getBinSizeOptionsForWasteType(nextWasteType).map((item) => item.value);

      setQuote((current) => {
        if (!current) return current;

        const line = current.lines[index];
        if (!line) return current;

        const finalBinSize = currentAllowedSizes.includes(line.bin_size)
          ? line.bin_size
          : getDefaultBinSizeForWasteType(nextWasteType);

        lookupPrice(index, nextWasteType, finalBinSize);

        return current;
      });

      return;
    }

    if (field === "bin_size") {
      setQuote((current) => {
        if (!current) return current;

        const line = current.lines[index];
        if (!line) return current;

        lookupPrice(index, String(line.waste_type), String(value));
        return current;
      });

      return;
    }
  }

  function addLine() {
    setQuote((current) => {
      if (!current) return current;

      const nextIndex = current.lines.length;

      const nextLines = [
        ...current.lines,
        {
          waste_type: "general",
          bin_size: "1100",
          bin_count: 1,
          collections_per_week: 1,
          price_per_lift: 0,
          rental_per_day: 0,
          supplier_price_per_lift: 0,
          supplier_rental_per_day: 0,
          target_margin_percent: 0,
          sort_order: nextIndex,
        },
      ];

      return {
        ...current,
        lines: nextLines,
      };
    });

    lookupPrice(quote?.lines.length ?? 0, "general", "1100");
  }

  function removeLine(index: number) {
    setQuote((current) => {
      if (!current) return current;

      const nextLines = current.lines
        .filter((_, currentIndex) => currentIndex !== index)
        .map((line, currentIndex) => ({
          ...line,
          sort_order: currentIndex,
        }));

      return {
        ...current,
        lines: nextLines,
      };
    });
  }

  function buildQuotePayload(currentQuote: QuoteDetail) {
    return {
      title: currentQuote.title,
      lead_id: currentQuote.lead_id,
      customer_id: currentQuote.customer_id,
      site_id: currentQuote.site_id,
      contact_name: currentQuote.contact_name,
      email: currentQuote.email,
      sic_code: currentQuote.sic_code,
      address_line_1: currentQuote.address_line_1,
      address_line_2: currentQuote.address_line_2,
      town: currentQuote.town,
      county: currentQuote.county,
      postcode: currentQuote.postcode,
      contract_start_date: currentQuote.contract_start_date,
      status: currentQuote.status,
      valid_until: currentQuote.valid_until,
      notes: currentQuote.notes,
      internal_notes: currentQuote.internal_notes,
      lines: currentQuote.lines.map((line, index) => ({
        waste_type: line.waste_type,
        bin_size: line.bin_size,
        bin_count: Number(line.bin_count || 0),
        collections_per_week: Number(line.collections_per_week || 0),
        sort_order: index,
      })),
    };
  }

  async function saveQuoteChanges(currentQuote: QuoteDetail) {
    const response = await fetch(`/api/quotes/${currentQuote.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildQuotePayload(currentQuote)),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to save quote.");
    }

    setQuote(data.quote);
    return data.quote as QuoteDetail;
  }

  async function saveQuote() {
    if (!quote) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveQuoteChanges(quote);
      setMessage("Quote saved.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save quote.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendQuoteEmail() {
    if (!quote) return;

    setSending(true);
    setError("");
    setMessage("");

    try {
      const savedQuote = await saveQuoteChanges(quote);
      const response = await fetch(`/api/quotes/${savedQuote.id}/send/`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          created_by: staffUsername,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to email quote.");
      }

      setQuote(data.quote);
      setMessage(data.message || "Quote email sent.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not email quote.");
      }
    } finally {
      setSending(false);
    }
  }

  async function deleteQuote() {
    if (!quote) return;

    const confirmed = window.confirm(`Delete quote ${quote.quote_number}? This cannot be undone.`);

    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/quotes/${quote.id}/`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete quote.");
      }

      router.push("/quotes");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not delete quote.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function convertQuote() {
    if (!quote) return;

    const missingFields: string[] = [];

    for (const field of [
      "contract_start_date",
      "contact_name",
      "email",
      "sic_code",
      "address_line_1",
      "town",
      "postcode",
    ]) {
      if (!String(quote[field as keyof QuoteDetail] || "").trim()) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      setMissingConvertFields(missingFields);
      const missingLabels = missingFields.map((field) => {
        return convertFieldLabels[field] || field;
      });
      setError(`Please complete: ${missingLabels.join(", ")}.`);
      return;
    }

    setConverting(true);
    setError("");
    setMessage("");
    setMissingConvertFields([]);

    try {
      const response = await fetch(`/api/quotes/${quote.id}/convert/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          created_by: staffUsername,
          contract_start_date: quote.contract_start_date,
          contact_name: quote.contact_name,
          email: quote.email,
          sic_code: quote.sic_code,
          address_line_1: quote.address_line_1,
          address_line_2: quote.address_line_2,
          town: quote.town,
          county: quote.county,
          postcode: quote.postcode,
          service_confirmations: quote.lines.map((line, index) => ({
            quote_line_id: Number(line.id || index + 1),
            service_start_date: quote.contract_start_date || formatTodayForInput(),
            confirmed: true,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (Array.isArray(data.missing_fields)) {
          setMissingConvertFields(data.missing_fields);
        }
        throw new Error(data.message || "Failed to convert quote.");
      }

      setMessage(data.message || "Quote converted successfully.");

      if (data.customer_id) {
        router.push(`/customers/${data.customer_id}`);
        return;
      }

      if (data.quote) {
        setQuote(data.quote);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not convert quote.");
      }
    } finally {
      setConverting(false);
    }
  }

  function downloadPdf() {
    if (!quote) return;

    const createdBy = encodeURIComponent(staffUsername || "Staff Portal");
    window.open(`/api/quotes/${quote.id}/pdf/?created_by=${createdBy}`, "_blank");
  }

  return (
    <StaffShell title={quote?.quote_number ? `Quote ${quote.quote_number}` : "Quote"}>
      {loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading quote...
        </div>
      ) : !quote ? (
        <div className="rounded-3xl border border-red-300/30 bg-red-500/20 p-6 text-white backdrop-blur-lg">
          Quote not found.
        </div>
      ) : (
        <div className="space-y-6">
          {(message || error || priceLookupError) && (
            <div className="space-y-3">
              {error ? (
                <div className="rounded-3xl border border-red-300/30 bg-red-500/20 p-4 backdrop-blur-lg">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-3xl border border-emerald-300/30 bg-emerald-500/20 p-4 backdrop-blur-lg">
                  {message}
                </div>
              ) : null}

              {priceLookupError ? (
                <div className="rounded-3xl border border-amber-300/30 bg-amber-500/20 p-4 backdrop-blur-lg">
                  {priceLookupError}
                </div>
              ) : null}
            </div>
          )}

          {missingConvertFields.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
              <div className="font-black">Missing before conversion</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingConvertFields.map((field) => (
                  <span key={field} className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-700">
                    {convertFieldLabels[field] || field}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Quote Details</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Build the commercial structure of this quote.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={downloadPdf}
                    className="rounded-lg border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
                  >
                    Download PDF
                  </button>

                  <button
                    onClick={sendQuoteEmail}
                    disabled={sending || saving}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Email Quote"}
                  </button>

                  <button
                    onClick={convertQuote}
                    disabled={converting}
                    className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {converting ? "Converting..." : "Accept & Convert"}
                  </button>

                  <button
                    onClick={saveQuote}
                    disabled={saving}
                    className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Quote"}
                  </button>

                  <button
                    onClick={deleteQuote}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Quote"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-600">Quote Number</label>
                  <input
                    value={quote.quote_number}
                    disabled
                    className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Status</label>
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                    {quote.status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-slate-600">Title</label>
                  <input
                    value={quote.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    placeholder="Example: Acme Ltd Waste Management Proposal"
                  />
                </div>

                <div>
                  <label className={requiredLabelClass("contact_name")}>Contact Name</label>
                  <input
                    value={quote.contact_name}
                    onChange={(event) => updateField("contact_name", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("contact_name")}`}
                  />
                </div>

                <div>
                  <label className={requiredLabelClass("email")}>Email</label>
                  <input
                    value={quote.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("email")}`}
                  />
                </div>

                <div>
                  <label className={requiredLabelClass("sic_code")}>SIC Code</label>
                  <input
                    value={quote.sic_code}
                    onChange={(event) => updateField("sic_code", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("sic_code")}`}
                  />
                </div>

                <div>
                  <label className={requiredLabelClass("contract_start_date")}>Contract Start Date</label>
                  <input
                    type="date"
                    value={quote.contract_start_date || ""}
                    onChange={(event) => updateField("contract_start_date", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("contract_start_date")}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={requiredLabelClass("address_line_1")}>Address Line 1</label>
                  <input
                    value={quote.address_line_1}
                    onChange={(event) => updateField("address_line_1", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("address_line_1")}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-slate-600">Address Line 2</label>
                  <input
                    value={quote.address_line_2}
                    onChange={(event) => updateField("address_line_2", event.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className={requiredLabelClass("town")}>Town / City</label>
                  <input
                    value={quote.town}
                    onChange={(event) => updateField("town", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("town")}`}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">County</label>
                  <input
                    value={quote.county}
                    onChange={(event) => updateField("county", event.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className={requiredLabelClass("postcode")}>Postcode</label>
                  <input
                    value={quote.postcode}
                    onChange={(event) => updateField("postcode", event.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-950 outline-none ${missingClass("postcode")}`}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Valid Until</label>
                  <input
                    type="date"
                    value={quote.valid_until || ""}
                    onChange={(event) => updateField("valid_until", event.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Lead</label>
                  <input
                    value={quote.lead_name || "-"}
                    disabled
                    className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Customer</label>
                  <input
                    value={quote.customer_name || "-"}
                    disabled
                    className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Site</label>
                  <input
                    value={quote.site_name || "-"}
                    disabled
                    className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-slate-600">Customer Notes</label>
                  <textarea
                    value={quote.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-slate-600">Internal Notes</label>
                  <textarea
                    value={quote.internal_notes}
                    onChange={(event) => updateField("internal_notes", event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
                <h2 className="text-xl font-semibold">Quote Totals</h2>

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-slate-500">Collections per Month</div>
                    <div className="mt-2 text-2xl font-bold">
                      GBP {calculatedPreview.subtotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-slate-500">Bin Rental per Month</div>
                    <div className="mt-2 text-2xl font-bold">
                      GBP {calculatedPreview.rental.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Total Monthly Charge</div>
                    <div className="mt-2 text-3xl font-bold">
                      GBP {calculatedPreview.total.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="text-sm font-bold text-blue-900">Internal Supplier Cost</div>
                    <div className="mt-2 text-2xl font-black text-blue-950">
                      GBP {calculatedPreview.cost.toFixed(2)}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${
                      calculatedPreview.marginPercent < 30
                        ? "border-red-200 bg-red-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="text-sm font-bold text-slate-700">Internal Margin</div>
                    <div className="mt-2 text-2xl font-black text-slate-950">
                      GBP {calculatedPreview.margin.toFixed(2)}
                    </div>
                    <div
                      className={`mt-1 text-sm font-black ${
                        calculatedPreview.marginPercent < 30 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {calculatedPreview.marginPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
                <h2 className="text-xl font-semibold">Pricing Rule</h2>
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Customer prices and supplier costs are pulled automatically from the active pricebook. Supplier costs are internal only.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Quote Lines</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Add each waste stream and commercial rate.
                </p>
              </div>

              <button
                onClick={addLine}
                className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-violet-800"
              >
                Add Line
              </button>
            </div>

            <div className="space-y-4">
              {quote.lines.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                  No quote lines yet. Click Add Line to start building the quote.
                </div>
              ) : (
                quote.lines.map((line, index) => {
                  const collection =
                    Number(line.bin_count || 0) *
                    Number(line.collections_per_week || 0) *
                    4.33 *
                    Number(line.price_per_lift || 0);

                  const rental =
                    Number(line.bin_count || 0) *
                    30 *
                    Number(line.rental_per_day || 0);

                  const total = collection + rental;
                  const supplierCost =
                    Number(line.bin_count || 0) *
                      Number(line.collections_per_week || 0) *
                      4.33 *
                      Number(line.supplier_price_per_lift || 0) +
                    Number(line.bin_count || 0) *
                      30 *
                      Number(line.supplier_rental_per_day || 0);
                  const margin = total - supplierCost;
                  const marginPercent = total > 0 ? (margin / total) * 100 : 0;
                  const marginTarget = Number(line.target_margin_percent || 30);
                  const binSizeOptions = getBinSizeOptionsForWasteType(line.waste_type);

                  return (
                    <div
                      key={`${line.id ?? "new"}-${index}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="text-base font-black text-slate-950">Line {index + 1}</div>

                        <button
                          onClick={() => removeLine(index)}
                          className="rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Waste Type</label>
                          <select
                            value={line.waste_type}
                            onChange={(event) => updateLine(index, "waste_type", event.target.value)}
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                          >
                            {wasteTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Bin Size</label>
                          <select
                            value={line.bin_size}
                            onChange={(event) => updateLine(index, "bin_size", event.target.value)}
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                          >
                            {binSizeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Bin Count</label>
                          <input
                            type="number"
                            min={1}
                            value={line.bin_count}
                            onChange={(event) =>
                              updateLine(index, "bin_count", Number(event.target.value || 1))
                            }
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Collections / Week</label>
                          <input
                            type="number"
                            min={1}
                            value={line.collections_per_week}
                            onChange={(event) =>
                              updateLine(index, "collections_per_week", Number(event.target.value || 1))
                            }
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Price per Lift (GBP )</label>
                          <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950">
                            GBP {Number(line.price_per_lift || 0).toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Rental per Day (GBP )</label>
                          <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950">
                            GBP {Number(line.rental_per_day || 0).toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Supplier Lift Cost</label>
                          <div className="w-full rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">
                            GBP {Number(line.supplier_price_per_lift || 0).toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Supplier Rental / Day</label>
                          <div className="w-full rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">
                            GBP {Number(line.supplier_rental_per_day || 0).toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">
                            Collection Charge / Month
                          </label>
                          <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950">
                            GBP {collection.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Line Total / Month</label>
                          <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-950">
                            GBP {total.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm text-slate-600">Internal Margin</label>
                          <div
                            className={`w-full rounded-lg border px-4 py-3 text-sm font-black ${
                              marginPercent < marginTarget
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-950"
                            }`}
                          >
                            GBP {margin.toFixed(2)} / {marginPercent.toFixed(1)}%
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
      )}

    </StaffShell>
  );
}
