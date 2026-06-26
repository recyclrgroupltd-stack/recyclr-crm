"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";

type CustomerSiteRow = {
  id: number;
  site_name: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
};

type CustomerRow = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  town: string;
  county: string;
  postcode: string;
  sites?: CustomerSiteRow[];
};

function formatStatus(value: string) {
  if (!value) return "Active";
  if (value === "setup_approval") return "Setup Approval";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadgeClass(value: string) {
  const normalised = normalise(value);
  if (normalised === "active") return "bg-emerald-100 text-emerald-800";
  if (normalised === "onboarding") return "bg-amber-100 text-amber-800";
  if (normalised === "ready_for_setup" || normalised === "setup_approval") return "bg-blue-100 text-blue-800";
  if (normalised === "inactive") return "bg-slate-200 text-slate-700";
  return "bg-violet-100 text-violet-800";
}

function normalise(value: string) {
  return (value || "").toLowerCase().trim();
}

function getTownFromCustomer(customer: CustomerRow) {
  return customer.town || customer.sites?.find((site) => site.town)?.town || "";
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [townFilter, setTownFilter] = useState("all");

  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get("search") || "");
  }, []);

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/customers/");
        const result = await response.json();

        if (!response.ok) {
          throw new Error("Failed to load customers.");
        }

        setCustomers(result);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load customers.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const siteSearchText = (customer.sites || [])
        .map((site) =>
          [
            site.site_name,
            site.address_line_1,
            site.address_line_2,
            site.town,
            site.county,
            site.postcode,
          ].join(" ")
        )
        .join(" ");
      const matchesSearch =
        !search ||
        normalise(customer.customer_uid).includes(normalise(search)) ||
        normalise(customer.business_name).includes(normalise(search)) ||
        normalise(customer.contact_name).includes(normalise(search)) ||
        normalise(customer.email).includes(normalise(search)) ||
        normalise(customer.phone).includes(normalise(search)) ||
        normalise(customer.town).includes(normalise(search)) ||
        normalise(customer.county).includes(normalise(search)) ||
        normalise(customer.postcode).includes(normalise(search)) ||
        normalise(siteSearchText).includes(normalise(search));

      const matchesStatus =
        statusFilter === "all" || normalise(customer.status) === normalise(statusFilter);

      const matchesTown =
        townFilter === "all" || normalise(getTownFromCustomer(customer)) === normalise(townFilter);

      return matchesSearch && matchesStatus && matchesTown;
    });
  }, [customers, search, statusFilter, townFilter]);

  const activeCustomers = useMemo(() => {
    return customers.filter((customer) => normalise(customer.status || "active") === "active").length;
  }, [customers]);

  const uniqueTowns = useMemo(() => {
    const towns = customers
      .map((customer) => getTownFromCustomer(customer))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return Array.from(new Set(towns));
  }, [customers]);

  return (
    <StaffShell title="Customers">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Customer Directory</h1>
            <p className="mt-1 text-sm font-medium text-white/75">
              Manage live customer accounts and contact details.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Total Customers</div>
            <div className="mt-3 text-4xl font-black">{customers.length}</div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Active Customers</div>
            <div className="mt-3 text-4xl font-black">{activeCustomers}</div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Filtered Results</div>
            <div className="mt-3 text-4xl font-black">{filteredCustomers.length}</div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <h2 className="text-lg font-black">Customers</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Search and filter customers by name, contact details, and location.
          </p>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Search</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Business name, contact, postcode..."
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Status</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-violet-400"
              >
                <option value="all">All statuses</option>
                <option value="onboarding">Onboarding</option>
                <option value="setup_approval">Setup Approval</option>
                <option value="ready_for_setup">Ready for Setup</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Billing Town</label>
              <select
                value={townFilter}
                onChange={(event) => setTownFilter(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-violet-400"
              >
                <option value="all">All towns</option>
                {uniqueTowns.map((town) => (
                  <option key={town} value={town}>
                    {town}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-violet-100 bg-white text-slate-950 shadow-sm">
          {loading ? (
            <div className="p-6 text-slate-500">Loading customers...</div>
          ) : error ? (
            <div className="p-6 text-red-700">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-medium">Customer ID</th>
                    <th className="px-4 py-4 font-medium">Business</th>
                    <th className="px-4 py-4 font-medium">Primary Contact</th>
                    <th className="px-4 py-4 font-medium">Phone</th>
                    <th className="px-4 py-4 font-medium">Email</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-slate-500">
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                        <td className="px-4 py-4 font-mono text-xs font-black text-slate-500">
                          {customer.customer_uid || "-"}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-bold text-violet-700 hover:text-violet-950"
                          >
                            {customer.business_name || "-"}
                          </Link>
                        </td>

                        <td className="px-4 py-4">{customer.contact_name || "-"}</td>
                        <td className="px-4 py-4">{customer.phone || "-"}</td>
                        <td className="px-4 py-4">{customer.email || "-"}</td>

                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(customer.status)}`}>
                            {formatStatus(customer.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex gap-3">
                            <Link
                              href={`/customers/${customer.id}`}
                              className="rounded-lg border border-violet-100 bg-white px-4 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
                            >
                              Overview
                            </Link>

                            <Link
                              href={`/customers/${customer.id}/edit`}
                              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-800"
                            >
                              Edit Customer
                            </Link>
                          </div>
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
