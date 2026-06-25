"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BACKEND_BASE } from "@/lib/apiBase";

type SigningPack = {
  quote_number: string;
  customer_name: string;
  site_name: string;
  service_start_date: string;
  service_start_date_label: string;
  status: string;
  signer_name: string;
  signer_email: string;
  signed_name: string;
  signed_email: string;
  signed_at: string;
  expires_at: string;
  acceptance_service_start_date: boolean;
  company: {
    name: string;
    logo_data: string;
    logo_url?: string;
    email: string;
    phone: string;
    website: string;
  };
  documents: Array<{
    id: number;
    title: string;
    document_type_label: string;
    download_url: string;
    filename: string;
  }>;
  signed_documents: Array<{
    id: number;
    title: string;
    absolute_download_url: string;
  }>;
};

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function logoSrc(company: SigningPack["company"] | null | undefined) {
  if (!company) return "";
  if (company.logo_url) return company.logo_url.startsWith("http") ? company.logo_url : `${BACKEND_BASE}${company.logo_url}`;
  return company.logo_data || "";
}

export default function PublicSigningPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [pack, setPack] = useState<SigningPack | null>(null);
  const [signedName, setSignedName] = useState("");
  const [signedEmail, setSignedEmail] = useState("");
  const [acceptanceDocuments, setAcceptanceDocuments] = useState(false);
  const [acceptanceTerms, setAcceptanceTerms] = useState(false);
  const [acceptanceAuthority, setAcceptanceAuthority] = useState(false);
  const [acceptanceServiceStartDate, setAcceptanceServiceStartDate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadPack() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${BACKEND_BASE}/api/documents/signing-packs/public/${token}/`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "This signing link could not be loaded.");
      setPack(data.pack);
      setSignedName(data.pack.signer_name || data.pack.signed_name || "");
      setSignedEmail(data.pack.signer_email || data.pack.signed_email || "");
      setAcceptanceServiceStartDate(Boolean(data.pack.acceptance_service_start_date));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This signing link could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPack();
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 520;
    const height = 180;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, [pack?.status]);

  function point(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in event) {
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function begin(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function submitSignature() {
    try {
      setSubmitting(true);
      setError("");
      setNotice("");
      const signatureData = canvasRef.current?.toDataURL("image/png") || "";
      const response = await fetch(`${BACKEND_BASE}/api/documents/signing-packs/public/${token}/submit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signed_name: signedName,
          signed_email: signedEmail,
          signature_data: signatureData,
          acceptance_documents: acceptanceDocuments,
          acceptance_terms: acceptanceTerms,
          acceptance_authority: acceptanceAuthority,
          acceptance_service_start_date: acceptanceServiceStartDate,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not submit signature.");
      setPack(data.pack);
      setNotice("Thank you. Your documents have been signed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit signature.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0d0338] text-white">Loading signing pack...</div>;
  }

  if (error && !pack) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0338] px-5 text-white">
        <div className="max-w-xl rounded-lg bg-white p-6 text-slate-950 shadow-xl">
          <h1 className="text-2xl font-black">Signing link unavailable</h1>
          <p className="mt-3 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const isSigned = pack?.status === "signed";
  const companyName = pack?.company?.name || "Recyclr Group Ltd";
  const companyLogo = logoSrc(pack?.company);

  return (
    <main className="min-h-screen bg-[#0d0338] px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-lg border border-violet-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="mb-5 h-auto w-[165px]" />
              ) : (
                <div className="mb-5 text-2xl font-black text-violet-800">{companyName}</div>
              )}
              <h1 className="text-3xl font-black">Review and sign documents</h1>
              <p className="mt-2 font-medium text-slate-600">
                {pack?.customer_name} {pack?.site_name ? `- ${pack.site_name}` : ""}
              </p>
            </div>
            <div className="rounded-lg bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800">
              Quote {pack?.quote_number}
              <div className="mt-1 text-xs text-slate-500">Expires {formatDate(pack?.expires_at || "")}</div>
            </div>
          </div>
        </section>

        {notice ? <div className="rounded-lg border border-emerald-200 bg-white p-4 font-semibold text-emerald-700">{notice}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700">{error}</div> : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="rounded-lg border border-violet-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Documents</h2>
            <div className="mt-4 space-y-3">
              {pack?.documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-black">{document.title}</div>
                      <div className="text-sm font-medium text-slate-500">{document.document_type_label}</div>
                    </div>
                    <a
                      href={document.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-violet-700 px-4 py-2 text-center text-sm font-bold text-white"
                    >
                      Open PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {isSigned ? (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="font-black text-emerald-900">Signed documents</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pack?.signed_documents.map((document) => (
                    <a
                      key={document.id}
                      href={document.absolute_download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      Download {document.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">{isSigned ? "Signing Complete" : "Sign Online"}</h2>
            {isSigned ? (
              <div className="mt-4 space-y-2 text-sm font-medium text-slate-700">
                <p>Signed by {pack?.signed_name || signedName}</p>
                <p>Email: {pack?.signed_email || signedEmail}</p>
                <p>Signed at: {formatDate(pack?.signed_at || "")}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Full Name</span>
                  <input
                    value={signedName}
                    onChange={(event) => setSignedName(event.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Email</span>
                  <input
                    value={signedEmail}
                    onChange={(event) => setSignedEmail(event.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                  />
                </label>

                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Requested service start date
                  </div>
                  <div className="mt-1 text-lg font-black text-emerald-950">
                    {pack?.service_start_date_label || "To be confirmed"}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50 p-4">
                  <label className="flex gap-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={acceptanceDocuments} onChange={(event) => setAcceptanceDocuments(event.target.checked)} />
                    I have opened and reviewed the documents in this signing pack.
                  </label>
                  <label className="flex gap-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={acceptanceTerms} onChange={(event) => setAcceptanceTerms(event.target.checked)} />
                    I accept the services, pricing, terms, and document contents.
                  </label>
                  <label className="flex gap-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={acceptanceAuthority} onChange={(event) => setAcceptanceAuthority(event.target.checked)} />
                    I confirm I am authorised to sign on behalf of this customer.
                  </label>
                  <label className="flex gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={acceptanceServiceStartDate}
                      onChange={(event) => setAcceptanceServiceStartDate(event.target.checked)}
                    />
                    I confirm the requested service start date shown above is correct.
                  </label>
                </div>

                <div>
                  <div className="mb-2 text-sm font-bold text-slate-700">Draw Signature</div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                  <button onClick={clearSignature} className="mt-2 rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700">
                    Clear Signature
                  </button>
                </div>

                <button
                  onClick={submitSignature}
                  disabled={
                    submitting ||
                    !acceptanceDocuments ||
                    !acceptanceTerms ||
                    !acceptanceAuthority ||
                    !acceptanceServiceStartDate
                  }
                  className="w-full rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Sign Documents"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
