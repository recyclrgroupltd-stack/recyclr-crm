"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders } from "../../lib/auth";
import { getWasteStreamStyle } from "../../lib/wasteStreams";

type JobStatus = "scheduled" | "collected" | "failed" | "cancelled" | string;
type ViewMode = "table" | "board" | "exceptions";
type QuickRange = "all" | "today" | "next_7" | "failed" | "overdue";

type Job = {
  id: number;
  service_id?: number | null;
  customer_id?: number | null;
  customer_uid?: string;
  customer: string;
  site_id?: number | null;
  site: string;
  site_address?: string;
  site_postcode?: string;
  date: string;
  date_time?: string;
  waste_type: string;
  bin: string;
  bin_quantity?: number;
  bin_size?: string;
  status: JobStatus;
  customer_status?: string;
  service_status?: string;
  schedule_type?: string;
  collection_days?: string[];
  schedule_start_date?: string;
  account_manager?: string;
  haulier: string;
  failure_reason?: string;
  failure_notes?: string;
  notes?: string;
  rescheduled_to?: string;
  evidence_image_url?: string;
  status_updated_by?: string;
  status_updated_at?: string;
  created_at?: string;
  completed_at?: string;
};

const FAILURE_REASONS = [
  { value: "blocked_access", label: "Blocked Access" },
  { value: "not_presented", label: "Bin Not Presented" },
  { value: "contaminated", label: "Contaminated" },
  { value: "overweight", label: "Overweight" },
  { value: "closed", label: "Site Closed" },
  { value: "other", label: "Other" },
];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseLocalDate(value: string) {
  const [year, month, day] = (value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = parseLocalDate(value.slice(0, 10));
  if (!date) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(value: string) {
  return (value || "")
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isOverdue(job: Job, today: string) {
  return job.status === "scheduled" && job.date < today;
}

function statusClass(status: JobStatus) {
  if (status === "overdue") return "bg-red-100 text-red-800";
  if (status === "scheduled") return "bg-blue-100 text-blue-800";
  if (status === "collected") return "bg-emerald-100 text-emerald-800";
  if (status === "failed") return "bg-red-100 text-red-800";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  return "bg-violet-100 text-violet-800";
}

function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(status)}`}>
      {titleCase(status)}
    </span>
  );
}

function WasteChip({ value }: { value: string }) {
  const style = getWasteStreamStyle(value);
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${style.chipClass}`}>
      {style.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "violet",
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "violet" | "blue" | "green" | "red" | "orange";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    violet: "bg-violet-600",
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    red: "bg-red-600",
    orange: "bg-orange-500",
  };

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-lg bg-white p-5 text-left shadow-sm transition ${
        onClick ? "hover:-translate-y-0.5" : ""
      } ${active ? "ring-2 ring-violet-400" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${tones[tone]} text-sm font-black text-white`}>
          {String(label).charAt(0)}
        </div>
        <div>
          <div className="text-3xl font-black text-slate-950">{value}</div>
          <div className="text-sm font-bold text-slate-950">{label}</div>
          <div className="mt-1 text-xs font-semibold text-violet-700">{hint}</div>
        </div>
      </div>
    </Wrapper>
  );
}

function actionButtonClass(tone: "green" | "red" | "slate" | "violet" | "blue") {
  const tones = {
    green: "bg-emerald-600 text-white hover:bg-emerald-700",
    red: "bg-red-600 text-white hover:bg-red-700",
    slate: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
    violet: "bg-violet-700 text-white hover:bg-violet-800",
    blue: "bg-blue-600 text-white hover:bg-blue-700",
  };
  return `rounded-md px-3 py-2 text-xs font-black transition ${tones[tone]}`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quickRange, setQuickRange] = useState<QuickRange>("next_7");
  const [search, setSearch] = useState("");
  const [haulierFilter, setHaulierFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState("blocked_access");
  const [failureNotes, setFailureNotes] = useState("");
  const [rescheduleEnabled, setRescheduleEnabled] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const today = localDateString();
  const nextSeven = localDateString(addDays(new Date(), 7));

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!failModalOpen && !selectedJob) return;
    const oldBody = document.body.style.overflow;
    const oldHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldBody;
      document.documentElement.style.overflow = oldHtml;
    };
  }, [failModalOpen, selectedJob]);

  async function loadJobs() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/jobs/", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Failed to load jobs.");
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  async function updateJobStatus(jobId: number, status: JobStatus) {
    try {
      setUpdatingId(jobId);
      setError("");
      setMessage("");
      const formData = new FormData();
      formData.append("status", status);
      formData.append("status_updated_by", localStorage.getItem("recyclr_staff_name") || "Staff");

      const response = await fetch(`/api/jobs/${jobId}/update/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Failed to update job.");
      setMessage(data.message || "Job updated.");
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openFailModal(jobId: number) {
    setSelectedJobId(jobId);
    setFailureReason("blocked_access");
    setFailureNotes("");
    setRescheduleEnabled(false);
    setRescheduleDate("");
    setEvidenceFile(null);
    setFailModalOpen(true);
  }

  function closeFailModal() {
    setFailModalOpen(false);
    setSelectedJobId(null);
  }

  async function confirmFail() {
    if (!selectedJobId) return;
    try {
      setUpdatingId(selectedJobId);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("status", "failed");
      formData.append("reason", failureReason);
      formData.append("failure_notes", failureNotes);
      formData.append("status_updated_by", localStorage.getItem("recyclr_staff_name") || "Staff");
      if (rescheduleEnabled && rescheduleDate) formData.append("reschedule_date", rescheduleDate);
      if (evidenceFile) formData.append("evidence_image", evidenceFile);

      const response = await fetch(`/api/jobs/${selectedJobId}/update/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Failed to fail job.");
      setMessage(data.rescheduled_job ? "Job failed and a retry job was scheduled." : "Job marked as failed.");
      closeFailModal();
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fail job.");
    } finally {
      setUpdatingId(null);
    }
  }

  const uniqueHauliers = useMemo(() => {
    return Array.from(new Set(jobs.map((job) => job.haulier || "Unassigned"))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [jobs]);

  const summary = useMemo(() => {
    const windowJobs = jobs.filter((job) => job.date >= today && job.date <= nextSeven);
    const dueToday = windowJobs.filter((job) => job.date === today && job.status === "scheduled").length;
    const overdue = jobs.filter((job) => isOverdue(job, today)).length;
    const failed = jobs.filter((job) => job.status === "failed").length;
    const scheduled = windowJobs.filter((job) => job.status === "scheduled").length;
    const unassigned = windowJobs.filter((job) => (job.haulier || "Unassigned") === "Unassigned").length;
    const completedToday = jobs.filter((job) => job.date === today && job.status === "collected").length;
    const completedWindow = windowJobs.filter((job) => job.status === "collected").length;
    const completionRate = windowJobs.length ? Math.round((completedWindow / windowJobs.length) * 100) : 0;
    return {
      dueToday,
      overdue,
      failed,
      scheduled,
      unassigned,
      completedToday,
      completedWindow,
      completionRate,
      windowTotal: windowJobs.length,
      total: jobs.length,
    };
  }, [jobs, today, nextSeven]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (haulierFilter !== "all" && (job.haulier || "Unassigned") !== haulierFilter) return false;
      if (quickRange === "today" && job.date !== today) return false;
      if (quickRange === "next_7" && (job.date < today || job.date > nextSeven)) return false;
      if (quickRange === "failed" && job.status !== "failed") return false;
      if (quickRange === "overdue" && !isOverdue(job, today)) return false;
      if (!query) return true;

      return [
        job.customer,
        job.customer_uid,
        job.site,
        job.site_address,
        job.site_postcode,
        job.haulier,
        job.waste_type,
        job.bin,
        job.account_manager,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [jobs, statusFilter, haulierFilter, quickRange, search, today, nextSeven]);

  const attentionJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status === "failed" || isOverdue(job, today))
      .sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer));
  }, [jobs, today]);

  const todayByHaulier = useMemo(() => {
    const groups = new Map<string, Job[]>();
    filteredJobs
      .filter((job) => job.date === today)
      .forEach((job) => {
        const key = job.haulier || "Unassigned";
        groups.set(key, [...(groups.get(key) || []), job]);
      });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredJobs, today]);

  function failureReasonLabel(value?: string) {
    if (!value) return "No reason set";
    return FAILURE_REASONS.find((reason) => reason.value === value)?.label || titleCase(value);
  }

  function renderJobActions(job: Job) {
    if (job.status !== "scheduled") {
      return (
        <button type="button" className={actionButtonClass("slate")} onClick={() => setSelectedJob(job)}>
          Details
        </button>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={actionButtonClass("green")}
          disabled={updatingId === job.id}
          onClick={() => updateJobStatus(job.id, "collected")}
        >
          Collected
        </button>
        <button
          type="button"
          className={actionButtonClass("red")}
          disabled={updatingId === job.id}
          onClick={() => openFailModal(job.id)}
        >
          Failed
        </button>
        <button type="button" className={actionButtonClass("slate")} onClick={() => setSelectedJob(job)}>
          Details
        </button>
      </div>
    );
  }

  function renderCustomerLink(job: Job) {
    const label = (
      <>
        <span className="font-black text-slate-950">{job.customer}</span>
        <span className="block text-xs font-semibold text-slate-500">
          {job.customer_uid || "Customer"} {job.account_manager ? `- ${job.account_manager}` : ""}
        </span>
      </>
    );
    if (!job.customer_id) return label;
    return <Link href={`/customers/${job.customer_id}`} className="hover:text-violet-700">{label}</Link>;
  }

  return (
    <StaffShell title="Jobs">
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {message}
          </div>
        )}

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-3xl font-black text-slate-950">Jobs</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Live collection control for the next 7 days, plus failed and overdue exceptions.
            </p>
          </div>
          <span className="rounded-md bg-violet-50 px-4 py-3 text-sm font-black text-violet-800">
            Window: {formatDate(today)} - {formatDate(nextSeven)}
          </span>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Due Today" value={summary.dueToday} hint={`${summary.completedToday} collected today`} tone="blue" active={quickRange === "today"} onClick={() => setQuickRange("today")} />
          <StatCard label="Next 7 Days" value={summary.windowTotal} hint={`${summary.scheduled} still scheduled`} tone="violet" active={quickRange === "next_7"} onClick={() => setQuickRange("next_7")} />
          <StatCard label="Exceptions" value={summary.overdue + summary.failed} hint="Overdue or failed" tone="red" active={viewMode === "exceptions"} onClick={() => setViewMode("exceptions")} />
          <StatCard label="Unassigned" value={summary.unassigned} hint="Needs haulier" tone="orange" active={haulierFilter === "Unassigned"} onClick={() => setHaulierFilter("Unassigned")} />
          <StatCard label="Completion" value={`${summary.completionRate}%`} hint={`${summary.completedWindow}/${summary.windowTotal} in window`} tone="green" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-64 flex-1">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Customer, site, postcode, haulier, account manager..."
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-violet-500"
                />
              </label>
              <label className="min-w-44">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-black text-slate-950"
                >
                  <option value="all">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="collected">Collected</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="min-w-52">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Haulier</span>
                <select
                  value={haulierFilter}
                  onChange={(event) => setHaulierFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-black text-slate-950"
                >
                  <option value="all">All hauliers</option>
                  {uniqueHauliers.map((haulier) => (
                    <option key={haulier} value={haulier}>{haulier}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["today", "Today"],
                ["next_7", "Next 7 Days"],
                ["overdue", "Overdue"],
                ["failed", "Failed"],
                ["all", "All Records"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuickRange(value as QuickRange)}
                  className={`rounded-md px-4 py-2 text-xs font-black transition ${
                    quickRange === value ? "bg-violet-700 text-white" : "bg-violet-50 text-violet-800 hover:bg-violet-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {[
                ["table", "Table"],
                ["board", "Today Board"],
                ["exceptions", "Exceptions"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setViewMode(value as ViewMode)}
                  className={`rounded-md px-4 py-2 text-xs font-black transition ${
                    viewMode === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Needs Attention</h2>
                <p className="text-sm font-semibold text-slate-600">Overdue and failed collections.</p>
              </div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-black text-red-700">{attentionJobs.length}</span>
            </div>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {attentionJobs.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">
                  No overdue or failed jobs right now.
                </div>
              )}
              {attentionJobs.slice(0, 8).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJob(job)}
                  className="w-full rounded-md bg-violet-50 p-3 text-left transition hover:bg-violet-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950">{job.customer}</div>
                      <div className="text-xs font-semibold text-slate-600">{job.site} - {formatDate(job.date)}</div>
                    </div>
                    <StatusPill status={isOverdue(job, today) ? "overdue" : job.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg bg-white p-8 text-center text-sm font-black text-slate-600 shadow-sm">Loading jobs...</div>
        ) : viewMode === "board" ? (
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Today Board</h2>
                <p className="text-sm font-semibold text-slate-600">{formatDate(today)} grouped by haulier.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-800">
                {filteredJobs.filter((job) => job.date === today).length} jobs
              </span>
            </div>
            {todayByHaulier.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
                No jobs due today for the current filters.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                {todayByHaulier.map(([haulier, rows]) => (
                  <div key={haulier} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-black text-slate-950">{haulier}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">{rows.length}</span>
                    </div>
                    <div className="space-y-3">
                      {rows.map((job) => (
                        <div key={job.id} className="rounded-md bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>{renderCustomerLink(job)}</div>
                            <StatusPill status={job.status} />
                          </div>
                          <div className="mt-2 text-xs font-semibold text-slate-600">{job.site}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <WasteChip value={job.waste_type} />
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{job.bin}</span>
                          </div>
                          <div className="mt-3">{renderJobActions(job)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : viewMode === "exceptions" ? (
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Exceptions</h2>
            <p className="text-sm font-semibold text-slate-600">Failed jobs and overdue scheduled work that needs a decision.</p>
            <div className="mt-4 space-y-3">
              {attentionJobs.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
                  Nothing needs review.
                </div>
              )}
              {attentionJobs.map((job) => (
                <div key={job.id} className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1.3fr_0.8fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {renderCustomerLink(job)}
                      <WasteChip value={job.waste_type} />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-600">{job.site} {job.site_postcode ? `- ${job.site_postcode}` : ""}</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    <div>{formatDate(job.date)}</div>
                    <div>{job.status === "failed" ? failureReasonLabel(job.failure_reason) : "Overdue scheduled job"}</div>
                  </div>
                  <div>{renderJobActions(job)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-xl font-black text-slate-950">Job List</h2>
                <p className="text-sm font-semibold text-slate-600">{filteredJobs.length} matching jobs.</p>
              </div>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                No jobs match these filters. Generate jobs after services have active schedules.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Site</th>
                      <th className="px-4 py-3">Stream</th>
                      <th className="px-4 py-3">Bin</th>
                      <th className="px-4 py-3">Haulier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredJobs.map((job) => (
                      <tr key={job.id} className={isOverdue(job, today) ? "bg-red-50" : "bg-white"}>
                        <td className="whitespace-nowrap px-4 py-4 font-black text-slate-950">{formatDate(job.date)}</td>
                        <td className="px-4 py-4">{renderCustomerLink(job)}</td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-950">{job.site}</div>
                          <div className="text-xs font-semibold text-slate-500">{job.site_postcode || job.site_address || "-"}</div>
                        </td>
                        <td className="px-4 py-4"><WasteChip value={job.waste_type} /></td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-700">{job.bin}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-700">{job.haulier || "Unassigned"}</td>
                        <td className="px-4 py-4"><StatusPill status={isOverdue(job, today) ? "overdue" : job.status} /></td>
                        <td className="px-4 py-4">{renderJobActions(job)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {failModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Mark Job Failed</h2>
                <p className="text-sm font-semibold text-slate-600">Record why it failed and optionally create a retry job.</p>
              </div>
              <button type="button" onClick={closeFailModal} className={actionButtonClass("slate")}>Close</button>
            </div>

            <div className="mt-5 grid gap-4">
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Reason</span>
                <select
                  value={failureReason}
                  onChange={(event) => setFailureReason(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  {FAILURE_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</span>
                <textarea
                  value={failureNotes}
                  onChange={(event) => setFailureNotes(event.target.value)}
                  rows={4}
                  placeholder="Access issue, contamination details, who was spoken to..."
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950"
                />
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Evidence Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950"
                />
              </label>
              <label className="flex items-center gap-3 text-sm font-black text-slate-900">
                <input
                  type="checkbox"
                  checked={rescheduleEnabled}
                  onChange={(event) => setRescheduleEnabled(event.target.checked)}
                  className="h-4 w-4"
                />
                Create a retry collection
              </label>
              {rescheduleEnabled && (
                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Retry Date</span>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950"
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeFailModal} className={actionButtonClass("slate")}>Cancel</button>
              <button
                type="button"
                onClick={confirmFail}
                disabled={updatingId === selectedJobId}
                className={actionButtonClass("red")}
              >
                Confirm Failed
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Job #{selectedJob.id}</h2>
                <p className="text-sm font-semibold text-slate-600">{selectedJob.customer} - {selectedJob.site}</p>
              </div>
              <button type="button" onClick={() => setSelectedJob(null)} className={actionButtonClass("slate")}>Close</button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Collection</div>
                <div className="mt-1 font-black text-slate-950">{formatDate(selectedJob.date)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-2"><StatusPill status={isOverdue(selectedJob, today) ? "overdue" : selectedJob.status} /></div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Waste Stream</div>
                <div className="mt-2"><WasteChip value={selectedJob.waste_type} /></div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Bin</div>
                <div className="mt-1 font-black text-slate-950">{selectedJob.bin}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Haulier</div>
                <div className="mt-1 font-black text-slate-950">{selectedJob.haulier || "Unassigned"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Account Manager</div>
                <div className="mt-1 font-black text-slate-950">{selectedJob.account_manager || "-"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Site Address</div>
              <div className="mt-1 font-semibold text-slate-950">{selectedJob.site_address || selectedJob.site_postcode || "-"}</div>
            </div>

            {(selectedJob.failure_reason || selectedJob.failure_notes || selectedJob.evidence_image_url) && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="font-black text-red-900">Failure Details</div>
                <div className="mt-2 text-sm font-semibold text-red-800">
                  {failureReasonLabel(selectedJob.failure_reason)}
                  {selectedJob.failure_notes ? ` - ${selectedJob.failure_notes}` : ""}
                </div>
                {selectedJob.evidence_image_url && (
                  <a href={selectedJob.evidence_image_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-black text-red-700 underline">
                    Open evidence image
                  </a>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {selectedJob.customer_id && (
                <Link href={`/customers/${selectedJob.customer_id}`} className={actionButtonClass("violet")}>
                  Open Customer
                </Link>
              )}
              {selectedJob.service_id && (
                <Link href={`/services/${selectedJob.service_id}`} className={actionButtonClass("blue")}>
                  Open Service
                </Link>
              )}
              <button type="button" onClick={() => setSelectedJob(null)} className={actionButtonClass("slate")}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
