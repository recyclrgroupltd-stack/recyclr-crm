"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders, getStoredUser, StoredUser } from "@/lib/auth";
import { getWasteStreamStyle } from "@/lib/wasteStreams";

type CustomerInfo = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  account_manager?: {
    id: number;
    username: string;
    name: string;
    company_email: string;
    company_phone: string;
    job_title: string;
  } | null;
  billing?: BillingSettings;
  notes: string;
  created_at: string;
};

type BillingSettings = {
  invoice_requires_po: boolean;
  invoice_payment_terms_days: number;
  invoice_email: string;
  invoice_po_number: string;
  auto_invoice_enabled: boolean;
  next_invoice_date: string;
  last_invoiced_at: string;
};

type Summary = {
  site_count: number;
  service_count: number;
  active_service_count: number;
  quote_count: number;
  document_count: number;
  monthly_value: number;
  latest_quote_status: string;
};

type SiteRow = {
  id: number;
  site_name: string;
  address: string;
  postcode: string;
};

type ServiceRow = {
  id: number;
  site_name: string;
  waste_type: string;
  bin_size: string;
  status: string;
  collections_per_week: number;
  monthly_value: number;
};

type DocumentRow = {
  id: number;
  quote_id: number;
  quote_number: string;
  filename: string;
  version_number: number;
  created_at: string;
  file_size_bytes: number;
  download_url: string;
};

type NoteRow = {
  id: number;
  note: string;
  created_by: string;
  created_at: string;
};

type ActivityRow = {
  id: number;
  activity_type: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  site_name: string;
  related_quote_number: string;
  related_service_id: number | null;
  related_document_id: number | null;
};

type EmailRow = {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
  sent_by: string;
};

