"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";

type CompanyDetails = {
  company_name: string;
  company_number: string;
  waste_broker_registration: string;
  main_email: string;
  legal_documents_email: string;
  phone_number: string;
  website: string;
  registered_address_line_1: string;
  registered_address_line_2: string;
  registered_town: string;
  registered_county: string;
  registered_postcode: string;
  registered_country: string;
  same_as_registered_office: boolean;
  trading_address_line_1: string;
  trading_address_line_2: string;
  trading_town: string;
  trading_county: string;
  trading_postcode: string;
  trading_country: string;
  legal_signatory_name: string;
  legal_signatory_title: string;
  legal_signature_data: string;
  company_logo_data: string;
  company_email_domain: string;
  default_quote_validity_days: string;
  signing_pack_expiry_days: string;
  default_target_margin_percent: string;
  sales_offer_margin_1_percent: string;
  sales_offer_margin_2_percent: string;
  sales_offer_margin_3_percent: string;
  mileage_rate: string;
  vat_rate: string;
  container_qr_label_width_mm: string;
  container_qr_label_height_mm: string;
  updated_at?: string | null;
};

type CompanyDetailsResponse = Partial<CompanyDetails> & {
  company_details?: Partial<CompanyDetails>;
  message?: string;
  error?: string;
};

const EMPTY_DETAILS: CompanyDetails = {
  company_name: "Recyclr Group Ltd",
  company_number: "",
  waste_broker_registration: "",
  main_email: "",
  legal_documents_email: "",
  phone_number: "",
  website: "",
  registered_address_line_1: "",
  registered_address_line_2: "",
  registered_town: "",
  registered_county: "",
  registered_postcode: "",
  registered_country: "England",
  same_as_registered_office: true,
  trading_address_line_1: "",
  trading_address_line_2: "",
  trading_town: "",
  trading_county: "",
  trading_postcode: "",
  trading_country: "England",
  legal_signatory_name: "",
  legal_signatory_title: "",
  legal_signature_data: "",
  company_logo_data: "",
  company_email_domain: "recyclrgroup.co.uk",
  default_quote_validity_days: "14",
  signing_pack_expiry_days: "30",
  default_target_margin_percent: "30.00",
  sales_offer_margin_1_percent: "35.00",
  sales_offer_margin_2_percent: "30.00",
  sales_offer_margin_3_percent: "25.00",
  mileage_rate: "0.00",
  vat_rate: "20.00",
  container_qr_label_width_mm: "50.00",
  container_qr_label_height_mm: "50.00",
  updated_at: null,
};

function normalizeCompanyDetails(data: Partial<CompanyDetails> | undefined | null): CompanyDetails {
  return {
    ...EMPTY_DETAILS,
    ...(data || {}),
    same_as_registered_office:
      typeof data?.same_as_registered_office === "boolean"
        ? data.same_as_registered_office
        : true,
    company_email_domain: String(data?.company_email_domain ?? EMPTY_DETAILS.company_email_domain),
    default_quote_validity_days: String(data?.default_quote_validity_days ?? EMPTY_DETAILS.default_quote_validity_days),
    signing_pack_expiry_days: String(data?.signing_pack_expiry_days ?? EMPTY_DETAILS.signing_pack_expiry_days),
    default_target_margin_percent: String(data?.default_target_margin_percent ?? EMPTY_DETAILS.default_target_margin_percent),
    sales_offer_margin_1_percent: String(data?.sales_offer_margin_1_percent ?? EMPTY_DETAILS.sales_offer_margin_1_percent),
    sales_offer_margin_2_percent: String(data?.sales_offer_margin_2_percent ?? EMPTY_DETAILS.sales_offer_margin_2_percent),
    sales_offer_margin_3_percent: String(data?.sales_offer_margin_3_percent ?? EMPTY_DETAILS.sales_offer_margin_3_percent),
    mileage_rate: String(data?.mileage_rate ?? EMPTY_DETAILS.mileage_rate),
    vat_rate: String(data?.vat_rate ?? EMPTY_DETAILS.vat_rate),
    container_qr_label_width_mm: String(data?.container_qr_label_width_mm ?? EMPTY_DETAILS.container_qr_label_width_mm),
    container_qr_label_height_mm: String(data?.container_qr_label_height_mm ?? EMPTY_DETAILS.container_qr_label_height_mm),
  };
}

