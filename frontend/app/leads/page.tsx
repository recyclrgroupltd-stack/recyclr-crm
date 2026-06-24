"use client";

import Link from "next/link";
import AppModal from "../../components/AppModal";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { canEditLeads, getAuthHeaders, getStoredUser } from "../../lib/auth";
import { apiPath } from "../../lib/apiBase";

type Lead = {
  id: number;
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
  estimated_monthly_value: number;
  notes: string;
  converted_customer_id: number | null;
  converted_customer_name: string;
};

type CreateLeadForm = {
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
};

const statusOptions = ["new", "contacted", "quote_sent", "won", "lost"];
const leadSourceOptions = ["door", "website", "referral", "phone", "other"];

const emptyCreateForm: CreateLeadForm = {
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
};

function prettyStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
}

function isFollowUpDue(value: string) {
  if (!value) return false;

  const today = new Date();
  const dueDate = new Date(`${value}T00:00:00`);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate <= today;
}

export default function LeadsPage() {
  const router = useRouter();
  const currentUser = getStoredUser();
  const userCanEditLeads = canEditLeads(currentUser);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateLeadForm>(emptyCreateForm);
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    document.title = "Leads - Recyclr";
  }, []);

  useEffect(() => {
    async function loadLeads() {
      try {
        setError("");
        const response = await fetch(apiPath("/api/leads/"), {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load leads.");
        }

        setLeads(Array.isArray(data) ? data : []);
      } catch {
        setError("Could not load leads.");
      } finally {
        setLoading(false);
      }
    }

    loadLeads();
  }, []);

  useEffect(() => {
    if (!showCreateModal) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showCreateModal]);

  const filteredLeads = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

      const matchesSearch =
        term.length === 0 ||
        lead.company_name.toLowerCase().includes(term) ||
        (lead.contact_name || "").toLowerCase().includes(term) ||
        (lead.who_spoke_to || "").toLowerCase().includes(term) ||
        (lead.phone || "").toLowerCase().includes(term) ||
        (lead.email || "").toLowerCase().includes(term) ||
        (lead.postcode || "").toLowerCase().includes(term) ||
        (lead.town || "").toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [leads, searchText, statusFilter]);

  const summary = useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((lead) => lead.status === "new").length;
    const quoteSentCount = leads.filter((lead) => lead.status === "quote_sent").length;
    const wonCount = leads.filter((lead) => lead.status === "won").length;
    const followUpDueCount = leads.filter((lead) => isFollowUpDue(lead.follow_up_date)).length;

    return {
      total,
      newCount,
      quoteSentCount,
      wonCount,
      followUpDueCount,
    };
  }, [leads]);

  function closeCreateModal() {
    if (createSaving) return;
    setShowCreateModal(false);
    setCreateForm(emptyCreateForm);
    setCreateError("");
  }

  async function handleCreateLead() {
    if (!userCanEditLeads) {
      setCreateError("You do not have permission to add leads.");
      return;
    }

    if (!createForm.company_name.trim()) {
      setCreateError("Company name is required.");
      return;
    }

    if (createForm.lead_source === "other" && !createForm.lead_source_other.trim()) {
      setCreateError("Please enter the other lead source.");
      return;
    }

    try {
      setCreateSaving(true);
      setCreateError("");

      const response = await fetch(apiPath("/api/leads/"), {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ ...createForm, status: "new" }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create lead.");
      }

      if (data.lead) {
        setLeads((prev) => [data.lead, ...prev]);
        setShowCreateModal(false);
        setCreateForm(emptyCreateForm);
        router.push(`/leads/${data.lead.id}`);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create lead.");
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <StaffShell title="Leads">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div>
            <h1 className="text-2xl font-black">Lead Pipeline</h1>
            <p className="mt-1 text-sm font-medium text-white/75">
              Track prospects, follow-ups, and quote opportunities.
            </p>
          </div>
          {userCanEditLeads && (
            <button
              type="button"
              onClick={() => {
                setCreateError("");
                setShowCreateModal(true);
              }}
              className="rounded-lg bg-white px-4 py-3 text-sm font-black text-violet-800 shadow-sm transition hover:bg-violet-50"
            >
              + Add Lead
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total Leads</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">New</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.newCount}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Quote Sent</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.quoteSentCount}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Won</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.wonCount}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Follow Up Due</div>
            <div className="mt-2 text-3xl font-black text-[#120a35]">{summary.followUpDueCount}</div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white p-4 text-slate-950 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#120a35]">Leads</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Track sales leads, add new prospects, and jump straight into the full lead record.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap xl:justify-end">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Search
                </label>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search company, contact, phone, email, town..."
                  className="w-full rounded-lg border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-[#120a35] outline-none placeholder:text-slate-400 focus:border-violet-400 md:w-80"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-[#120a35] outline-none focus:border-violet-400 md:w-48"
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {prettyStatus(status)}
                    </option>
                  ))}
                </select>
              </div>

              {userCanEditLeads && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-transparent">
                    Action
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateError("");
                      setShowCreateModal(true);
                    }}
                    className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800"
                  >
                    + Add Lead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-violet-100 bg-white p-6 text-sm font-bold text-slate-600 shadow-sm">
            Loading leads...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700 shadow-sm">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-violet-100 bg-white text-slate-950 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Spoke To</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Follow Up</th>
                    <th className="px-4 py-3 font-medium">Estimated £</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                        <div className="space-y-3">
                          <div>No leads found.</div>
                          {userCanEditLeads && leads.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setShowCreateModal(true)}
                              className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800"
                            >
                              Add your first lead
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                        <td className="px-4 py-3 font-medium">
                          <div className="space-y-1">
                            <Link
                              href={`/leads/${lead.id}`}
                              className="font-black text-violet-700 underline underline-offset-4 hover:text-violet-900"
                            >
                              {lead.company_name}
                            </Link>
                            <div className="text-xs font-medium text-slate-400">
                              {[lead.town, lead.postcode].filter(Boolean).join(" • ") || "-"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{lead.who_spoke_to || "-"}</td>
                        <td className="px-4 py-3">{lead.contact_name || "-"}</td>
                        <td className="px-4 py-3">{lead.phone || "-"}</td>
                        <td className="px-4 py-3">{lead.email || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">
                            {prettyStatus(lead.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {lead.converted_customer_id ? (
                            <span className="font-semibold text-slate-700">{lead.converted_customer_name}</span>
                          ) : (
                            <span className="text-slate-400">Not converted</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              isFollowUpDue(lead.follow_up_date)
                                ? "font-black text-amber-600"
                                : "text-slate-700"
                            }
                          >
                            {formatDate(lead.follow_up_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatMoney(lead.estimated_monthly_value)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-800"
                          >
                            Open Lead
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreateModal ? (
        <AppModal
          open={showCreateModal}
          onClose={closeCreateModal}
          title="Add Lead"
          description="Create the lead here, then you can open the full lead page to finish the waste details."
          maxWidthClassName="max-w-5xl"
          zIndexClassName="z-[300]"
          topPaddingClassName="pt-4 sm:pt-6 md:pt-28"
          panelClassName="bg-[#4a3099]"
          bodyClassName="px-6 py-5"
          contentClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          footer={
            <>
              <div className="text-sm text-white/60 sm:mr-auto">
                After saving, you will be taken straight into the full lead page.
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createSaving}
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLead}
                disabled={createSaving}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60 sm:w-auto"
              >
                {createSaving ? "Creating..." : "Create Lead"}
              </button>
            </>
          }
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-medium text-white/80">Company Name *</label>
              <input
                value={createForm.company_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, company_name: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Business name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Who Spoke To</label>
              <input
                value={createForm.who_spoke_to}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, who_spoke_to: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Decision maker / person spoken to"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Contact Name</label>
              <input
                value={createForm.contact_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, contact_name: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Main contact"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Phone</label>
              <input
                value={createForm.phone}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Secondary Phone</label>
              <input
                value={createForm.secondary_phone}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, secondary_phone: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Email</label>
              <input
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Email address"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Lead Source</label>
              <select
                value={createForm.lead_source}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, lead_source: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none"
              >
                {leadSourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {prettyStatus(source)}
                  </option>
                ))}
              </select>
            </div>

            {createForm.lead_source === "other" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Other Lead Source</label>
                <input
                  value={createForm.lead_source_other}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, lead_source_other: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                  placeholder="Where did this lead come from?"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Follow Up Date</label>
              <input
                type="date"
                value={createForm.follow_up_date}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, follow_up_date: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-medium text-white/80">Address Line 1</label>
              <input
                value={createForm.address_line_1}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, address_line_1: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Address line 1"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Address Line 2</label>
              <input
                value={createForm.address_line_2}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, address_line_2: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Town</label>
              <input
                value={createForm.town}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, town: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Town / city"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">County</label>
              <input
                value={createForm.county}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, county: event.target.value }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="County"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">Postcode</label>
              <input
                value={createForm.postcode}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, postcode: event.target.value.toUpperCase() }))
                }
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Postcode"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-white/80">Notes</label>
              <textarea
                value={createForm.notes}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={5}
                className="w-full rounded-xl border border-white/20 bg-[#5a3aa8] px-4 py-3 text-white outline-none placeholder:text-white/40"
                placeholder="Anything useful from the first call / visit"
              />
            </div>
          </div>

          {createError && (
            <div className="mt-5 rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
              {createError}
            </div>
          )}
        </AppModal>
      ) : null}
    </StaffShell>
  );
}