type InvoiceRow = {
  id: number;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  po_required: boolean;
  po_number: string;
  payment_terms_days: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: string;
  created_at: string;
  sent_at: string;
  lines: {
    id: number;
    service_id: number | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
};

type OverviewResponse = {
  customer: CustomerInfo;
  summary: Summary;
  sites: SiteRow[];
  services: ServiceRow[];
  quotes: {
    id: number;
    quote_number: string;
    title: string;
    status: string;
    site_name: string;
    total_per_month: number;
    created_at: string;
    document_count: number;
  }[];
  documents: DocumentRow[];
  invoices: InvoiceRow[];
  note_entries: NoteRow[];
  activity_entries: ActivityRow[];
};

type StaffOption = {
  id: number;
  username: string;
  role?: string;
  profile?: {
    company_email?: string;
    company_phone?: string;
    job_title?: string;
    auto_assign_customers?: boolean;
  };
};

type HistoryTab = "all" | "collections" | "emails" | "invoices" | "pdfs" | "documents" | "notes";

type CollectionJobRow = {
  id: number;
  service_id: number | null;
  customer_id: number;
  customer: string;
  site_id: number | null;
  site: string;
  date: string;
  date_time: string;
  waste_type: string;
  bin: string;
  bin_quantity: number;
  bin_size: string;
  status: string;
  failure_reason: string;
  reason: string;
  failure_notes: string;
  haulier: string;
  notes: string;
  rescheduled_to: string;
  evidence_image_url: string;
  status_updated_by: string;
  status_updated_at: string;
};


type LegalDocumentRow = {
  id: number;
  document_type: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  file_url: string;
  filename: string;
};

type LegalDocumentApiRow = Partial<LegalDocumentRow> & {
  type?: string;
  name?: string;
  file_name?: string;
  download_url?: string;
  url?: string;
  file?: string;
};

type CustomerJobsResponse = {
  success: boolean;
  summary: {
    total_events: number;
    collected: number;
    failed: number;
    scheduled: number;
    cancelled: number;
  };
  rows: CollectionJobRow[];
  filters: {
    sites: string[];
    streams: string[];
    statuses: string[];
  };
};

type UnifiedActivityRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  site_name: string;
};

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function formatStatus(value: string) {
  if (!value) return "-";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function customerStatusClass(value: string) {
  const normalised = (value || "").toLowerCase();
  if (normalised === "active") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (normalised === "onboarding") {
    return "bg-amber-100 text-amber-800";
  }
  if (normalised === "ready_for_setup") {
    return "bg-blue-100 text-blue-800";
  }
  if (normalised === "inactive") {
    return "bg-slate-200 text-slate-700";
  }
  return "bg-violet-100 text-violet-800";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatLabel(value: string) {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function dateValue(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

const historyTabs: { key: HistoryTab; label: string }[] = [
  { key: "all", label: "All Activity" },
  { key: "collections", label: "Collections" },
  { key: "emails", label: "Emails" },
  { key: "invoices", label: "Invoices" },
  { key: "pdfs", label: "PDFs" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" },
];

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function ActivityBadge({ type }: { type: string }) {
  const value = (type || "system").toLowerCase();

  const className =
    value === "note"
      ? "bg-blue-200 text-blue-900"
      : value === "quote"
      ? "bg-emerald-200 text-emerald-900"
      : value === "service"
      ? "bg-purple-200 text-purple-900"
      : value === "pdf"
      ? "bg-amber-200 text-amber-900"
      : value === "collection"
      ? "bg-red-200 text-red-900"
      : value === "email"
      ? "bg-cyan-200 text-cyan-900"
      : "bg-white/80 text-[#412a8a]";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {formatLabel(type)}
    </span>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function WasteStreamChip({ value }: { value: string }) {
  const style = getWasteStreamStyle(value);
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${style.chipClass}`}>
      {style.label}
    </span>
  );
}

function SendEmailBox({
  customerId,
  email,
  onSent,
}: {
  customerId: number;
  email: string;
  onSent: () => void;
}) {
  const [to, setTo] = useState(email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTo(email || "");
  }, [email]);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("Please complete To, Subject and Message.");
      setMessage("");
      return;
    }

    setSending(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/communications/send/", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          customer_id: customerId,
          to_email: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send email.");
      }

      setMessage("Email sent successfully.");
      setSubject("");
      setBody("");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
      <h2 className="text-lg font-semibold">Send Email</h2>
      <p className="mt-1 text-sm font-medium text-slate-500">
        Send a basic email to this customer and keep a record inside the CRM.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-2 block text-sm text-slate-600">To</label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="customer@email.com"
            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-600">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-600">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email here..."
            rows={6}
            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
          />
        </div>

        {(message || error) && (
          <div className="space-y-2">
            {message ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailHistory({ customerId, refreshKey }: { customerId: number; refreshKey: number }) {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmails() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/communications/customer/${customerId}/`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error("Failed to load emails.");
        }

        setEmails(Array.isArray(data) ? data : []);
      } catch {
        setError("Could not load customer emails.");
      } finally {
        setLoading(false);
      }
    }

    loadEmails();
  }, [customerId, refreshKey]);

  if (loading) {
    return <div className="text-sm font-medium text-slate-500">Loading emails...</div>;
  }

  if (error) {
    return <div className="text-sm font-medium text-red-700">{error}</div>;
  }

  if (emails.length === 0) {
    return <div className="text-sm font-medium text-slate-500">No emails recorded for this customer yet.</div>;
  }

  return (
    <div className="space-y-3">
      {emails.map((email) => (
        <div key={email.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold">{email.subject || "(No subject)"}</div>
              <div className="mt-1 text-xs text-slate-500">
                To: {email.to_email} • By: {email.sent_by || "Unknown"} • {formatDate(email.sent_at)}
              </div>
            </div>
            <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
              {formatStatus(email.status)}
            </div>
          </div>
          <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{email.body || "-"}</div>
        </div>
      ))}
    </div>
  );
}

export default function CustomerOverviewPage() {
  const params = useParams();
  const customerId = Number(params.id);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [selectedServiceSite, setSelectedServiceSite] = useState("");
  const [emailRefreshKey, setEmailRefreshKey] = useState(0);
  const [legalDocuments, setLegalDocuments] = useState<LegalDocumentRow[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");

  const [quickNote, setQuickNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [noteError, setNoteError] = useState("");

  const [staffUsername, setStaffUsername] = useState("");
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [managerSaving, setManagerSaving] = useState(false);
  const [managerMessage, setManagerMessage] = useState("");
  const [managerError, setManagerError] = useState("");
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceError, setInvoiceError] = useState("");

  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionsError, setCollectionsError] = useState("");
  const [collectionsSummary, setCollectionsSummary] = useState({
    total_events: 0,
    collected: 0,
    failed: 0,
    scheduled: 0,
    cancelled: 0,
  });
  const [collectionRows, setCollectionRows] = useState<CollectionJobRow[]>([]);
  const [collectionFilterSite, setCollectionFilterSite] = useState("all");
  const [collectionFilterStream, setCollectionFilterStream] = useState("all");
  const [collectionFilterStatus, setCollectionFilterStatus] = useState("all");
  const [collectionSiteOptions, setCollectionSiteOptions] = useState<string[]>([]);
  const [collectionStreamOptions, setCollectionStreamOptions] = useState<string[]>([]);
  const [selectedCollectionRow, setSelectedCollectionRow] = useState<CollectionJobRow | null>(null);

  useEffect(() => {
    const storedUsername =
      window.localStorage.getItem("staff_username") ||
      window.localStorage.getItem("username") ||
      "";
    setStaffUsername(storedUsername);
    setCurrentUser(getStoredUser());
  }, []);

  const canChangeAccountManager = ["admin", "manager", "admin_1", "admin_2"].includes(currentUser?.role || "");

  useEffect(() => {
    async function loadOverview() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/customers/${customerId}/overview/`);
        const json = (await res.json()) as OverviewResponse;

        if (!res.ok) {
          throw new Error("Failed to load customer overview.");
        }

        setData(json);
        setSelectedManagerId(json.customer?.account_manager?.id ? String(json.customer.account_manager.id) : "");
      } catch {
        setError("Could not load customer overview.");
      } finally {
        setLoading(false);
      }
    }

    if (customerId) {
      loadOverview();
    }
  }, [customerId]);

  useEffect(() => {
    if (!canChangeAccountManager) return;

    async function loadStaffOptions() {
      try {
        const response = await fetch("/api/auth/staff/", {
          headers: getAuthHeaders(),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || "Could not load staff.");
        setStaffOptions((json.staff || []).filter((user: StaffOption) => user.id && user.username));
      } catch {
        setStaffOptions([]);
      }
    }

    loadStaffOptions();
  }, [canChangeAccountManager]);

  async function updateAccountManager() {
    if (!selectedManagerId) return;
    setManagerSaving(true);
    setManagerMessage("");
    setManagerError("");

    try {
      const response = await fetch(`/api/customers/${customerId}/account-manager/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ account_manager_id: Number(selectedManagerId) }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "Could not update account manager.");

      const refresh = await fetch(`/api/customers/${customerId}/overview/`);
      const refreshJson = await refresh.json();
      if (refresh.ok) {
        setData(refreshJson);
        setSelectedManagerId(refreshJson.customer?.account_manager?.id ? String(refreshJson.customer.account_manager.id) : "");
      }
      const emailStatus = String(json.email_status || "not sent").toLowerCase();
      setManagerMessage(
        emailStatus === "sent"
          ? "Account manager updated and customer emailed."
          : emailStatus === "failed"
            ? "Account manager updated. Customer email could not be sent right now."
            : "Account manager updated."
      );
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : "Could not update account manager.");
    } finally {
      setManagerSaving(false);
    }
  }

  async function refreshOverview() {
    const refresh = await fetch(`/api/customers/${customerId}/overview/`);
    const refreshJson = await refresh.json();
    if (refresh.ok) {
      setData(refreshJson);
      setSelectedManagerId(refreshJson.customer?.account_manager?.id ? String(refreshJson.customer.account_manager.id) : "");
    }
  }

  async function generateCustomerInvoice() {
    setInvoiceGenerating(true);
    setInvoiceMessage("");
    setInvoiceError("");

    try {
      const response = await fetch(`/api/customers/${customerId}/invoices/generate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Could not generate invoice.");
      }

      setInvoiceMessage(json.message || "Invoice generated.");
      await refreshOverview();
      setActiveTab("invoices");
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Could not generate invoice.");
    } finally {
      setInvoiceGenerating(false);
    }
  }


  useEffect(() => {
    async function loadLegalDocuments() {
      try {
        setDocumentsLoading(true);
        setDocumentsError("");

        const res = await fetch(`/api/documents/customer/${customerId}/`);
        const json: unknown = await res.json();

        if (!res.ok) {
          throw new Error("Failed to load customer documents.");
        }

        const rows: LegalDocumentApiRow[] = Array.isArray(json)
          ? (json as LegalDocumentApiRow[])
          : isRecord(json) && Array.isArray(json.documents)
          ? (json.documents as LegalDocumentApiRow[])
          : [];
        setLegalDocuments(
          rows.map((row) => ({
            id: Number(row.id || 0),
            document_type: row.document_type || row.type || "",
            title: row.title || row.name || row.file_name || "Document",
            status: row.status || "generated",
            created_at: row.created_at || "",
            updated_at: row.updated_at || row.created_at || "",
            file_url:
              row.download_url ||
              row.file_url ||
              row.url ||
              row.file ||
              "",
            filename:
              row.filename ||
              row.file_name ||
              row.title ||
              "document.pdf",
          }))
        );
      } catch {
        setDocumentsError("Could not load generated onboarding documents.");
      } finally {
        setDocumentsLoading(false);
      }
    }

    if (customerId) {
      loadLegalDocuments();
    }
  }, [customerId]);

  useEffect(() => {
    async function loadCollections() {
      try {
        setCollectionsLoading(true);
        setCollectionsError("");

        const res = await fetch(`/api/jobs/customer/${customerId}/`);
        const json: CustomerJobsResponse = await res.json();

        if (!res.ok || !json.success) {
          throw new Error("Failed to load customer collections.");
        }

        const sortedRows = (Array.isArray(json.rows) ? json.rows : []).sort((a, b) => {
          return dateValue(a.date_time || a.date) - dateValue(b.date_time || b.date);
        });

        setCollectionsSummary(json.summary);
        setCollectionRows(sortedRows);
        setCollectionSiteOptions(Array.isArray(json.filters?.sites) ? json.filters.sites : []);
        setCollectionStreamOptions(Array.isArray(json.filters?.streams) ? json.filters.streams : []);
      } catch {
        setCollectionsError("Could not load real collection history for this customer.");
      } finally {
        setCollectionsLoading(false);
      }
    }

    if (customerId) {
      loadCollections();
    }
  }, [customerId]);

  useEffect(() => {
    if (!selectedCollectionRow) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [selectedCollectionRow]);

  const filteredServices = useMemo(() => {
    if (!data) return [];
    if (selectedServiceSite === "") return [];
    if (selectedServiceSite === "all") return data.services;
    return data.services.filter((service) => service.site_name === selectedServiceSite);
  }, [data, selectedServiceSite]);

  const filteredCollections = useMemo(() => {
    return collectionRows.filter((row) => {
      const siteMatch = collectionFilterSite === "all" ? true : row.site === collectionFilterSite;
      const streamMatch =
        collectionFilterStream === "all" ? true : row.waste_type === collectionFilterStream;
      const statusMatch =
        collectionFilterStatus === "all" ? true : row.status === collectionFilterStatus;

      return siteMatch && streamMatch && statusMatch;
    });
  }, [collectionRows, collectionFilterSite, collectionFilterStream, collectionFilterStatus]);

  const unifiedActivity = useMemo(() => {
    if (!data) return [];

    const activityRows: UnifiedActivityRow[] = (data.activity_entries || []).map((activity) => ({
      id: `activity-${activity.id}`,
      type: activity.activity_type || "system",
      title: activity.title || "Activity",
      description: activity.description || "",
      created_at: activity.created_at || "",
      created_by: activity.created_by || "",
      site_name: activity.site_name || "",
    }));

    const collectionActivityRows: UnifiedActivityRow[] = collectionRows.map((row) => ({
      id: `job-${row.id}`,
      type: "collection",
      title: `${formatStatus(row.status)} collection - ${formatLabel(row.waste_type)}`,
      description: [
        row.site ? `Site: ${row.site}` : "",
        row.haulier ? `Haulier: ${row.haulier}` : "",
        row.bin ? `Bin: ${row.bin}` : "",
        row.reason ? `Reason: ${formatStatus(row.reason)}` : "",
        row.failure_notes ? `Notes: ${row.failure_notes}` : "",
        row.rescheduled_to ? `Rescheduled To: ${formatDate(row.rescheduled_to)}` : "",
      ]
        .filter(Boolean)
        .join(" • "),
      created_at: row.date_time || row.date || "",
      created_by: row.haulier || "",
      site_name: row.site || "",
    }));

    return [...activityRows, ...collectionActivityRows].sort((a, b) => {
      return dateValue(a.created_at) - dateValue(b.created_at);
    });
  }, [data, collectionRows]);

  async function addQuickNote() {
    if (!quickNote.trim()) {
      setNoteError("Please write a note first.");
      setNoteMessage("");
      return;
    }

    setAddingNote(true);
    setNoteError("");
    setNoteMessage("");

    try {
      const res = await fetch(`/api/customers/${customerId}/notes/create/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note: quickNote.trim(),
          created_by: staffUsername,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to add note.");
      }

      setQuickNote("");
      setNoteMessage("Note added successfully.");

      const refresh = await fetch(`/api/customers/${customerId}/overview/`);
      const refreshJson = await refresh.json();
      if (refresh.ok) {
        setData(refreshJson);
      }
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Could not add note.");
    } finally {
      setAddingNote(false);
    }
  }

  function clearCollectionFilters() {
    setCollectionFilterSite("all");
    setCollectionFilterStream("all");
    setCollectionFilterStatus("all");
  }

  if (loading) {
    return (
      <StaffShell title="Customer Overview">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-6 text-slate-600 backdrop-blur-lg">
          Loading customer overview...
        </div>
      </StaffShell>
    );
  }

  if (error || !data) {
    return (
      <StaffShell title="Customer Overview">
        <div className="rounded-3xl border border-red-300/30 bg-red-500/20 p-6 text-white backdrop-blur-lg">
          {error || "Customer could not be loaded."}
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title={data.customer.business_name}>
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.65fr]">
          <div className="space-y-6">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold">{data.customer.business_name}</h1>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${customerStatusClass(data.customer.status)}`}>
                      {formatStatus(data.customer.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    Customer dashboard with overview, collections, communications, quotes,
                    documents, services, and notes.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/customers/${customerId}/edit`}
                    className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-800"
                  >
                    Edit Customer
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Monthly Revenue" value={formatMoney(data.summary.monthly_value)} />
                <MetricCard label="Active Services" value={data.summary.active_service_count} />
                <MetricCard label="Sites" value={data.summary.site_count} />
                <MetricCard label="Quote Status" value={formatStatus(data.summary.latest_quote_status)} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <DetailCard label="Customer ID" value={data.customer.customer_uid || "-"} />
                <DetailCard label="Contact" value={data.customer.contact_name || "-"} />
                <DetailCard label="Email" value={data.customer.email || "-"} />
                <DetailCard label="Phone" value={data.customer.phone || "-"} />
                <DetailCard label="Account Manager" value={data.customer.account_manager?.name || "-"} />
              </div>

              <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">Current Account Manager</div>
                    <div className="mt-1 text-lg font-black text-slate-950">
                      {data.customer.account_manager?.name || "Not assigned"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">
                      {[data.customer.account_manager?.company_email, data.customer.account_manager?.company_phone]
                        .filter(Boolean)
                        .join(" - ") || "No company contact details set"}
                    </div>
                  </div>

                  {canChangeAccountManager ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                          Reassign Manager
                        </label>
                        <select
                          value={selectedManagerId}
                          onChange={(event) => setSelectedManagerId(event.target.value)}
                          className="min-w-[260px] rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none"
                        >
                          <option value="">Choose staff member</option>
                          {staffOptions.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.username}
                              {user.profile?.job_title ? ` - ${user.profile.job_title}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={updateAccountManager}
                        disabled={managerSaving || !selectedManagerId}
                        className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {managerSaving ? "Saving..." : "Update Manager"}
                      </button>
                    </div>
                  ) : null}
                </div>
                {(managerMessage || managerError) ? (
                  <div className={`mt-3 text-sm font-bold ${managerError ? "text-red-700" : "text-emerald-700"}`}>
                    {managerError || managerMessage}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">Invoicing</div>
                    <div className="mt-1 text-lg font-black text-slate-950">
                      {data.customer.billing?.auto_invoice_enabled === false ? "Automatic invoicing off" : "Automatic invoicing on"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">
                      {data.customer.billing?.invoice_payment_terms_days || 30} day terms
                      {data.customer.billing?.invoice_requires_po ? " - PO required" : " - no PO required"}
                      {data.customer.billing?.invoice_po_number ? ` - PO ${data.customer.billing.invoice_po_number}` : ""}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      Invoice email: {data.customer.billing?.invoice_email || data.customer.email || "-"} - Next invoice:{" "}
                      {data.customer.billing?.next_invoice_date || "not scheduled"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={generateCustomerInvoice}
                    disabled={invoiceGenerating || (data.summary.active_service_count || 0) === 0}
                    className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {invoiceGenerating ? "Generating..." : "Generate Invoice"}
                  </button>
                </div>
                {(invoiceMessage || invoiceError) ? (
                  <div className={`mt-3 text-sm font-bold ${invoiceError ? "text-red-700" : "text-emerald-700"}`}>
                    {invoiceError || invoiceMessage}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="mb-4">
                <div className="text-sm font-medium text-slate-500">
                  Activity, collections, emails, PDFs, generated documents, and notes for this customer.
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {historyTabs.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-violet-700 text-white"
                          : "border border-violet-100 bg-violet-50 text-violet-800 hover:bg-violet-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                {activeTab === "all" ? (
                  unifiedActivity.length === 0 ? (
                    <div className="text-sm font-medium text-slate-500">No customer activity available yet.</div>
                  ) : (
                    <div className="max-h-[620px] overflow-y-auto pr-2">
                      <div className="space-y-3">
                        {unifiedActivity.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <ActivityBadge type={item.type} />
                                  <div className="text-sm font-bold text-slate-950">{item.title}</div>
                                </div>

                                {item.description ? (
                                  <div className="text-sm text-slate-600">{item.description}</div>
                                ) : null}

                                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                                  <span>{formatDate(item.created_at)}</span>
                                  {item.created_by ? <span>By: {item.created_by}</span> : null}
                                  {item.site_name ? <span>Site: {item.site_name}</span> : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : null}

                {activeTab === "collections" ? (
                  collectionsLoading ? (
                    <div className="text-sm font-medium text-slate-500">Loading real collection history...</div>
                  ) : collectionsError ? (
                    <div className="rounded-2xl border border-red-300/30 bg-red-500/20 p-4 text-sm text-white">
                      {collectionsError}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-xl font-semibold">Collections Dashboard</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                              Real collected, failed, scheduled, and cancelled jobs for this customer.
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-4">
                          <MetricCard label="Total Events" value={collectionsSummary.total_events} />
                          <MetricCard label="Collected" value={collectionsSummary.collected} />
                          <MetricCard label="Failed" value={collectionsSummary.failed} />
                          <MetricCard label="Scheduled" value={collectionsSummary.scheduled} />
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-4">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Site
                            </label>
                            <select
                              value={collectionFilterSite}
                              onChange={(e) => setCollectionFilterSite(e.target.value)}
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                            >
                              <option value="all">All sites</option>
                              {collectionSiteOptions.map((site) => (
                                <option key={site} value={site}>
                                  {site}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Stream
                            </label>
                            <select
                              value={collectionFilterStream}
                              onChange={(e) => setCollectionFilterStream(e.target.value)}
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                            >
                              <option value="all">All streams</option>
                              {collectionStreamOptions.map((stream) => (
                                <option key={stream} value={stream}>
                                  {formatLabel(stream)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Status
                            </label>
                            <select
                              value={collectionFilterStatus}
                              onChange={(e) => setCollectionFilterStatus(e.target.value)}
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                            >
                              <option value="all">All statuses</option>
                              <option value="scheduled">Scheduled</option>
                              <option value="collected">Collected</option>
                              <option value="failed">Failed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>

                          <div className="flex items-end">
                            <button
                              onClick={clearCollectionFilters}
                              className="w-full rounded-lg border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-800 transition hover:bg-violet-50"
                            >
                              Clear Filters
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="min-w-full text-left text-sm text-slate-700">
                            <thead className="sticky top-0 bg-slate-100 text-slate-600">
                              <tr>
                                <th className="px-4 py-3">Site</th>
                                <th className="px-4 py-3">Stream</th>
                                <th className="px-4 py-3">Bin</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Haulier</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCollections.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                                    No real collection rows matched your filters.
                                  </td>
                                </tr>
                              ) : (
                                filteredCollections.map((row) => (
                                  <tr
                                    key={row.id}
                                    onDoubleClick={() => setSelectedCollectionRow(row)}
                                    className="cursor-pointer border-t border-slate-100 transition hover:bg-violet-50"
                                    title="Double-click to view details"
                                  >
                                    <td className="px-4 py-3">{row.site || "-"}</td>
                                    <td className="px-4 py-3"><WasteStreamChip value={row.waste_type} /></td>
                                    <td className="px-4 py-3">{row.bin || "-"}</td>
                                    <td className="px-4 py-3">{formatDate(row.date_time || row.date)}</td>
                                    <td className="px-4 py-3">{row.haulier || "-"}</td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                                          row.status === "collected"
                                            ? "bg-emerald-200 text-emerald-900"
                                            : row.status === "failed"
                                            ? "bg-red-200 text-red-900"
                                            : row.status === "scheduled"
                                            ? "bg-blue-200 text-blue-900"
                                            : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {formatStatus(row.status)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {row.reason ? formatStatus(row.reason) : "-"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                ) : null}

                {activeTab === "emails" ? (
                  <EmailHistory customerId={customerId} refreshKey={emailRefreshKey} />
                ) : null}

                {activeTab === "invoices" ? (
                  (data.invoices || []).length === 0 ? (
                    <div className="text-sm font-medium text-slate-500">No invoices generated for this customer yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {(data.invoices || []).map((invoice) => (
                        <div
                          key={invoice.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold">{invoice.invoice_number}</div>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                                    invoice.status === "ready"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : invoice.status === "pending_po"
                                      ? "bg-amber-100 text-amber-800"
                                      : invoice.status === "sent"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {formatStatus(invoice.status)}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Issued {formatDate(invoice.issue_date)} - Due {formatDate(invoice.due_date)} -{" "}
                                {invoice.payment_terms_days} day terms
                              </div>
                              {invoice.po_required ? (
                                <div className="mt-2 text-sm font-bold text-amber-700">
                                  PO required{invoice.po_number ? `: ${invoice.po_number}` : " before sending"}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Total</div>
                              <div className="text-xl font-black text-slate-950">{formatMoney(invoice.total)}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Net {formatMoney(invoice.subtotal)} / VAT {formatMoney(invoice.vat_amount)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">Line</th>
                                  <th className="px-3 py-2">Qty</th>
                                  <th className="px-3 py-2">Unit</th>
                                  <th className="px-3 py-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoice.lines.map((line) => (
                                  <tr key={line.id} className="border-t border-slate-200">
                                    <td className="px-3 py-2 font-semibold text-slate-950">{line.description}</td>
                                    <td className="px-3 py-2">{line.quantity}</td>
                                    <td className="px-3 py-2">{formatMoney(line.unit_price)}</td>
                                    <td className="px-3 py-2 font-bold">{formatMoney(line.line_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}

                {activeTab === "pdfs" ? (
                  (data.documents || []).length === 0 ? (
                    <div className="text-sm font-medium text-slate-500">No PDFs saved for this customer yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {(data.documents || []).map((document) => (
                        <div
                          key={document.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold">{document.filename || "Document"}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Quote {document.quote_number} • Version {document.version_number} •{" "}
                                {formatDate(document.created_at)} • {formatFileSize(document.file_size_bytes)}
                              </div>
                            </div>
                            <a
                              href={`${document.download_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}


                {activeTab === "documents" ? (
                  documentsLoading ? (
                    <div className="text-sm font-medium text-slate-500">Loading generated documents...</div>
                  ) : documentsError ? (
                    <div className="rounded-2xl border border-red-300/30 bg-red-500/20 p-4 text-sm text-white">
                      {documentsError}
                    </div>
                  ) : legalDocuments.length === 0 ? (
                    <div className="text-sm font-medium text-slate-500">
                      No onboarding documents have been generated for this customer yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {legalDocuments.map((document) => {
                        const downloadHref = document.file_url
                          ? document.file_url.startsWith("http")
                            ? document.file_url
                            : `${document.file_url}`
                          : "";

                        return (
                          <div
                            key={document.id}
                            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="font-semibold">
                                  {document.title || formatLabel(document.document_type)}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {formatLabel(document.document_type)} • {formatStatus(document.status)} •{" "}
                                  {formatDate(document.created_at)}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                                  {formatStatus(document.status)}
                                </span>
                                {downloadHref ? (
                                  <a
                                    href={downloadHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800"
                                  >
                                    Download
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : null}

                {activeTab === "notes" ? (
                  (data.note_entries || []).length === 0 ? (
                    <div className="text-sm font-medium text-slate-500">
                      No notes available for this customer yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(data.note_entries || []).map((note) => (
                        <div
                          key={note.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold">
                                {note.created_by || "Unknown"}
                              </div>
                              <div className="mt-1 text-sm text-slate-700">{note.note}</div>
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDate(note.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <SendEmailBox
              customerId={customerId}
              email={data.customer.email}
              onSent={() => {
                setEmailRefreshKey((current) => current + 1);
                setActiveTab("emails");
              }}
            />

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold">Quick Note</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Add a customer note without opening Edit Customer.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Adding as: <span className="font-semibold text-slate-950">{staffUsername}</span>
                </div>

                <textarea
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Type a customer note here..."
                  rows={5}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-300"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={addQuickNote}
                    disabled={addingNote}
                    className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addingNote ? "Saving..." : "Add Note"}
                  </button>

                  {noteMessage && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
                      {noteMessage}
                    </div>
                  )}

                  {noteError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
                      {noteError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-xl font-semibold">Sites</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-3">Site</th>
                    <th className="pb-3">Address</th>
                    <th className="pb-3">Postcode</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sites.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="border-t border-slate-100 py-4 text-slate-500">
                        No sites linked to this customer yet.
                      </td>
                    </tr>
                  ) : (
                    data.sites.map((site) => (
                      <tr key={site.id} className="border-t border-slate-100">
                        <td className="py-3 font-medium">
                          <Link
                            href={`/sites/${site.id}`}
                            className="font-semibold text-violet-700 underline decoration-violet-200 underline-offset-4 transition hover:text-violet-950 hover:decoration-violet-400"
                          >
                            {site.site_name || "-"}
                          </Link>
                        </td>
                        <td className="py-3">{site.address || "-"}</td>
                        <td className="py-3">{site.postcode || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Services</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Filter services by site or view all sites.
                </p>
              </div>

              <div className="w-full md:w-[240px]">
                <select
                  value={selectedServiceSite}
                  onChange={(event) => setSelectedServiceSite(event.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  <option value="">Select site</option>
                  <option value="all">All sites</option>
                  {data.sites.map((site) => (
                    <option key={site.id} value={site.site_name}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              {selectedServiceSite === "" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                  Choose a site or select All sites to view services.
                </div>
              ) : (
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3">Site</th>
                      <th className="pb-3">Stream</th>
                      <th className="pb-3">Bin</th>
                      <th className="pb-3">Collections / Week</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Monthly Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="border-t border-slate-100 py-4 text-slate-500">
                          No services found for that selection.
                        </td>
                      </tr>
                    ) : (
                      filteredServices.map((service) => (
                        <tr key={service.id} className="border-t border-slate-100">
                          <td className="py-3">{service.site_name || "-"}</td>
                          <td className="py-3">{service.waste_type || "-"}</td>
                          <td className="py-3">{service.bin_size || "-"}</td>
                          <td className="py-3">{service.collections_per_week || 0}</td>
                          <td className="py-3">{formatStatus(service.status)}</td>
                          <td className="py-3">{formatMoney(service.monthly_value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedCollectionRow ? (
        <div
          className="fixed inset-0 z-[2147483647] overflow-y-auto overscroll-contain bg-[#120a2e]/92 backdrop-blur-[2px]"
          onClick={() => setSelectedCollectionRow(null)}
        >
          <div className="flex min-h-full w-full items-start justify-center px-4 pb-6 pt-28">
            <div
              className="flex max-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#4a3099] text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[#4a2ea8] p-6">
                <div>
                  <h2 className="text-2xl font-semibold">Collection Details</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Job #{selectedCollectionRow.id} • Double-clicked from the customer collections table.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedCollectionRow(null)}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailCard label="Site" value={selectedCollectionRow.site || "-"} />
                  <DetailCard label="Haulier" value={selectedCollectionRow.haulier || "-"} />
                  <DetailCard label="Stream" value={formatLabel(selectedCollectionRow.waste_type)} />
                  <DetailCard label="Bin" value={selectedCollectionRow.bin || "-"} />
                  <DetailCard label="Status" value={formatStatus(selectedCollectionRow.status)} />
                  <DetailCard
                    label="Reason"
                    value={selectedCollectionRow.reason ? formatStatus(selectedCollectionRow.reason) : "-"}
                  />
                  <DetailCard
                    label="Collection Date"
                    value={formatDate(selectedCollectionRow.date_time || selectedCollectionRow.date)}
                  />
                  <DetailCard label="Service ID" value={selectedCollectionRow.service_id || "-"} />
                  <DetailCard
                    label="Rescheduled To"
                    value={
                      selectedCollectionRow.rescheduled_to
                        ? formatDate(selectedCollectionRow.rescheduled_to)
                        : "-"
                    }
                  />
                  <DetailCard
                    label="Updated By"
                    value={selectedCollectionRow.status_updated_by || "-"}
                  />
                  <DetailCard
                    label="Updated At"
                    value={
                      selectedCollectionRow.status_updated_at
                        ? formatDate(selectedCollectionRow.status_updated_at)
                        : "-"
                    }
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      Failure Notes
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white">
                      {selectedCollectionRow.failure_notes || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      General Notes
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white">
                      {selectedCollectionRow.notes || "-"}
                    </div>
                  </div>
                </div>

                {selectedCollectionRow.evidence_image_url ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      Evidence Image
                    </div>
                    <div className="mt-3">
                      <a
                        href={selectedCollectionRow.evidence_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={selectedCollectionRow.evidence_image_url}
                          alt="Collection evidence"
                          className="max-h-[360px] rounded-2xl border border-white/10 object-contain"
                        />
                      </a>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {selectedCollectionRow.service_id ? (
                    <Link
                      href={`/services/${selectedCollectionRow.service_id}`}
                      className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#412a8a] transition hover:bg-white/90"
                    >
                      Open Related Service
                    </Link>
                  ) : null}

                  <button
                    onClick={() => setSelectedCollectionRow(null)}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </StaffShell>
  );
}
