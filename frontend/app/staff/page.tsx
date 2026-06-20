"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { apiPath, readApiPayload } from "../../lib/apiBase";
import {
  canManageUsers,
  canViewStaff,
  getAuthHeaders,
  getOverrideMode,
  getPermissionGroups,
  getStoredUser,
  hasPermission,
  roleLabel,
  StoredUser,
  PermissionMode,
} from "../../lib/auth";

type StaffUser = StoredUser;
type ProfileDraft = {
  company_email: string;
  company_phone: string;
  job_title: string;
  auto_assign_customers: boolean;
  mailbox_enabled: boolean;
  mailbox_password: string;
};
type NewStaffDraft = {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  company_phone: string;
  job_title: string;
  role: string;
  auto_assign_customers: boolean;
};

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "driver", label: "Driver" },
  { value: "finance", label: "Finance" },
  { value: "staff", label: "Staff" },
];

const roleDescriptions = [
  { name: "Admin", description: "Full owner access. Use this for Jay only unless you truly need another system owner." },
  { name: "Manager", description: "Runs day-to-day work, approvals, pricing, customers, operations, and reporting. Cannot manage staff roles." },
  { name: "Sales", description: "Leads, quotes, customer records, CRM email, calendar, and reporting. No finance approvals or staff management." },
  { name: "Operations", description: "Customers, sites, services, jobs, containers, hauliers, purchase order drafts, and reporting." },
  { name: "Driver", description: "Jobs, own calendar, CRM email, staff profiles, and expense claims only." },
  { name: "Finance", description: "Pricebook, purchase orders, expenses, customer/quote visibility, and reporting." },
  { name: "Staff", description: "Basic access for email, calendar, expenses, dashboard, and staff profiles." },
];

