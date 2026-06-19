"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function HaulierPortalLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Haulier Login - Recyclr";
  }, []);

  async function handleLogin(event?: FormEvent<HTMLFormElement>) {
    if (event) {
      event.preventDefault();
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("http://127.0.0.1:8000/api/hauliers/portal/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      localStorage.setItem("recyclrHaulierPortalUser", JSON.stringify(data.user));
      router.push("/haulier-portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#4a2ea8] px-4 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
        <div className="mb-8 text-center">
          <img
            src="/recyclrcore-logo.png"
            alt="RecyclrCore"
            className="mx-auto mb-4 h-auto w-[220px]"
          />
          <div className="mb-6 text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
            Hauliers
          </div>
          <h1 className="text-5xl font-bold text-white">Login</h1>
          <p className="mt-4 text-sm text-white/75">
            Access the haulier portal for assigned collections and updates.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter email"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
          >
            {saving ? "Logging in..." : "Login"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/haulier-portal/forgot-password")}
            className="w-full text-sm text-white/80 hover:underline"
          >
            Forgotten password?
          </button>
        </form>
      </div>
    </div>
  );
}