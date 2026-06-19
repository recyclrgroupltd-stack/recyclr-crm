"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PortalSite = {
  id: number;
  site_name: string;
  customer_name: string;
};

type HaulierPortalUser = {
  id: number;
  haulier_id?: number;
  haulier_name?: string;
  haulier?: string;
  full_name: string;
  email: string;
  is_active?: boolean;
  active?: boolean;
  can_view_all_sites?: boolean;
  notes?: string;
  last_login_at?: string;
  created_at?: string;
  allowed_sites?: PortalSite[];
  must_set_password?: boolean;
};

type PortalJob = {
  id: number;
  service_id: number | null;
  customer_id: number;
  customer: string;
  site_id: number;
  site: string;
  date: string;
  waste_type: string;
  bin_size: string;
  bin_quantity: number;
  bin: string;
  status: string;
  haulier: string;
  failure_reason: string;
  failure_notes: string;
  notes: string;
  rescheduled_to: string;
  status_updated_by: string;
  status_updated_by_email: string;
  status_updated_source: string;
  status_updated_at: string;
  completed_at: string;
  evidence_image_url: string;
};

type PortalSummary = {
  total: number;
  scheduled: number;
  collected: number;
  failed: number;
  today: number;
  upcoming: number;
};

const FAILURE_REASONS = [
  { value: "blocked_access", label: "Blocked Access" },
  { value: "not_presented", label: "Bin Not Presented" },
  { value: "contaminated", label: "Contaminated" },
  { value: "overweight", label: "Overweight" },
  { value: "closed", label: "Site Closed" },
  { value: "other", label: "Other" },
];

function normalizePortalUser(raw: unknown): HaulierPortalUser | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const user = raw as Record<string, unknown>;

  return {
    id: Number(user.id || 0),
    haulier_id: user.haulier_id ? Number(user.haulier_id) : undefined,
    haulier_name:
      typeof user.haulier_name === "string"
        ? user.haulier_name
        : typeof user.haulier === "string"
        ? user.haulier
        : undefined,
    haulier: typeof user.haulier === "string" ? user.haulier : undefined,
    full_name: typeof user.full_name === "string" ? user.full_name : "",
    email: typeof user.email === "string" ? user.email : "",
    is_active: typeof user.is_active === "boolean" ? user.is_active : undefined,
    active: typeof user.active === "boolean" ? user.active : undefined,
    can_view_all_sites:
      typeof user.can_view_all_sites === "boolean" ? user.can_view_all_sites : true,
    notes: typeof user.notes === "string" ? user.notes : "",
    last_login_at: typeof user.last_login_at === "string" ? user.last_login_at : "",
    created_at: typeof user.created_at === "string" ? user.created_at : "",
    allowed_sites: Array.isArray(user.allowed_sites)
      ? (user.allowed_sites as PortalSite[])
      : [],
    must_set_password:
      typeof user.must_set_password === "boolean" ? user.must_set_password : undefined,
  };
}

function getPortalUser(): HaulierPortalUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("recyclrHaulierPortalUser");
    if (!raw) return null;
    return normalizePortalUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

function prettyWasteType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettyFailureReason(value: string) {
  const found = FAILURE_REASONS.find((item) => item.value === value);
  return found ? found.label : value;
}

function formatDate(value: string) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
}

function formatDateTime(value: string) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function statusClass(status: string) {
  if (status === "scheduled") return "bg-blue-500/20 text-blue-200";
  if (status === "collected") return "bg-emerald-500/20 text-emerald-200";
  if (status === "failed") return "bg-red-500/20 text-red-200";
  return "bg-white/10 text-white";
}