export default function StaffPage() {
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [companyEmailDomain, setCompanyEmailDomain] = useState("recyclrgroup.co.uk");
  const [expandedUserIds, setExpandedUserIds] = useState<number[]>([]);
  const [profileDrafts, setProfileDrafts] = useState<Record<number, ProfileDraft>>({});
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [newStaff, setNewStaff] = useState<NewStaffDraft>({
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    email: "",
    company_phone: "",
    job_title: "",
    role: "staff",
    auto_assign_customers: true,
  });

  const groupedPermissions = useMemo(() => getPermissionGroups(), []);
  const allowed = canViewStaff(currentUser);
  const canManage = canManageUsers(currentUser);

  useEffect(() => {
    setMounted(true);
    setCurrentUser(getStoredUser());
    const query = new URLSearchParams(window.location.search).get("search") || "";
    setSearchText(query);
  }, []);

  async function loadStaff() {
    if (!allowed) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(apiPath("/api/auth/staff/"), {
        headers: {
          ...getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load staff.");
      }

      const loadedStaff = data.staff || [];
      setStaff(loadedStaff);
      setProfileDrafts(
        Object.fromEntries(
          loadedStaff.map((user: StaffUser) => [
            user.id,
            {
              company_email: user.profile?.company_email || "",
              company_phone: user.profile?.company_phone || "",
              job_title: user.profile?.job_title || "",
              auto_assign_customers: user.profile?.auto_assign_customers !== false,
              mailbox_enabled: Boolean(user.profile?.mailbox_enabled),
              mailbox_password: "",
            },
          ])
        )
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load staff.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;
    loadStaff();
  }, [mounted, allowed]);

  useEffect(() => {
    if (!mounted || !allowed) return;

    async function loadCompanyDefaults() {
      try {
        const response = await fetch(apiPath("/api/auth/company-details/"), {
          headers: getAuthHeaders(),
        });
        const data = await response.json().catch(() => null);
        const details = data?.company_details || data || {};
        if (response.ok && details.company_email_domain) {
          setCompanyEmailDomain(String(details.company_email_domain).replace("@", "").trim() || "recyclrgroup.co.uk");
        }
      } catch {
        setCompanyEmailDomain("recyclrgroup.co.uk");
      }
    }

    loadCompanyDefaults();
  }, [mounted, allowed]);

  const filteredStaff = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    if (!term) return staff;

    return staff.filter((user) => {
      const role = roleLabel(user).toLowerCase();
      const username = (user.username || "").toLowerCase();
      const status = user.is_active ? "active" : "inactive";
      const profile = user.profile || {};
      const compactTerm = term.replace(/[^a-z0-9]/g, "");
      const compactUsername = username.replace(/[^a-z0-9]/g, "");
      const compactEmail = (profile.company_email || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      return (
        username.includes(term) ||
        compactUsername.includes(compactTerm) ||
        role.includes(term) ||
        status.includes(term) ||
        (profile.company_email || "").toLowerCase().includes(term) ||
        compactEmail.includes(compactTerm) ||
        (profile.company_phone || "").toLowerCase().includes(term) ||
        (profile.job_title || "").toLowerCase().includes(term)
      );
    });
  }, [staff, searchText]);

  function updateProfileDraft(userId: number, field: keyof ProfileDraft, value: string | boolean) {
    setProfileDrafts((current) => ({
      ...current,
      [userId]: {
        company_email: current[userId]?.company_email || "",
        company_phone: current[userId]?.company_phone || "",
        job_title: current[userId]?.job_title || "",
        auto_assign_customers: current[userId]?.auto_assign_customers !== false,
        mailbox_enabled: Boolean(current[userId]?.mailbox_enabled),
          mailbox_password: current[userId]?.mailbox_password || "",
        [field]: value,
      },
    }));
  }

  function derivedEmail(username: string) {
    const localPart = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9._-]/g, "")
      .split(".")
      .filter(Boolean)
      .join(".");

    return localPart ? `${localPart}@${companyEmailDomain}` : "";
  }

  function updateNewStaff(field: keyof NewStaffDraft, value: string | boolean) {
    setNewStaff((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleExpanded(userId: number) {
    setExpandedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  }

  function expandAllVisible() {
    setExpandedUserIds((current) => {
      const visibleIds = filteredStaff.map((user) => user.id);
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function collapseAllVisible() {
    setExpandedUserIds((current) =>
      current.filter((id) => !filteredStaff.some((user) => user.id === id))
    );
  }

  async function updateRole(userId: number, role: string) {
    setSavingUserId(userId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(apiPath(`/api/auth/staff/${userId}/role/`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update role.");
      }

      setStaff((prev) =>
        prev.map((user) => (user.id === userId ? data.user : user))
      );

      setMessage(data.message || "Role updated successfully.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not update role.");
      }
    } finally {
      setSavingUserId(null);
    }
  }

  async function updateActiveStatus(userId: number, isActive: boolean) {
    setSavingUserId(userId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(apiPath(`/api/auth/staff/${userId}/active/`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update staff status.");
      }

      setStaff((prev) =>
        prev.map((user) => (user.id === userId ? data.user : user))
      );

      setMessage(data.message || "Staff status updated.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not update staff status.");
      }
    } finally {
      setSavingUserId(null);
    }
  }

  async function updatePermissionOverride(
    userId: number,
    permissionKey: string,
    mode: PermissionMode
  ) {
    setSavingUserId(userId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        apiPath(`/api/auth/staff/${userId}/permissions/override/`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            permission_key: permissionKey,
            mode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update permission override.");
      }

      setStaff((prev) =>
        prev.map((user) => (user.id === userId ? data.user : user))
      );

      setMessage(data.message || "Permission override updated successfully.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not update permission override.");
      }
    } finally {
      setSavingUserId(null);
    }
  }

  async function updateAdminProfile(userId: number) {
    setSavingUserId(userId);
    setError("");
    setMessage("");

    try {
      const draft = profileDrafts[userId] || {
        company_email: "",
        company_phone: "",
        job_title: "",
        auto_assign_customers: true,
        mailbox_enabled: false,
        mailbox_password: "",
      };

      const response = await fetch(apiPath(`/api/auth/staff/${userId}/profile/`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(draft),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile details.");
      }

      setStaff((prev) =>
        prev.map((user) => (user.id === userId ? data.user : user))
      );

      setMessage(data.message || "Profile details updated successfully.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not update profile details.");
      }
    } finally {
      setSavingUserId(null);
    }
  }

  async function createStaffUser() {
    setSavingUserId(0);
    setError("");
    setMessage("");

    try {
      const response = await fetch(apiPath("/api/auth/staff/create/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newStaff),
      });

      const data = await readApiPayload(response, "Failed to create staff user.");

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create staff user.");
      }

      const createdUser = data.user as StaffUser;
      setStaff((current) =>
        [...current, createdUser].sort((a, b) => a.username.localeCompare(b.username))
      );
      setProfileDrafts((current) => ({
        ...current,
        [createdUser.id]: {
          company_email: createdUser.profile?.company_email || "",
          company_phone: createdUser.profile?.company_phone || "",
          job_title: createdUser.profile?.job_title || "",
          auto_assign_customers: createdUser.profile?.auto_assign_customers !== false,
          mailbox_enabled: Boolean(createdUser.profile?.mailbox_enabled),
          mailbox_password: "",
        },
      }));
      setExpandedUserIds((current) => Array.from(new Set([...current, createdUser.id])));
      setNewStaff({
        username: "",
        password: "",
        first_name: "",
        last_name: "",
        email: "",
        company_phone: "",
        job_title: "",
        role: "staff",
        auto_assign_customers: true,
      });
      setShowCreateStaff(false);
      setMessage(data.message || `Staff user created for ${createdUser.username}.`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not create staff user.");
      }
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <StaffShell title="Staff">
      {!mounted ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading staff...
        </div>
      ) : !allowed ? (
        <div className="rounded-3xl border border-red-300/30 bg-red-500/20 p-6 backdrop-blur-lg">
          You do not have permission to view staff.
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading staff...
        </div>
      ) : (
        <div className="space-y-6">
          {(message || error) && (
            <div
              className={`rounded-3xl border p-4 backdrop-blur-lg ${
                error
                  ? "border-red-300/30 bg-red-500/20"
                  : "border-emerald-300/30 bg-emerald-500/20"
              }`}
            >
              {error || message}
            </div>
          )}

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-xl font-semibold">Staff Roles & Permissions</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Roles provide the default permissions. Per-user overrides let you allow or deny individual permissions without changing the user's role.
            </p>

            {canManage ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {roleDescriptions.map((role) => (
                  <div key={role.name} className="rounded-lg border border-violet-100 bg-violet-50 p-4">
                    <div className="text-sm font-black text-slate-950">{role.name}</div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {role.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {canManage ? (
              <div className="mt-5 rounded-lg border border-violet-100 bg-violet-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-950">Add Staff</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Create a login, set a temporary password, then choose their role.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateStaff((current) => !current)}
                    className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-800"
                  >
                    {showCreateStaff ? "Hide Form" : "Add Staff"}
                  </button>
                </div>

                {showCreateStaff ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Username</label>
                      <input
                        value={newStaff.username}
                        onChange={(event) => updateNewStaff("username", event.target.value)}
                        placeholder="Alex.Driver"
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Temporary Password</label>
                      <input
                        type="password"
                        value={newStaff.password}
                        onChange={(event) => updateNewStaff("password", event.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">First Name</label>
                      <input
                        value={newStaff.first_name}
                        onChange={(event) => updateNewStaff("first_name", event.target.value)}
                        placeholder="Alex"
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Last Name</label>
                      <input
                        value={newStaff.last_name}
                        onChange={(event) => updateNewStaff("last_name", event.target.value)}
                        placeholder="Driver"
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Role</label>
                      <select
                        value={newStaff.role}
                        onChange={(event) => updateNewStaff("role", event.target.value)}
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Company Email</label>
                      <input
                        value={newStaff.email}
                        onChange={(event) => updateNewStaff("email", event.target.value)}
                        placeholder={derivedEmail(newStaff.username)}
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Company Number</label>
                      <input
                        value={newStaff.company_phone}
                        onChange={(event) => updateNewStaff("company_phone", event.target.value)}
                        placeholder="Work mobile or extension"
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Job Title</label>
                      <input
                        value={newStaff.job_title}
                        onChange={(event) => updateNewStaff("job_title", event.target.value)}
                        placeholder="Operations Manager"
                        className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white p-4 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={newStaff.auto_assign_customers}
                        onChange={(event) => updateNewStaff("auto_assign_customers", event.target.checked)}
                      />
                      Auto assign new customers
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={createStaffUser}
                        disabled={savingUserId === 0}
                        className="w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingUserId === 0 ? "Creating..." : "Create Staff Login"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Search staff
                </label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search by username, role or status..."
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              {canManage ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={expandAllVisible}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Expand visible
                </button>
                <button
                  type="button"
                  onClick={collapseAllVisible}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Collapse visible
                </button>
              </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {filteredStaff.length === 0 ? (
              <div className="rounded-3xl border border-white/20 bg-white/10 p-6 text-center text-slate-500 backdrop-blur-lg">
                No staff users found.
              </div>
            ) : (
              filteredStaff.map((user) => {
                const expanded = expandedUserIds.includes(user.id);
                const draft = profileDrafts[user.id] || {
                  company_email: user.profile?.company_email || derivedEmail(user.username),
                  company_phone: user.profile?.company_phone || "",
                  job_title: user.profile?.job_title || "",
                  auto_assign_customers: user.profile?.auto_assign_customers !== false,
                  mailbox_enabled: Boolean(user.profile?.mailbox_enabled),
                  mailbox_password: "",
                };

                return (
                  <div
                    key={user.id}
                    className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-lg"
                  >
                    <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(user.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-lg font-semibold">{user.username}</div>

                          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                            {roleLabel(user)}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              user.is_active
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-red-500/20 text-red-100"
                            }`}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>

                          {user.is_superuser ? (
                            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-100">
                              Superuser
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span
                            className={`rounded-full px-3 py-1 ${
                              hasPermission(user, "leads.edit")
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            Leads: {hasPermission(user, "leads.edit") ? "Edit" : "View"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 ${
                              hasPermission(user, "customers.edit")
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            Customers: {hasPermission(user, "customers.edit") ? "Edit" : "View"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 ${
                              hasPermission(user, "sites.edit")
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            Sites: {hasPermission(user, "sites.edit") ? "Edit" : "View"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 ${
                              hasPermission(user, "services.edit")
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            Services: {hasPermission(user, "services.edit") ? "Edit" : "View"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 ${
                              hasPermission(user, "pricing.edit")
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            Pricing: {hasPermission(user, "pricing.edit") ? "Edit" : "No"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 ${
                              hasPermission(user, "staff.manage")
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            Staff: {hasPermission(user, "staff.manage") ? "Manage" : "No"}
                          </span>
                        </div>

                        <div className="mt-3 text-sm text-slate-500">
                          {canManage ? (expanded ? "Hide full permissions" : "Show full permissions") : "Open the staff profile to view contact details"}
                        </div>
                      </button>

                      <div className="flex w-full flex-col gap-3 lg:w-[180px]">
                        <Link
                          href={`/staff/${user.id}`}
                          className="rounded-lg bg-violet-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-violet-800"
                        >
                          View Profile
                        </Link>
                      </div>

                      {canManage ? (
                      <div className="grid w-full gap-3 lg:w-[560px] lg:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-600">
                            Company Email
                          </label>
                          <input
                            value={draft.company_email}
                            onChange={(event) => updateProfileDraft(user.id, "company_email", event.target.value)}
                            placeholder={derivedEmail(user.username)}
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-600">
                            Company Number
                          </label>
                          <input
                            value={draft.company_phone}
                            onChange={(event) => updateProfileDraft(user.id, "company_phone", event.target.value)}
                            placeholder="Work mobile or extension"
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-600">
                            Job Title
                          </label>
                          <input
                            value={draft.job_title}
                            onChange={(event) => updateProfileDraft(user.id, "job_title", event.target.value)}
                            placeholder="Operations Manager"
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white p-4 text-sm font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={draft.auto_assign_customers}
                            onChange={(event) =>
                              updateProfileDraft(user.id, "auto_assign_customers", event.target.checked)
                            }
                          />
                          Auto assign new customers
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => updateAdminProfile(user.id)}
                            disabled={savingUserId === user.id}
                            className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Save Profile
                          </button>
                        </div>

                        <div className="rounded-lg border border-violet-100 bg-white p-4 lg:col-span-2">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-black text-slate-950">Zoho Mailbox</div>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Email follows the staff username rule. Paste the Zoho app password here after generating it in Zoho.
                              </p>
                              <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.mailbox_enabled}
                                  onChange={(event) =>
                                    updateProfileDraft(user.id, "mailbox_enabled", event.target.checked)
                                  }
                                />
                                Enable CRM mailbox
                              </label>
                            </div>
                          </div>

                          <div className="mt-3">
                            <input
                              type="password"
                              value={draft.mailbox_password}
                              onChange={(event) => updateProfileDraft(user.id, "mailbox_password", event.target.value)}
                              placeholder={
                                user.profile?.mailbox_has_password
                                  ? "Saved password exists. Paste a new one only if changing it."
                                  : "Paste Zoho app password"
                              }
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                            />
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Leave this blank when saving if you do not want to change the stored Zoho password.
                            </p>
                          </div>
                        </div>

                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          Change Role
                        </label>
                        <select
                          value={user.role || "staff"}
                          disabled={savingUserId === user.id}
                          onChange={(event) => updateRole(user.id, event.target.value)}
                          className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none disabled:opacity-60"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="rounded-lg border border-violet-100 bg-white p-4 lg:col-span-2">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-black text-slate-950">Account Status</div>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Deactivate temporary or leaver accounts without deleting their history.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateActiveStatus(user.id, !user.is_active)}
                              disabled={savingUserId === user.id}
                              className={`rounded-lg px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                user.is_active
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                              }`}
                            >
                              {user.is_active ? "Deactivate Account" : "Reactivate Account"}
                            </button>
                          </div>
                        </div>
                      </div>
                      ) : null}
                    </div>

                    {expanded && canManage ? (
                      <div className="border-t border-white/10 px-5 pb-5 pt-5">
                        <div className="space-y-4">
                          {Object.entries(groupedPermissions).map(([category, permissions]) => (
                            <div key={category}>
                              <div className="mb-2 font-semibold text-slate-800">{category}</div>
                              <div className="space-y-2">
                                {permissions.map((permission) => {
                                  const enabled = hasPermission(user, permission.key);
                                  const mode = getOverrideMode(user, permission.key);

                                  return (
                                    <div
                                      key={permission.key}
                                      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
                                    >
                                      <div>
                                        <div className="font-medium text-white">{permission.label}</div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                          <span
                                            className={`rounded-full px-2 py-1 ${
                                              enabled
                                                ? "bg-emerald-500/20 text-emerald-100"
                                                : "bg-white/10 text-slate-400"
                                            }`}
                                          >
                                            {enabled ? "Enabled" : "Disabled"}
                                          </span>
                                          <span className="rounded-full bg-white/10 px-2 py-1 text-slate-500">
                                            Override: {mode}
                                          </span>
                                        </div>
                                      </div>

                                      <select
                                        value={mode}
                                        disabled={savingUserId === user.id}
                                        onChange={(event) =>
                                          updatePermissionOverride(
                                            user.id,
                                            permission.key,
                                            event.target.value as PermissionMode
                                          )
                                        }
                                        className="rounded-xl border border-white/20 bg-[#4a3099] px-4 py-2 text-white outline-none disabled:opacity-60"
                                      >
                                        <option value="default">Use role default</option>
                                        <option value="allow">Allow</option>
                                        <option value="deny">Deny</option>
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
