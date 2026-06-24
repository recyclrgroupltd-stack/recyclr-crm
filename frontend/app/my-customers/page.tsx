"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getStoredUser, StoredUser } from "@/lib/auth";

type AccountManager = {
  id: number;
  username: string;
  name: string;
  company_email: string;
  company_phone: string;
  job_title: string;
} | null;

type CustomerRow = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  town: string;
  county: string;
  postcode: string;
  account_manager: AccountManager;
  sites?: Array<{
    site_name: string;
    town: string;
    postcode: string;
  }>;
};

function normalise(value: string) {
  return (value || "").toLowerCase().trim();
}

function formatStatus(value: string) {
  if (!value) return "-";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadgeClass(value: string) {
  const normalised = normalise(value);
  if (normalised === "active") return "bg-emerald-100 text-emerald-800";
  if (normalised === "ready_for_setup") return "bg-blue-100 text-blue-800";
  if (normalised === "onboarding") return "bg-amber-100 text-amber-800";
  if (normalised === "inactive") return "bg-slate-200 text-slate-700";
  return "bg-violet-100 text-violet-800";
}

export default function MyCustomersPage() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("mine");

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/customers/");
        const result = await response.json();
        if (!response.ok) throw new Error("Failed to load customers.");
        setCustomers(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load customers.");
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, []);

  const managers = useMemo(() => {
    const unique = new Map<number, NonNullable<AccountManager>>();
    customers.forEach((customer) => {
      if (customer.account_manager) unique.set(customer.account_manager.id, customer.account_manager);
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = normalise(search);
    return customers.filter((customer) => {
      if (managerFilter === "mine" && customer.account_manager?.id !== currentUser?.id) return false;
      if (managerFilter !== "mine" && managerFilter !== "all" && customer.account_manager?.id !== Number(managerFilter)) {
        return false;
      }

      const siteText = (customer.sites || [])
        .map((site) => `${site.site_name} ${site.town} ${site.postcode}`)
        .join(" ");
      const haystack = [
        customer.customer_uid,
        customer.business_name,
        customer.contact_name,
        customer.email,
        customer.phone,
        customer.town,
        customer.county,
        customer.postcode,
        customer.account_manager?.name || "",
        customer.account_manager?.username || "",
        siteText,
      ].join(" ");

      return !term || normalise(haystack).includes(term);
    });
  }, [customers, currentUser?.id, managerFilter, search]);

  const myCount = useMemo(
    () => customers.filter((customer) => customer.account_manager?.id === currentUser?.id).length,
    [customers, currentUser?.id]
  );

  return (
    <StaffShell title="My Customers">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">My Customers</h1>
            <p className="mt-1 text-sm font-medium text-white/75">
              Customers assigned to you, with quick search across other account managers.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">My Customers</div>
            <div className="mt-3 text-4xl font-black">{myCount}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Filtered Results</div>
            <div className="mt-3 text-4xl font-black">{filteredCustomers.length}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Account Managers</div>
            <div className="mt-3 text-4xl font-black">{managers.length}</div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Search</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, ID, contact, site, town, manager..."
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Account Manager</label>
              <select
                value={managerFilter}
                onChange={(event) => setManagerFilter(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
              >
                <option value="mine">My customers</option>
                <option value="all">All managers</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-violet-100 bg-white text-slate-950 shadow-sm">
          {loading ? (
            <div className="p-5 text-sm font-semibold text-slate-500">Loading customers...</div>
          ) : error ? (
            <div className="p-5 text-sm font-semibold text-red-700">{error}</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-5 text-sm font-semibold text-slate-500">No customers found.</div>
          ) : (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3 font-bold text-slate-600">{customer.customer_uid || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="font-black text-violet-700">{customer.business_name}</div>
                      <div className="text-xs font-semibold text-slate-500">{customer.town || customer.postcode || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{customer.contact_name || "-"}</div>
                      <div className="text-xs text-slate-500">{customer.email || customer.phone || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{customer.account_manager?.name || "Not assigned"}</div>
                      <div className="text-xs text-slate-500">{customer.account_manager?.job_title || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(customer.status)}`}>
                        {formatStatus(customer.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="rounded-lg border border-violet-100 bg-white px-4 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
                      >
                        Overview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
