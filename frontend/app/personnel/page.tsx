"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { apiPath, readApiPayload } from "@/lib/apiBase";
import { canManageUsers, getAuthHeaders, getStoredUser, StoredUser } from "@/lib/auth";

type Choice = {
  value: string;
  label: string;
};

type PersonnelDocument = {
  id: number;
  staff_user_id: number;
  staff_name: string;
  staff_username: string;
  category: string;
  category_label: string;
  title: string;
  status: string;
  status_label: string;
  expiry_date: string;
  notes: string;
  file_url: string;
  filename: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

type Summary = {
  total_documents: number;
  needed: number;
  requested: number;
  received: number;
  approved: number;
  expired: number;
};

const defaultSummary: Summary = {
  total_documents: 0,
  needed: 0,
  requested: 0,
  received: 0,
  approved: 0,
  expired: 0,
};

const defaultCategories: Choice[] = [
  { value: "contract", label: "Employment Contract" },
  { value: "right_to_work", label: "Right to Work" },
  { value: "id", label: "ID / Proof of Address" },
  { value: "handbook", label: "Handbook / Policy Sign-off" },
  { value: "training", label: "Training Record" },
  { value: "licence", label: "Licence / Certificate" },
  { value: "disciplinary", label: "Disciplinary / HR Note" },
  { value: "other", label: "Other" },
];

const defaultStatuses: Choice[] = [
  { value: "needed", label: "Needed" },
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
  { value: "approved", label: "Approved" },
  { value: "expired", label: "Expired" },
];

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function statusClass(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "expired") return "bg-red-100 text-red-800";
  if (status === "received") return "bg-blue-100 text-blue-800";
  if (status === "requested") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default function PersonnelPage() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [staff, setStaff] = useState<StoredUser[]>([]);
  const [documents, setDocuments] = useState<PersonnelDocument[]>([]);
  const [categories, setCategories] = useState<Choice[]>(defaultCategories);
  const [statuses, setStatuses] = useState<Choice[]>(defaultStatuses);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [draft, setDraft] = useState({
    staff_user_id: "",
    title: "",
    category: "contract",
    status: "needed",
    expiry_date: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const canAccess = canManageUsers(currentUser);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  async function loadPersonnel() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(apiPath("/api/personnel/"), {
        headers: getAuthHeaders(),
      });
      const data = await readApiPayload(response, "Could not load personnel files.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load personnel files.");
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      setCategories(Array.isArray(data.categories) ? data.categories : defaultCategories);
      setStatuses(Array.isArray(data.statuses) ? data.statuses : defaultStatuses);
      setSummary(data.summary || defaultSummary);
      if (!draft.staff_user_id && Array.isArray(data.staff) && data.staff.length) {
        setDraft((current) => ({ ...current, staff_user_id: String(data.staff[0].id) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load personnel files.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }
    loadPersonnel();
  }, [currentUser, canAccess]);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (staffFilter !== "all" && String(document.staff_user_id) !== staffFilter) return false;
      if (categoryFilter !== "all" && document.category !== categoryFilter) return false;
      if (statusFilter !== "all" && document.status !== statusFilter) return false;
      if (!term) return true;
      return [
        document.title,
        document.staff_name,
        document.staff_username,
        document.category_label,
        document.status_label,
        document.notes,
        document.filename,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [categoryFilter, documents, search, staffFilter, statusFilter]);

  function updateDraft(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null);
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();
      Object.entries(draft).forEach(([key, value]) => payload.append(key, value));
      if (file) payload.append("file", file);

      const response = await fetch(apiPath("/api/personnel/documents/"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: payload,
      });
      const data = await readApiPayload(response, "Could not save personnel document.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not save personnel document.");

      setMessage("Personnel document saved.");
      setDraft((current) => ({
        ...current,
        title: "",
        status: "needed",
        expiry_date: "",
        notes: "",
      }));
      setFile(null);
      const input = document.getElementById("personnel-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadPersonnel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save personnel document.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(document: PersonnelDocument) {
    const confirmed = window.confirm(`Delete ${document.title} for ${document.staff_name}?`);
    if (!confirmed) return;

    try {
      setError("");
      const response = await fetch(apiPath(`/api/personnel/documents/${document.id}/`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await readApiPayload(response, "Could not delete personnel document.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not delete personnel document.");
      setMessage("Personnel document deleted.");
      await loadPersonnel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete personnel document.");
    }
  }

  if (currentUser && !canAccess) {
    return (
      <StaffShell title="Personnel">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700">
          You do not have permission to view personnel files.
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title="Personnel">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Personnel</h1>
          <p className="mt-1 text-sm font-medium text-white/75">
            Employment files, document checks, and HR records for staff.
          </p>
        </div>

        {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Documents</div>
            <div className="mt-3 text-3xl font-black">{summary.total_documents}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Needed</div>
            <div className="mt-3 text-3xl font-black">{summary.needed}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Requested</div>
            <div className="mt-3 text-3xl font-black">{summary.requested}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Approved</div>
            <div className="mt-3 text-3xl font-black">{summary.approved}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Expired</div>
            <div className="mt-3 text-3xl font-black">{summary.expired}</div>
          </div>
        </div>

        <form onSubmit={createDocument} className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Add Personnel Document</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Upload employment contracts, right-to-work checks, policy sign-offs, training records, and HR notes.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving || !draft.staff_user_id || !draft.title.trim()}
              className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Save Document"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <label className="space-y-1 text-sm font-bold text-slate-600">
              Staff Member
              <select
                value={draft.staff_user_id}
                onChange={(event) => updateDraft("staff_user_id", event.target.value)}
                className="h-11 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 font-bold text-slate-950 outline-none"
              >
                {staff.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-600">
              Category
              <select
                value={draft.category}
                onChange={(event) => updateDraft("category", event.target.value)}
                className="h-11 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 font-bold text-slate-950 outline-none"
              >
                {categories.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-600">
              Status
              <select
                value={draft.status}
                onChange={(event) => updateDraft("status", event.target.value)}
                className="h-11 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 font-bold text-slate-950 outline-none"
              >
                {statuses.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-600 lg:col-span-2">
              Title
              <input
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="Example: Signed employment contract"
                className="h-11 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 font-bold text-slate-950 outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-600">
              Expiry / Review Date
              <input
                type="date"
                value={draft.expiry_date}
                onChange={(event) => updateDraft("expiry_date", event.target.value)}
                className="h-11 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 font-bold text-slate-950 outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-600 lg:col-span-2">
              Notes
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
                rows={3}
                placeholder="Optional note for HR record..."
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 font-bold text-slate-950 outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-600">
              File
              <input
                id="personnel-file"
                type="file"
                onChange={handleFileChange}
                className="block h-11 w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-bold text-slate-950 file:mr-3 file:rounded file:border-0 file:bg-violet-700 file:px-3 file:py-1 file:text-sm file:font-black file:text-white"
              />
            </label>
          </div>
        </form>

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-black">Personnel Register</h2>
              <p className="mt-1 text-sm text-slate-500">Filter by staff member, document type, or status.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search docs..."
                className="h-11 rounded-lg border border-violet-100 bg-violet-50 px-3 text-sm font-bold outline-none"
              />
              <select
                value={staffFilter}
                onChange={(event) => setStaffFilter(event.target.value)}
                className="h-11 rounded-lg border border-violet-100 bg-violet-50 px-3 text-sm font-bold outline-none"
              >
                <option value="all">All staff</option>
                {staff.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.username}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-11 rounded-lg border border-violet-100 bg-violet-50 px-3 text-sm font-bold outline-none"
              >
                <option value="all">All categories</option>
                {categories.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-lg border border-violet-100 bg-violet-50 px-3 text-sm font-bold outline-none"
              >
                <option value="all">All statuses</option>
                {statuses.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-6 text-slate-500">Loading personnel files...</div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-slate-500">
                        No personnel documents match this view.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((document) => (
                      <tr key={document.id} className="border-t border-slate-100 align-top hover:bg-violet-50/60">
                        <td className="px-4 py-3">
                          <div className="font-black">{document.staff_name}</div>
                          <div className="text-xs font-semibold text-slate-500">{document.staff_username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black">{document.title}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">{document.category_label}</div>
                          {document.notes ? <div className="mt-2 max-w-xl text-xs text-slate-500">{document.notes}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-1 text-xs font-black ${statusClass(document.status)}`}>
                            {document.status_label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDate(document.expiry_date)}</td>
                        <td className="px-4 py-3">
                          {document.file_url ? (
                            <a
                              href={apiPath(document.file_url)}
                              target="_blank"
                              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                            >
                              Open File
                            </a>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">No file</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => deleteDocument(document)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
