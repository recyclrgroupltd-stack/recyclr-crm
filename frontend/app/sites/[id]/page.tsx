"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StaffShell from "@/components/StaffShell";

type SiteDetail = {
  id: number;
  customer_id: number | null;
  customer_name: string;
  site_name: string;
  primary_contact: string;
  secondary_contact: string;
  phone: string;
  secondary_phone: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  notes: string;
};

type SiteContainer = {
  id: number;
  container_uid: string;
  bin_size_label: string;
  waste_stream_label: string;
  status: string;
  status_label: string;
  service_id: number | null;
  qr_url: string;
};

function emptySite(id: number): SiteDetail {
  return {
    id,
    customer_id: null,
    customer_name: "",
    site_name: "",
    primary_contact: "",
    secondary_contact: "",
    phone: "",
    secondary_phone: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    town: "",
    county: "",
    postcode: "",
    notes: "",
  };
}

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = Number(params?.id);

  const [site, setSite] = useState<SiteDetail>(emptySite(siteId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [containers, setContainers] = useState<SiteContainer[]>([]);

  useEffect(() => {
    async function loadSite() {
      if (!siteId || Number.isNaN(siteId)) return;

      try {
        setLoading(true);
        setError("");
        setMessage("");

        const response = await fetch(
          `http://127.0.0.1:8000/api/customers/sites/${siteId}/`
        );

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Site API did not return JSON.");
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load site.");
        }

        setSite({
          id: data.id,
          customer_id: data.customer_id ?? null,
          customer_name: data.customer_name || "",
          site_name: data.site_name || "",
          primary_contact: data.primary_contact || "",
          secondary_contact: data.secondary_contact || "",
          phone: data.phone || "",
          secondary_phone: data.secondary_phone || "",
          email: data.email || "",
          address_line_1: data.address_line_1 || "",
          address_line_2: data.address_line_2 || "",
          town: data.town || "",
          county: data.county || "",
          postcode: data.postcode || "",
          notes: data.notes || "",
        });

        const containersResponse = await fetch(
          `http://127.0.0.1:8000/api/containers/?site_id=${siteId}&status=all`
        );
        const containersData = await containersResponse.json();
        if (containersResponse.ok && containersData.success) {
          setContainers(containersData.rows || []);
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Could not load site.");
      } finally {
        setLoading(false);
      }
    }

    loadSite();
  }, [siteId]);

  function updateField<K extends keyof SiteDetail>(field: K, value: SiteDetail[K]) {
    setSite((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSite() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/customers/sites/${siteId}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            site_name: site.site_name,
            primary_contact: site.primary_contact,
            secondary_contact: site.secondary_contact,
            phone: site.phone,
            secondary_phone: site.secondary_phone,
            email: site.email,
            address_line_1: site.address_line_1,
            address_line_2: site.address_line_2,
            town: site.town,
            county: site.county,
            postcode: site.postcode,
            notes: site.notes,
          }),
        }
      );

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Site API did not return JSON.");
      }

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Failed to save site.");
      }

      setMessage(data.message || "Site updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not save site.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffShell title={site.site_name || "Site"}>
      <div className="space-y-6">
        {(message || error) && (
          <div className="space-y-3">
            {message ? (
              <div className="rounded-3xl border border-emerald-300/30 bg-emerald-500/20 p-4 text-white backdrop-blur-lg">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-3xl border border-red-300/30 bg-red-500/20 p-4 text-white backdrop-blur-lg">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Site</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Site record #{siteId}</p>
          </div>

          {loading ? (
            <div className="text-slate-500">Loading site...</div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-600">Site Name</label>
                  <input
                    value={site.site_name}
                    onChange={(e) => updateField("site_name", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Primary Contact</label>
                  <input
                    value={site.primary_contact}
                    onChange={(e) => updateField("primary_contact", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Phone</label>
                  <input
                    value={site.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Secondary Contact</label>
                  <input
                    value={site.secondary_contact}
                    onChange={(e) => updateField("secondary_contact", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Secondary Phone</label>
                  <input
                    value={site.secondary_phone}
                    onChange={(e) => updateField("secondary_phone", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Email</label>
                  <input
                    value={site.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Address Line 1</label>
                  <input
                    value={site.address_line_1}
                    onChange={(e) => updateField("address_line_1", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Address Line 2</label>
                  <input
                    value={site.address_line_2}
                    onChange={(e) => updateField("address_line_2", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Town</label>
                  <input
                    value={site.town}
                    onChange={(e) => updateField("town", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">County</label>
                  <input
                    value={site.county}
                    onChange={(e) => updateField("county", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Postcode</label>
                  <input
                    value={site.postcode}
                    onChange={(e) => updateField("postcode", e.target.value)}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-600">Customer</label>
                  <input
                    value={site.customer_name}
                    disabled
                    className="w-full rounded-lg border border-violet-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-slate-600">Notes</label>
                  <textarea
                    value={site.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={saveSite}
                  disabled={saving}
                  className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Site"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">Assigned Containers</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Container IDs and QR codes currently linked to this site.
              </p>
            </div>
            <div className="rounded bg-violet-100 px-3 py-2 text-sm font-black text-violet-800">
              {containers.length} containers
            </div>
          </div>

          {containers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">
              No containers assigned to this site yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Container ID</th>
                    <th className="px-4 py-3">Stream</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((container) => (
                    <tr key={container.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs font-black text-violet-700">
                        {container.container_uid}
                      </td>
                      <td className="px-4 py-3 font-bold">{container.waste_stream_label}</td>
                      <td className="px-4 py-3">{container.bin_size_label}</td>
                      <td className="px-4 py-3">{container.status_label}</td>
                      <td className="px-4 py-3">
                        <img
                          src={container.qr_url}
                          alt={`${container.container_uid} QR`}
                          className="h-12 w-12 rounded border border-slate-200 bg-white p-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
