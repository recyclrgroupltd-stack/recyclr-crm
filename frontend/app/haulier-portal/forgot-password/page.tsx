"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HaulierForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Forgot Password - Recyclr";
  }, []);

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("http://127.0.0.1:8000/api/hauliers/portal/forgot-password/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to send reset email.");
      }

      setMessage(data.message || "If that email exists, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#4a2ea8] px-4 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 backdrop-blur-lg">
        <div className="mb-8 text-center">
          <img
            src="/recyclrcore-logo.png"
            alt="RecyclrCore"
            className="mx-auto mb-4 h-auto w-[220px]"
          />
          <div className="mb-6 text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
            Hauliers
          </div>
          <h1 className="text-4xl font-bold">Reset Password</h1>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter email"
            />
          </div>

          {message ? (
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-3 text-sm text-white">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
          >
            {saving ? "Sending..." : "Send Reset Email"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/haulier-portal/login")}
            className="w-full text-sm text-white/80 hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}