function SmallButton({ children, onClick, tone = "default" }: { children: React.ReactNode; onClick?: () => void; tone?: "default" | "danger" | "primary"; }) {
  const classes =
    tone === "danger"
      ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
      : tone === "primary"
      ? "border-emerald-200 bg-emerald-500 text-white hover:bg-emerald-400"
      : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${classes}`}
    >
      {children}
    </button>
  );
}

function SignaturePad({ onUse }: { onUse: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;
      const ratio = window.devicePixelRatio || 1;
      const width = wrapper.clientWidth;
      const height = 180;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#111827";
      ctx.clearRect(0, 0, width, height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getPoint = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in event) {
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const begin = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const p = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (event: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPoint(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  };

  const useDrawn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onUse(canvas.toDataURL("image/png"));
  };

  return (
    <div className="rounded-lg border border-violet-100 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-slate-600">
        Draw with your mouse, trackpad, or finger, then click <span className="font-semibold text-slate-950">Use drawn signature</span>.
      </p>
      <div ref={wrapperRef} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={begin}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={begin}
          onTouchMove={move}
          onTouchEnd={end}
          className="block touch-none"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={useDrawn}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          Use drawn signature
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Clear drawing
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-800">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-800">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white"
      />
    </label>
  );
}

export default function CompanyDetailsPage() {
  const [form, setForm] = useState<CompanyDetails>(EMPTY_DETAILS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    document.title = "Company Details - Recyclr";
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/company-details/", {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      const text = await res.text();
      let payload: CompanyDetailsResponse = {};
      try {
        payload = text ? (JSON.parse(text) as CompanyDetailsResponse) : {};
      } catch {
        throw new Error("Company details endpoint returned invalid JSON.");
      }

      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "Failed to load company details.");
      }

      const next = normalizeCompanyDetails(payload.company_details || payload);
      setForm(next);
      setEditorOpen(!next.legal_signature_data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const previewSignature = useMemo(() => form.legal_signature_data || "", [form.legal_signature_data]);

  const setField = <K extends keyof CompanyDetails>(key: K, value: CompanyDetails[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const copyRegisteredToTrading = (base: CompanyDetails): CompanyDetails => ({
    ...base,
    trading_address_line_1: base.registered_address_line_1,
    trading_address_line_2: base.registered_address_line_2,
    trading_town: base.registered_town,
    trading_county: base.registered_county,
    trading_postcode: base.registered_postcode,
    trading_country: base.registered_country,
  });

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = form.same_as_registered_office ? copyRegisteredToTrading(form) : form;

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/company-details/", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let responsePayload: CompanyDetailsResponse = {};
      try {
        responsePayload = text ? (JSON.parse(text) as CompanyDetailsResponse) : {};
      } catch {
        throw new Error("Company details save returned invalid JSON.");
      }

      if (!res.ok) {
        throw new Error(responsePayload?.message || responsePayload?.error || "Failed to save company details.");
      }

      const next = normalizeCompanyDetails(responsePayload.company_details || payload);
      setForm(next);
      setSuccess(responsePayload?.message || "Company details saved successfully.");
      setEditorOpen(!next.legal_signature_data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company details.");
    } finally {
      setSaving(false);
    }
  };

  const onSignatureUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setField("legal_signature_data", result);
      setEditorOpen(false);
      setSuccess("Signature ready to save.");
    };
    reader.readAsDataURL(file);
  };

  const onLogoUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setField("company_logo_data", result);
      setSuccess("Logo ready to save.");
    };
    reader.readAsDataURL(file);
  };

  const content = loading ? (
    <div className="rounded-lg border border-violet-100 bg-white p-8 text-slate-600 shadow-sm">Loading company details...</div>
  ) : (
    <div className="space-y-6">
      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Company Details</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600">
              This is the master legal profile for customer-facing documents. New contracts, onboarding packs, document generation, and signing flows will pull from these values automatically.
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            Last updated: {form.updated_at ? new Date(form.updated_at).toLocaleString() : "Never"}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-white px-5 py-4 font-semibold text-red-700 shadow-sm">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-white px-5 py-4 font-semibold text-emerald-700 shadow-sm">{success}</div> : null}

      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <h2 className="text-2xl font-black">Core Business Details</h2>
        <p className="mt-2 text-slate-600">Used across service agreements, service schedules, onboarding emails, and legal templates.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><Field label="Company Name" value={form.company_name} onChange={(v) => setField("company_name", v)} /></div>
          <Field label="Company Number" value={form.company_number} onChange={(v) => setField("company_number", v)} />
          <Field label="Waste Broker Registration" value={form.waste_broker_registration} onChange={(v) => setField("waste_broker_registration", v)} />
          <Field label="Main Email" value={form.main_email} onChange={(v) => setField("main_email", v)} type="email" />
          <Field label="Legal Documents Email" value={form.legal_documents_email} onChange={(v) => setField("legal_documents_email", v)} type="email" />
          <Field label="Phone Number" value={form.phone_number} onChange={(v) => setField("phone_number", v)} />
          <Field label="Website" value={form.website} onChange={(v) => setField("website", v)} />
          <Field label="Mileage Rate (£/mile)" value={form.mileage_rate} onChange={(v) => setField("mileage_rate", v)} type="number" placeholder="0.45" />
        </div>

        <div className="mt-6 rounded-lg border border-violet-100 bg-violet-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-950">Company logo</h3>
              <p className="mt-1 text-sm font-medium text-slate-600">Used on onboarding packs and legal PDFs.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
                Upload logo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogoUpload(e.target.files?.[0] || null)} />
              </label>
              {form.company_logo_data ? (
                <button
                  type="button"
                  onClick={() => setField("company_logo_data", "")}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                >
                  Remove logo
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-violet-100 bg-white p-4">
            {form.company_logo_data ? (
              <img src={form.company_logo_data} alt="Company logo preview" className="h-20 w-auto max-w-[240px] rounded bg-white p-2 object-contain" />
            ) : (
              <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50 px-4 py-6 text-sm font-medium text-slate-600">No logo saved yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <h2 className="text-2xl font-black">CRM Defaults</h2>
        <p className="mt-2 text-slate-600">Controls the repeated business rules the CRM uses when it creates quotes, signing packs, expenses, staff mailboxes, and container labels.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Company Email Domain" value={form.company_email_domain} onChange={(v) => setField("company_email_domain", v)} placeholder="recyclrgroup.co.uk" />
          <Field label="Default Quote Validity (days)" value={form.default_quote_validity_days} onChange={(v) => setField("default_quote_validity_days", v)} type="number" placeholder="14" />
          <Field label="Signing Pack Expiry (days)" value={form.signing_pack_expiry_days} onChange={(v) => setField("signing_pack_expiry_days", v)} type="number" placeholder="30" />
          <Field label="Default Target Margin (%)" value={form.default_target_margin_percent} onChange={(v) => setField("default_target_margin_percent", v)} type="number" placeholder="30" />
          <Field label="Tablet Offer 1 Margin (%)" value={form.sales_offer_margin_1_percent} onChange={(v) => setField("sales_offer_margin_1_percent", v)} type="number" placeholder="35" />
          <Field label="Tablet Offer 2 Margin (%)" value={form.sales_offer_margin_2_percent} onChange={(v) => setField("sales_offer_margin_2_percent", v)} type="number" placeholder="30" />
          <Field label="Tablet Final Offer Margin (%)" value={form.sales_offer_margin_3_percent} onChange={(v) => setField("sales_offer_margin_3_percent", v)} type="number" placeholder="25" />
          <Field label="VAT Rate (%)" value={form.vat_rate} onChange={(v) => setField("vat_rate", v)} type="number" placeholder="20" />
          <Field
            label="QR Label Width (mm)"
            value={form.container_qr_label_width_mm}
            onChange={(v) => setField("container_qr_label_width_mm", v)}
            type="number"
            placeholder="50"
          />
          <Field
            label="QR Label Height (mm)"
            value={form.container_qr_label_height_mm}
            onChange={(v) => setField("container_qr_label_height_mm", v)}
            type="number"
            placeholder="50"
          />
        </div>
      </section>

      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <h2 className="text-2xl font-black">Registered Office</h2>
        <p className="mt-2 text-slate-600">Used on legal contracts, transfer notes, and customer-facing paperwork.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Address Line 1" value={form.registered_address_line_1} onChange={(v) => setField("registered_address_line_1", v)} />
          <Field label="Address Line 2" value={form.registered_address_line_2} onChange={(v) => setField("registered_address_line_2", v)} />
          <Field label="Town / City" value={form.registered_town} onChange={(v) => setField("registered_town", v)} />
          <Field label="County" value={form.registered_county} onChange={(v) => setField("registered_county", v)} />
          <Field label="Postcode" value={form.registered_postcode} onChange={(v) => setField("registered_postcode", v)} />
          <Field label="Country" value={form.registered_country} onChange={(v) => setField("registered_country", v)} />
        </div>
      </section>

      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Trading Address</h2>
            <p className="mt-2 text-slate-600">Used where your trading address differs from your registered office.</p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.same_as_registered_office}
              onChange={(e) => setField("same_as_registered_office", e.target.checked)}
              className="h-4 w-4 rounded border-violet-300 bg-white"
            />
            Same as registered office
          </label>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Address Line 1" value={form.same_as_registered_office ? form.registered_address_line_1 : form.trading_address_line_1} onChange={(v) => setField("trading_address_line_1", v)} />
          <Field label="Address Line 2" value={form.same_as_registered_office ? form.registered_address_line_2 : form.trading_address_line_2} onChange={(v) => setField("trading_address_line_2", v)} />
          <Field label="Town / City" value={form.same_as_registered_office ? form.registered_town : form.trading_town} onChange={(v) => setField("trading_town", v)} />
          <Field label="County" value={form.same_as_registered_office ? form.registered_county : form.trading_county} onChange={(v) => setField("trading_county", v)} />
          <Field label="Postcode" value={form.same_as_registered_office ? form.registered_postcode : form.trading_postcode} onChange={(v) => setField("trading_postcode", v)} />
          <Field label="Country" value={form.same_as_registered_office ? form.registered_country : form.trading_country} onChange={(v) => setField("trading_country", v)} />
        </div>
      </section>

      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <h2 className="text-2xl font-black">Legal Signatory</h2>
        <p className="mt-2 text-slate-600">This is the company sign-off block the CRM will reuse on contracts and onboarding documents.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Legal Signatory Name" value={form.legal_signatory_name} onChange={(v) => setField("legal_signatory_name", v)} />
          <Field label="Legal Signatory Title" value={form.legal_signatory_title} onChange={(v) => setField("legal_signatory_title", v)} />
        </div>

        <div className="mt-6 rounded-lg border border-violet-100 bg-violet-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-950">Saved signature</h3>
              <p className="mt-1 text-sm font-medium text-slate-600">Keep this compact. Open the editor only when you want to replace or redraw it.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen((prev) => !prev)}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                {editorOpen ? "Hide editor" : previewSignature ? "Redraw signature" : "Add signature"}
              </button>
              <label className="cursor-pointer rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
                Upload new signature
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onSignatureUpload(e.target.files?.[0] || null)} />
              </label>
              {form.legal_signature_data ? (
                <button
                  type="button"
                  onClick={() => {
                    setField("legal_signature_data", "");
                    setEditorOpen(true);
                    setSuccess("");
                  }}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          {previewSignature ? (
            <div className="mt-4 inline-flex max-w-sm items-center justify-center rounded-lg border border-violet-100 bg-white p-4">
              <img
                src={previewSignature}
                alt="Saved signature"
                className="max-h-20 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-violet-200 bg-white px-4 py-5 text-sm font-medium text-slate-600">
              No signature saved yet.
            </div>
          )}

          {editorOpen ? (
            <div className="mt-6">
              <SignaturePad
                onUse={(dataUrl) => {
                  setField("legal_signature_data", dataUrl);
                  setSuccess("Drawn signature ready to save.");
                }}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-violet-100 bg-white p-8 text-slate-950 shadow-sm">
        <h2 className="text-2xl font-black">What this will power</h2>
        <p className="mt-2 text-slate-600">These details will be reused in onboarding packs, service agreements, service schedules, waste transfer notes, emails, and e-sign workflows.</p>
        <div className="mt-6 space-y-3 text-slate-800">
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold">Service Agreement generation</div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold">Service Schedule generation</div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold">Duty of Care / Waste Transfer documents</div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold">Onboarding emails and signing packs</div>
        </div>
      </section>

      <div className="sticky bottom-4 z-20 rounded-lg border border-violet-100 bg-white p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-700">Save these details before generating onboarding packs or legal documents.</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Company Details"}
          </button>
        </div>
      </div>
    </div>
  );

  return <StaffShell title="Company Details">{content}</StaffShell>;
}
