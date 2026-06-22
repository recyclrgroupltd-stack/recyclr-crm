"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_BASE, CUSTOMER_PORTAL_API_BASE, friendlyApiError, readApiPayload } from "@/lib/apiBase";

const API_BASE = CUSTOMER_PORTAL_API_BASE;

type Company = {
  name: string;
  logo_data: string;
  logo_url?: string;
  email: string;
  phone: string;
  website: string;
};

type PortalCustomer = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  address: {
    line_1: string;
    line_2: string;
    town: string;
    county: string;
    postcode: string;
  };
  account_manager: null | {
    id: number;
    name: string;
    company_email: string;
    company_phone: string;
    job_title: string;
  };
};

type Site = {
  id: number;
  site_name: string;
  address: string;
  postcode: string;
};

type Service = {
  id: number;
  site_id: number | null;
  site_name: string;
  waste_type: string;
  bin_size: string;
  bin_count: number;
  collections_per_week: number;
  collection_days: string[];
  status: string;
  monthly_value: number;
};

type Job = {
  id: number;
  collection_date: string;
  site_name: string;
  site_address: string;
  waste_type: string;
  bin_size: string;
  bin_quantity: number;
  status: string;
  completed_at: string;
  failure_reason: string;
};

type PortalDocument = {
  id: number;
  title: string;
  type_label?: string;
  status?: string;
  site_name?: string;
  created_at: string;
  filename: string;
  download_url: string;
};

type SigningPack = {
  id: number;
  quote_number: string;
  status: string;
  sent_at: string;
  viewed_at: string;
  signed_at: string;
  expires_at: string;
  sign_url: string;
  document_count: number;
};