export default function HaulierPortalPage() {
  const router = useRouter();

  const [portalUser, setPortalUser] = useState<HaulierPortalUser | null>(null);
  const [jobs, setJobs] = useState<PortalJob[]>([]);
  const [summary, setSummary] = useState<PortalSummary>({
    total: 0,
    scheduled: 0,
    collected: 0,
    failed: 0,
    today: 0,
    upcoming: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tab, setTab] = useState<"upcoming" | "all" | "completed" | "failed">("upcoming");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");

  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null);

  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failJobId, setFailJobId] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState("blocked_access");
  const [failureNotes, setFailureNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Haulier Portal - Recyclr";
  }, []);

  useEffect(() => {
    const user = getPortalUser();

    if (!user) {
      router.replace("/haulier-portal/login");
      return;
    }

    setPortalUser(user);
  }, [router]);

  useEffect(() => {
    if (!portalUser?.email) return;
    loadPortalJobs(portalUser.email);
  }, [portalUser?.email]);

  useEffect(() => {
    if (!failModalOpen && !selectedJob) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [failModalOpen, selectedJob]);

  async function loadPortalJobs(email: string) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/hauliers/portal/jobs/?email=${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load portal jobs.");
      }

      const normalizedUser = normalizePortalUser(data.user);
      if (normalizedUser) {
        setPortalUser(normalizedUser);
        localStorage.setItem("recyclrHaulierPortalUser", JSON.stringify(normalizedUser));
      }

      setJobs(Array.isArray(data.rows) ? data.rows : []);
      setSummary(
        data.summary || {
          total: 0,
          scheduled: 0,
          collected: 0,
          failed: 0,
          today: 0,
          upcoming: 0,
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portal jobs.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("recyclrHaulierPortalUser");
    router.replace("/haulier-portal/login");
  }

  async function markCollected(jobId: number) {
    if (!portalUser?.email) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(`http://127.0.0.1:8000/api/hauliers/portal/jobs/${jobId}/update/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: portalUser.email,
          status: "collected",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to mark job collected.");
      }

      setMessage(data.message || "Collection marked as collected.");
      await loadPortalJobs(portalUser.email);
      if (selectedJob?.id === jobId) {
        setSelectedJob(data.job);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark job collected.");
    } finally {
      setSaving(false);
    }
  }

  function openFailModal(jobId: number) {
    setFailJobId(jobId);
    setFailureReason("blocked_access");
    setFailureNotes("");
    setEvidenceFile(null);
    setFailModalOpen(true);
  }

  function closeFailModal() {
    if (saving) return;
    setFailModalOpen(false);
    setFailJobId(null);
    setFailureReason("blocked_access");
    setFailureNotes("");
    setEvidenceFile(null);
  }

  async function submitFail() {
    if (!failJobId || !portalUser?.email) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const body = new FormData();
      body.append("email", portalUser.email);
      body.append("status", "failed");
      body.append("reason", failureReason);
      body.append("failure_notes", failureNotes);

      if (evidenceFile) {
        body.append("evidence_image", evidenceFile);
      }

      const response = await fetch(`http://127.0.0.1:8000/api/hauliers/portal/jobs/${failJobId}/update/`, {
        method: "POST",
        body,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to mark job failed.");
      }

      setMessage(data.message || "Collection marked as failed.");
      setFailModalOpen(false);
      await loadPortalJobs(portalUser.email);
      if (selectedJob?.id === failJobId) {
        setSelectedJob(data.job);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark job failed.");
    } finally {
      setSaving(false);
    }
  }

  const filteredJobs = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let rows = [...jobs];

    if (tab === "upcoming") {
      rows = rows.filter((job) => job.status === "scheduled" && job.date >= today);
    } else if (tab === "completed") {
      rows = rows.filter((job) => job.status === "collected");
    } else if (tab === "failed") {
      rows = rows.filter((job) => job.status === "failed");
    }

    if (siteFilter !== "all") {
      rows = rows.filter((job) => String(job.site_id) === siteFilter);
    }

    const term = search.trim().toLowerCase();

    if (term) {
      rows = rows.filter((job) => {
        const haystack = [
          job.customer,
          job.site,
          job.waste_type,
          job.bin,
          job.status,
          job.notes || "",
          job.failure_notes || "",
          job.status_updated_by || "",
          job.status_updated_by_email || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      });
    }

    return rows;
  }, [jobs, tab, siteFilter, search]);

  const availableSites = useMemo(() => {
    if (!portalUser) return [];

    if (portalUser.can_view_all_sites !== false) {
      const uniqueSites = new Map<number, PortalSite>();

      for (const job of jobs) {
        if (!uniqueSites.has(job.site_id)) {
          uniqueSites.set(job.site_id, {
            id: job.site_id,
            site_name: job.site,
            customer_name: job.customer,
          });
        }
      }

      return Array.from(uniqueSites.values()).sort((a, b) =>
        `${a.customer_name} ${a.site_name}`.localeCompare(`${b.customer_name} ${b.site_name}`)
      );
    }

    const allowedSites = Array.isArray(portalUser.allowed_sites) ? portalUser.allowed_sites : [];

    return [...allowedSites].sort((a, b) =>
      `${a.customer_name} ${a.site_name}`.localeCompare(`${b.customer_name} ${b.site_name}`)
    );
  }, [portalUser, jobs]);

  return (
    <main className="min-h-screen bg-[#4a2ea8] px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative mt-1 h-14 w-36 shrink-0">
                <Image
                  src="/recyclrcore-logo.png"
                  alt="RecyclrCore"
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                    RecyclrCore
                  </div>
                  <div className="rounded-full border border-white/15 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                    Hauliers
                  </div>
                </div>

                <h1 className="mt-3 text-2xl font-semibold">{portalUser?.full_name || "Haulier User"}</h1>
                <p className="mt-1 text-sm text-white/75">
                  {portalUser?.haulier_name || portalUser?.haulier || "-"} · {portalUser?.email || "-"}
                </p>
                <p className="mt-2 text-xs text-white/60">
                  {portalUser?.can_view_all_sites !== false
                    ? "This account can view all assigned haulier sites."
                    : `This account is restricted to ${
                        Array.isArray(portalUser?.allowed_sites) ? portalUser.allowed_sites.length : 0
                      } site(s).`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/15 bg-black/10 px-4 py-3 text-sm text-white/85">
                Last login: {portalUser?.last_login_at ? formatDateTime(portalUser.last_login_at) : "-"}
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#412a8a] transition hover:bg-gray-200"
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className="space-y-3">
            {message ? (
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3 text-sm text-white">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-lg">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Total</div>
            <div className="mt-2 text-3xl font-semibold">{summary.total}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-lg">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Scheduled</div>
            <div className="mt-2 text-3xl font-semibold">{summary.scheduled}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-lg">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Today</div>
            <div className="mt-2 text-3xl font-semibold">{summary.today}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-lg">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Upcoming</div>
            <div className="mt-2 text-3xl font-semibold">{summary.upcoming}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-lg">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Collected</div>
            <div className="mt-2 text-3xl font-semibold">{summary.collected}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-lg">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Failed</div>
            <div className="mt-2 text-3xl font-semibold">{summary.failed}</div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Collections</h2>
              <p className="mt-1 text-sm text-white/75">
                View upcoming jobs and update them as you complete them.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "upcoming", label: "Upcoming" },
                  { value: "all", label: "All" },
                  { value: "completed", label: "Completed" },
                  { value: "failed", label: "Failed" },
                ].map((item) => {
                  const active = tab === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setTab(item.value as typeof tab)}
                      className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                        active
                          ? "bg-white text-[#412a8a]"
                          : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <select
                value={siteFilter}
                onChange={(event) => setSiteFilter(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-[#4a3099] px-4 py-3 text-sm text-white outline-none md:w-80"
              >
                <option value="all">All sites</option>
                {availableSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.customer_name} - {site.site_name}
                  </option>
                ))}
              </select>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, site, stream..."
                className="w-full rounded-xl border border-white/20 bg-[#4a3099] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 md:w-80"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/10 backdrop-blur-xl">
          {loading ? (
            <div className="p-6 text-white/85">Loading portal jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-10 text-center text-white/75">No jobs found for this view.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-white">
                <thead className="bg-black/10 text-white/75">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Stream</th>
                    <th className="px-4 py-3 font-medium">Bin</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated By</th>
                    <th className="px-4 py-3 font-medium">Updated At</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3">{formatDate(job.date)}</td>
                      <td className="px-4 py-3 font-medium">{job.customer}</td>
                      <td className="px-4 py-3">{job.site}</td>
                      <td className="px-4 py-3">{prettyWasteType(job.waste_type)}</td>
                      <td className="px-4 py-3">{job.bin}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/85">
                        {job.status_updated_by || "-"}
                        {job.status_updated_by_email ? (
                          <div className="text-xs text-white/55">{job.status_updated_by_email}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {job.status_updated_at ? formatDateTime(job.status_updated_at) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            View
                          </button>

                          {job.status === "scheduled" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => markCollected(job.id)}
                                disabled={saving}
                                className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                              >
                                Collected
                              </button>
                              <button
                                type="button"
                                onClick={() => openFailModal(job.id)}
                                disabled={saving}
                                className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30"
                              >
                                Failed
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-[#120a2e]/92">
          <div className="flex min-h-full items-start justify-center px-4 pb-6 pt-10">
            <div className="flex max-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#4a3099] shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <h3 className="text-xl font-semibold">Collection Details</h3>
                  <p className="mt-1 text-sm text-white/75">
                    {selectedJob.customer} · {selectedJob.site}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Date</div>
                    <div className="mt-2 text-sm">{formatDate(selectedJob.date)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Status</div>
                    <div className="mt-2 text-sm">{selectedJob.status}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Stream</div>
                    <div className="mt-2 text-sm">{prettyWasteType(selectedJob.waste_type)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Bin</div>
                    <div className="mt-2 text-sm">{selectedJob.bin}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Updated By</div>
                    <div className="mt-2 text-sm">{selectedJob.status_updated_by || "-"}</div>
                    {selectedJob.status_updated_by_email ? (
                      <div className="mt-1 text-xs text-white/55">{selectedJob.status_updated_by_email}</div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Updated At</div>
                    <div className="mt-2 text-sm">{formatDateTime(selectedJob.status_updated_at)}</div>
                  </div>
                </div>

                {selectedJob.failure_reason ? (
                  <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-red-200/80">Failure Reason</div>
                    <div className="mt-2 text-sm text-white">{prettyFailureReason(selectedJob.failure_reason)}</div>
                  </div>
                ) : null}

                {selectedJob.failure_notes ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Failure Notes</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white">{selectedJob.failure_notes}</div>
                  </div>
                ) : null}

                {selectedJob.notes ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">General Notes</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white">{selectedJob.notes}</div>
                  </div>
                ) : null}

                {selectedJob.evidence_image_url ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Evidence Image</div>
                    <img
                      src={selectedJob.evidence_image_url}
                      alt="Evidence"
                      className="mt-3 max-h-[420px] rounded-2xl border border-white/10 object-contain"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {failModalOpen && (
        <div className="fixed inset-0 z-[320] overflow-y-auto overscroll-contain bg-[#120a2e]/92">
          <div className="flex min-h-full items-start justify-center px-4 pb-6 pt-10">
            <div className="flex max-h-[calc(100vh-5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#4a3099] shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <h3 className="text-xl font-semibold">Report Failed Collection</h3>
                  <p className="mt-1 text-sm text-white/75">
                    Add the failure reason and any useful evidence.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeFailModal}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/85">Failure Reason</label>
                    <select
                      value={failureReason}
                      onChange={(event) => setFailureReason(event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-[#5a3aa8] px-4 py-3 text-white outline-none"
                    >
                      {FAILURE_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/85">Notes</label>
                    <textarea
                      value={failureNotes}
                      onChange={(event) => setFailureNotes(event.target.value)}
                      rows={5}
                      className="w-full rounded-2xl border border-white/15 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/35"
                      placeholder="What happened on site?"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/85">Photo Evidence</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                      className="w-full rounded-2xl border border-white/15 bg-[#5a3aa8] px-4 py-3 text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  onClick={closeFailModal}
                  className="rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFail}
                  disabled={saving}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Submit Failed Collection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}