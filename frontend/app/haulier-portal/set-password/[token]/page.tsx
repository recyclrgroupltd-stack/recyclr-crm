"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPath } from "@/lib/apiBase";

export default function HaulierSetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Set Password - Recyclr";
  }, []);

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(apiPath(`/api/hauliers/portal/set-password/${token}/`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to set password.");
      }

      setMessage(data.message || "Password set successfully.");
      setTimeout(() => {
        router.push("/haulier-portal/login");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#4a2ea8] px-4 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 backdrop-blur-lg">
        <div className="mb-8 text-center">
          <img
            src="/recyclr-group-logo.png"
            alt="Recyclr Group Ltd"
            className="mx-auto mb-4 h-auto w-[220px]"
          />
          <div className="mb-6 text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
            Hauliers
          </div>
          <h1 className="text-4xl font-bold">Create Password</h1>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Repeat password"
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
            {saving ? "Saving..." : "Set Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