type PortalData = {
  success: boolean;
  company: Company;
  customer: PortalCustomer;
  summary: {
    site_count: number;
    service_count: number;
    active_service_count: number;
    upcoming_collection_count: number;
    document_count: number;
    open_signing_pack_count: number;
    monthly_value: number;
  };
  sites: Site[];
  services: Service[];
  upcoming_jobs: Job[];
  recent_jobs: Job[];
  documents: PortalDocument[];
  signed_documents: PortalDocument[];
  signing_packs: SigningPack[];
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function statusLabel(value: string) {
  return value ? value.replaceAll("_", " ") : "-";
}

function documentUrl(path: string, token: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${BACKEND_BASE}${path}${separator}token=${encodeURIComponent(token)}`;
}

function logoSrc(company: Company | null | undefined) {
  if (!company) return "/recyclr-group-logo.png";
  if (company.logo_url) return company.logo_url.startsWith("http") ? company.logo_url : `${BACKEND_BASE}${company.logo_url}`;
  return company.logo_data || "/recyclr-group-logo.png";
}

export default function CustomerPortalPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestType, setRequestType] = useState("general");
  const [siteId, setSiteId] = useState("");
  const [preferredDay, setPreferredDay] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function loadDashboard(savedToken: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/dashboard/`, {
        headers: { "X-Customer-Portal-Token": savedToken },
      });
      const payload = await readApiPayload(response, "Could not load the portal.");
      if (response.status === 401) {
        localStorage.removeItem("recyclrCustomerPortalToken");
        router.replace("/customer-portal/login");
        return;
      }
      if (!response.ok || !payload.success) throw new Error(payload.message || "Could not load the portal.");
      setData(payload);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("recyclrCustomerPortalToken") || "";
    if (!savedToken) {
      router.replace("/customer-portal/login");
      return;
    }
    setToken(savedToken);
    loadDashboard(savedToken);
  }, [router]);

  function logout() {
    localStorage.removeItem("recyclrCustomerPortalToken");
    router.push("/customer-portal/login");
  }

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSending(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/request/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Customer-Portal-Token": token,
        },
        body: JSON.stringify({
          request_type: requestType,
          site_id: siteId || null,
          preferred_day: preferredDay,
          message,
        }),
      });
      const payload = await readApiPayload(response, "Could not send request.");
      if (response.status === 401) {
        localStorage.removeItem("recyclrCustomerPortalToken");
        router.replace("/customer-portal/login");
        return;
      }
      if (!response.ok || !payload.success) throw new Error(payload.message || "Could not send request.");
      setNotice(payload.message || "Your request has been sent.");
      setMessage("");
      setPreferredDay("");
      setRequestType("general");
      await loadDashboard(token);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSending(false);
    }
  }

  function startRequest(type: string) {
    setRequestType(type);
    setNotice("");
    window.setTimeout(() => {
      document.getElementById("customer-request-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  const companyName = data?.company?.name || "Recyclr Group Ltd";
  const companyLogo = logoSrc(data?.company);
  const accountManager = data?.customer.account_manager;
  const allDocuments = useMemo(() => {
    if (!data) return [];
    return [
      ...data.signed_documents.map((document) => ({ ...document, status: "signed", type_label: "Signed document" })),
      ...data.documents,
    ];
  }, [data]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0d0338] text-white">Loading customer portal...</main>;
  }

  if (error && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d0338] px-4 text-slate-950">
        <section className="max-w-xl rounded-lg bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-black">Portal unavailable</h1>
          <p className="mt-3 text-slate-600">{error}</p>
          <button onClick={logout} className="mt-5 rounded-lg bg-violet-700 px-5 py-3 font-black text-white">
            Back to Login
          </button>
        </section>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="min-h-screen bg-[#0d0338] px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <img src={companyLogo} alt={companyName} className="h-auto w-[190px]" />
              <div>
                <h1 className="text-3xl font-black">{data.customer.business_name}</h1>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Customer portal {data.customer.customer_uid ? `- ${data.customer.customer_uid}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => loadDashboard(token)} className="rounded-lg border border-slate-200 px-4 py-2 font-black text-slate-700">
                Refresh
              </button>
              <button onClick={logout} className="rounded-lg bg-violet-700 px-4 py-2 font-black text-white">
                Log Out
              </button>
            </div>
          </div>
        </header>

        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg bg-white p-5">
            <p className="text-xs font-black uppercase text-slate-400">Active Services</p>
            <p className="mt-2 text-3xl font-black">{data.summary.active_service_count}</p>
          </div>
          <div className="rounded-lg bg-white p-5">
            <p className="text-xs font-black uppercase text-slate-400">Sites</p>
            <p className="mt-2 text-3xl font-black">{data.summary.site_count}</p>
          </div>
          <div className="rounded-lg bg-white p-5">
            <p className="text-xs font-black uppercase text-slate-400">Upcoming Collections</p>
            <p className="mt-2 text-3xl font-black">{data.summary.upcoming_collection_count}</p>
          </div>
          <div className="rounded-lg bg-white p-5">
            <p className="text-xs font-black uppercase text-slate-400">Documents</p>
            <p className="mt-2 text-3xl font-black">{data.summary.document_count}</p>
          </div>
          <div className="rounded-lg bg-white p-5">
            <p className="text-xs font-black uppercase text-slate-400">Monthly Services</p>
            <p className="mt-2 text-3xl font-black">{money(data.summary.monthly_value)}</p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => startRequest("missed_collection")}
            className="rounded-lg border border-white/10 bg-white p-5 text-left text-slate-950 shadow-sm transition hover:border-red-200 hover:bg-red-50"
          >
            <div className="text-xs font-black uppercase tracking-wide text-red-600">Report</div>
            <div className="mt-1 text-lg font-black">Missed Collection</div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Tell us if a scheduled collection was missed.</p>
          </button>
          <button
            type="button"
            onClick={() => startRequest("extra_lift")}
            className="rounded-lg border border-white/10 bg-white p-5 text-left text-slate-950 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
          >
            <div className="text-xs font-black uppercase tracking-wide text-violet-700">Request</div>
            <div className="mt-1 text-lg font-black">Additional Lift</div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Ask for an extra collection outside the normal schedule.</p>
          </button>
          <button
            type="button"
            onClick={() => startRequest("preferred_day")}
            className="rounded-lg border border-white/10 bg-white p-5 text-left text-slate-950 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Change</div>
            <div className="mt-1 text-lg font-black">Preferred Day</div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Request a preferred day for regular collections.</p>
          </button>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="space-y-5">
            <section className="rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Your Sites</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.sites.length ? (
                  data.sites.map((site) => (
                    <article key={site.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="font-black">{site.site_name}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">{site.address || "Address not set"}</div>
                      {site.postcode ? <div className="mt-2 text-xs font-black uppercase text-slate-400">{site.postcode}</div> : null}
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 font-bold text-slate-500">
                    No sites are visible yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg bg-white p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-black">Upcoming Collections</h2>
                  <p className="text-sm font-medium text-slate-500">Collections currently scheduled for your sites.</p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Site</th>
                      <th className="px-4 py-3">Waste Stream</th>
                      <th className="px-4 py-3">Bins</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming_jobs.length ? (
                      data.upcoming_jobs.map((job) => (
                        <tr key={job.id} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-bold">{formatDate(job.collection_date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold">{job.site_name}</div>
                            <div className="text-xs text-slate-500">{job.site_address}</div>
                          </td>
                          <td className="px-4 py-3 font-bold">{job.waste_type}</td>
                          <td className="px-4 py-3">{job.bin_quantity} x {job.bin_size}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black capitalize text-violet-800">
                              {statusLabel(job.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center font-bold text-slate-500">
                          No upcoming collections are currently scheduled.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Recent Collections</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Site</th>
                      <th className="px-4 py-3">Waste Stream</th>
                      <th className="px-4 py-3">Bins</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_jobs.length ? (
                      data.recent_jobs.slice(0, 8).map((job) => (
                        <tr key={job.id} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-bold">{formatDate(job.collection_date)}</td>
                          <td className="px-4 py-3 font-bold">{job.site_name}</td>
                          <td className="px-4 py-3">{job.waste_type}</td>
                          <td className="px-4 py-3">{job.bin_quantity} x {job.bin_size}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black capitalize text-slate-700">
                              {statusLabel(job.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center font-bold text-slate-500">
                          No completed collections are visible yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="customer-request-form" className="scroll-mt-5 rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Services</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {data.services.length ? (
                  data.services.map((service) => (
                    <article key={service.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{service.waste_type}</h3>
                          <p className="mt-1 text-sm font-medium text-slate-500">{service.site_name}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black capitalize text-emerald-800">
                          {statusLabel(service.status)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-black uppercase text-slate-400">Bins</p>
                          <p className="font-black">{service.bin_count} x {service.bin_size}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase text-slate-400">Frequency</p>
                          <p className="font-black">{service.collections_per_week} / week</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase text-slate-400">Days</p>
                          <p className="font-black">{service.collection_days.length ? service.collection_days.join(", ") : "Not set"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase text-slate-400">Monthly</p>
                          <p className="font-black">{money(service.monthly_value)}</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 font-bold text-slate-500">
                    No services are visible yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Documents</h2>
              <div className="mt-4 space-y-3">
                {allDocuments.length ? (
                  allDocuments.map((document) => (
                    <div key={`${document.status}-${document.id}`} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-black">{document.title}</div>
                        <div className="text-sm font-medium text-slate-500">
                          {document.type_label || "Document"} {document.created_at ? `- ${formatDate(document.created_at)}` : ""}
                        </div>
                      </div>
                      {document.download_url ? (
                        <a
                          href={documentUrl(document.download_url, token)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-violet-700 px-4 py-2 text-center text-sm font-black text-white"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 font-bold text-slate-500">
                    No customer documents are ready yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Account Manager</h2>
              {accountManager ? (
                <div className="mt-4 rounded-lg bg-violet-50 p-4">
                  <p className="text-lg font-black">{accountManager.name}</p>
                  <p className="text-sm font-bold text-slate-500">{accountManager.job_title || "Account Manager"}</p>
                  {accountManager.company_email ? (
                    <a className="mt-3 block font-bold text-violet-700" href={`mailto:${accountManager.company_email}`}>
                      {accountManager.company_email}
                    </a>
                  ) : null}
                  {accountManager.company_phone ? <p className="mt-1 font-bold">{accountManager.company_phone}</p> : null}
                </div>
              ) : (
                <p className="mt-3 font-bold text-slate-500">Your account manager will be confirmed shortly.</p>
              )}
            </section>

            <section className="rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Signing & Onboarding</h2>
              <div className="mt-4 space-y-3">
                {data.signing_packs.length ? (
                  data.signing_packs.map((pack) => (
                    <div key={pack.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-black">Quote {pack.quote_number}</div>
                          <div className="text-sm font-bold capitalize text-slate-500">{statusLabel(pack.status)}</div>
                        </div>
                        {pack.status !== "signed" ? (
                          <a href={pack.sign_url} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white">
                            Open
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="font-bold text-slate-500">No signing packs are waiting.</p>
                )}
              </div>
            </section>

            <section className="rounded-lg bg-white p-5">
              <h2 className="text-xl font-black">Send a Request</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Ask the team about your services or collections.</p>
              <form onSubmit={sendRequest} className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Request type</span>
                  <select
                    value={requestType}
                    onChange={(event) => setRequestType(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 font-bold"
                  >
                    <option value="general">General request</option>
                    <option value="preferred_day">Preferred collection day</option>
                    <option value="missed_collection">Missed collection</option>
                    <option value="extra_lift">Additional lift</option>
                    <option value="document_query">Document query</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Site</span>
                  <select
                    value={siteId}
                    onChange={(event) => setSiteId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 font-bold"
                  >
                    <option value="">General account request</option>
                    {data.sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.site_name}</option>
                    ))}
                  </select>
                </label>
                {requestType === "preferred_day" ? (
                  <label className="block">
                    <span className="text-xs font-black uppercase text-slate-500">Preferred day</span>
                    <select
                      value={preferredDay}
                      onChange={(event) => setPreferredDay(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 font-bold"
                    >
                      <option value="">Select a day</option>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell us what you need..."
                    className="mt-2 min-h-[130px] w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 font-bold outline-none focus:border-violet-500"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full rounded-lg bg-violet-700 px-4 py-3 font-black text-white disabled:bg-slate-300"
                >
                  {sending ? "Sending..." : "Send Request"}
                </button>
              </form>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
