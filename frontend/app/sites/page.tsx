"use client";

import { useEffect, useState } from "react";
import StaffShell from "@/components/StaffShell";

type SiteRow = {
  id: number;
  site_name: string;
  customer_id: number | null;
  customer_name: string;
  address: string;
  postcode: string;
  town: string;
  county: string;
};

export default function SitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSites() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/customers/sites/");
        const text = await response.text();

        let result: SiteRow[] = [];
        try {
          result = text ? JSON.parse(text) : [];
        } catch {
          throw new Error("Sites endpoint did not return valid JSON.");
        }

        if (!response.ok) {
          throw new Error("Could not load sites.");
        }

        setSites(result);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load sites.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadSites();
  }, []);

  return (
    <StaffShell title="Sites">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Site Directory</h1>
          <p className="mt-1 text-sm font-medium text-white/75">
            All customer service locations currently stored in the CRM.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Total Sites</div>
            <div className="mt-3 text-4xl font-black">{sites.length}</div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-violet-100 bg-white p-6 text-slate-500 shadow-sm">
            Loading sites...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-white p-6 text-red-700 shadow-sm">
            {error}
          </div>
        ) : (
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">Sites</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Linked customer sites, addresses, and postcodes.
            </p>

            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Site</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Postcode</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-slate-500">
                        No sites found.
                      </td>
                    </tr>
                  ) : (
                    sites.map((site) => (
                      <tr key={site.id} className="border-t border-slate-100 hover:bg-violet-50/60">
                        <td className="px-4 py-3 font-bold text-violet-700">{site.site_name || "-"}</td>
                        <td className="px-4 py-3">{site.customer_name || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{site.address || "-"}</td>
                        <td className="px-4 py-3 font-semibold">{site.postcode || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </StaffShell>
  );
}
