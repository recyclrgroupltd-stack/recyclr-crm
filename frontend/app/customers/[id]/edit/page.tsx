"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StaffShell from "@/components/StaffShell";

type CustomerForm = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  billing: {
    invoice_requires_po: boolean;
    invoice_payment_terms_days: number;
    invoice_email: string;
    invoice_po_number: string;
    auto_invoice_enabled: boolean;
    next_invoice_date: string;
    last_invoiced_at: string;
  };
};

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<CustomerForm>({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    status: "active",
    notes: "",
    address_line_1: "",
    address_line_2: "",
    town: "",
    county: "",
    postcode: "",
    billing: {
      invoice_requires_po: false,
      invoice_payment_terms_days: 30,
      invoice_email: "",
      invoice_po_number: "",
      auto_invoice_enabled: true,
      next_invoice_date: "",
      last_invoiced_at: "",
    },
  });

  useEffect(() => {
    async function loadCustomer() {
      if (!customerId || Number.isNaN(customerId)) return;

      try {
        setLoading(true);
        setError("");

        const response = await fetch(`http://127.0.0.1:8000/api/customers/${customerId}/`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error("Failed to load customer.");
        }

        setForm({
          business_name: result.business_name || "",
          contact_name: result.contact_name || "",
          email: result.email || "",
          phone: result.phone || "",
          status: result.status || "active",
          notes: result.notes || "",
          address_line_1: result.address_line_1 || "",
          address_line_2: result.address_line_2 || "",
          town: result.town || "",
          county: result.county || "",
          postcode: result.postcode || "",
          billing: {
            invoice_requires_po: Boolean(result.billing?.invoice_requires_po),
            invoice_payment_terms_days: Number(result.billing?.invoice_payment_terms_days || 30),
            invoice_email: result.billing?.invoice_email || "",
            invoice_po_number: result.billing?.invoice_po_number || "",
            auto_invoice_enabled: result.billing?.auto_invoice_enabled !== false,
            next_invoice_date: result.billing?.next_invoice_date || "",
            last_invoiced_at: result.billing?.last_invoiced_at || "",
          },
        });
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load customer.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadCustomer();
  }, [customerId]);

  function updateField<K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBillingField<K extends keyof CustomerForm["billing"]>(
    field: K,
    value: CustomerForm["billing"][K]
  ) {
    setForm((current) => ({
      ...current,
      billing: {
        ...current.billing,
        [field]: value,
      },
    }));
  }

  async function saveCustomer() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`http://127.0.0.1:8000/api/customers/${customerId}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save customer.");
      }

      setSuccess("Customer updated successfully.");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save customer.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffShell title="Edit Customer">
      {loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading customer...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-xl font-semibold">Customer Details</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Update the customer account details below.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Business Name</label>
                <input
                  value={form.business_name}
                  onChange={(e) => updateField("business_name", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Contact Name</label>
                <input
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                >
                  <option value="onboarding" className="bg-white text-black">
                    Onboarding
                  </option>
                  <option value="ready_for_setup" className="bg-white text-black">
                    Ready for Setup
                  </option>
                  <option value="active" className="bg-white text-black">
                    Active
                  </option>
                  <option value="inactive" className="bg-white text-black">
                    Inactive
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Postcode</label>
                <input
                  value={form.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Address Line 1</label>
                <input
                  value={form.address_line_1}
                  onChange={(e) => updateField("address_line_1", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Address Line 2</label>
                <input
                  value={form.address_line_2}
                  onChange={(e) => updateField("address_line_2", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">Town</label>
                <input
                  value={form.town}
                  onChange={(e) => updateField("town", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-500">County</label>
                <input
                  value={form.county}
                  onChange={(e) => updateField("county", e.target.value)}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-500">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                />
              </div>
            </div>

            <div className="mt-8 rounded-lg border border-violet-100 bg-slate-50 p-4">
              <h3 className="text-lg font-semibold">Invoicing</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Control automatic invoices, PO requirements, and customer payment terms.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border border-violet-100 bg-white p-4 text-sm font-bold text-slate-950">
                  <input
                    type="checkbox"
                    checked={form.billing.auto_invoice_enabled}
                    onChange={(e) => updateBillingField("auto_invoice_enabled", e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Automatic invoicing enabled
                    <span className="mt-1 block text-xs font-medium text-slate-500">
                      Customer will be picked up by the invoice run when due.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-violet-100 bg-white p-4 text-sm font-bold text-slate-950">
                  <input
                    type="checkbox"
                    checked={form.billing.invoice_requires_po}
                    onChange={(e) => updateBillingField("invoice_requires_po", e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Customer needs a PO for invoices
                    <span className="mt-1 block text-xs font-medium text-slate-500">
                      New invoices will wait for a PO number before sending.
                    </span>
                  </span>
                </label>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-500">Invoice Terms</label>
                  <select
                    value={form.billing.invoice_payment_terms_days}
                    onChange={(e) => updateBillingField("invoice_payment_terms_days", Number(e.target.value))}
                    className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-500">Invoice Email</label>
                  <input
                    value={form.billing.invoice_email}
                    onChange={(e) => updateBillingField("invoice_email", e.target.value)}
                    placeholder="Leave blank to use customer email"
                    className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-500">Current PO Number</label>
                  <input
                    value={form.billing.invoice_po_number}
                    onChange={(e) => updateBillingField("invoice_po_number", e.target.value)}
                    placeholder="Required only if the customer needs a PO"
                    className="w-full rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-violet-100 bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">Next Invoice</div>
                    <div className="mt-1 text-sm font-bold text-slate-950">
                      {form.billing.next_invoice_date || "Not scheduled yet"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">Last Invoiced</div>
                    <div className="mt-1 text-sm font-bold text-slate-950">
                      {form.billing.last_invoiced_at
                        ? new Date(form.billing.last_invoiced_at).toLocaleString("en-GB")
                        : "Never"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 rounded-xl border border-green-300/30 bg-green-500/20 px-4 py-3 text-sm text-white">
                {success}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={saveCustomer}
                disabled={saving}
                className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-200 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Customer"}
              </button>

              <button
                onClick={() => router.push(`/customers/${customerId}`)}
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Back to Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
