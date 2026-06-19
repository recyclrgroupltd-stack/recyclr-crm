"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_BASE, CUSTOMER_PORTAL_API_BASE, friendlyApiError, readApiPayload } from "@/lib/apiBase";

const API_BASE = CUSTOMER_PORTAL_API_BASE;

type Company = {
  name: string;
  logo_data: string;
  logo_url?: string;
  email: string;
  phone: string;
  website: string;
};

function logoSrc(company: Company | null) {
  if (!company) return "";
  if (company.logo_url) return company.logo_url.startsWith("http") ? company.logo_url : `${BACKEND_BASE}${company.logo_url}`;
  return company.logo_data || "";
}

export default function CustomerPortalLoginPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [customerUid, setCustomerUid] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/bootstrap/`)
      .then((response) => readApiPayload(response, "Could not load customer portal details."))
      .then((data) => {
        if (data.success) setCompany(data.company);
      })
      .catch(() => undefined);
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_uid: customerUid.trim(), email: email.trim() }),
      });
      const data = await readApiPayload(response, "Could not sign in.");
      if (!response.ok || !data.success) throw new Error(data.message || "Could not sign in.");
      localStorage.setItem("recyclrCustomerPortalToken", data.token);
      router.push("/customer-portal");
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const companyName = company?.name || "Recyclr Group Ltd";
  const companyLogo = logoSrc(company);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0338] px-4 py-8 text-slate-950">
      <section className="w-full max-w-xl rounded-lg bg-white p-7 shadow-2xl">
        <div className="mb-7">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="mb-6 h-auto w-[180px]" />
          ) : (
            <div className="mb-6 text-2xl font-black text-violet-800">{companyName}</div>
          )}
          <h1 className="text-3xl font-black">Customer portal</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Sign in with your customer ID and the email address on your account.
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>
        ) : null}

        <form onSubmit={login} className="space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Customer ID</span>
            <input
              value={customerUid}
              onChange={(event) => setCustomerUid(event.target.value)}
              placeholder="CUST-000001"
              className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-bold outline-none focus:border-violet-500"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-bold outline-none focus:border-violet-500"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-700 px-5 py-3 font-black text-white disabled:bg-slate-300"
          >
            {loading ? "Signing in..." : "Open Portal"}
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-600">
          Need access? Contact {companyName}
          {company?.email ? ` at ${company.email}` : ""}.
        </div>
      </section>
    </main>
  );
}
