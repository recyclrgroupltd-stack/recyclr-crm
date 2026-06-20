"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath, friendlyApiError, readApiPayload } from "@/lib/apiBase";
import { clearStaffSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [authResolved, setAuthResolved] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("staff_token");
    const storedUsername =
      window.localStorage.getItem("staff_username") ||
      window.localStorage.getItem("username") ||
      "";

    if (storedToken === "staff-session-active") {
      clearStaffSession();
      setAuthResolved(true);
      return;
    }

    if (storedToken && storedUsername.trim()) {
      router.replace("/dashboard");
      return;
    }

    setAuthResolved(true);
  }, [router]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    if (event) {
      event.preventDefault();
    }

    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(apiPath("/api/auth/login/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await readApiPayload(response, "Login failed.");

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      const returnedUser = data.user || {};
      const resolvedUsername =
        data.username ||
        returnedUser.username ||
        username;

      const resolvedRole =
        data.role ||
        returnedUser.role ||
        "staff";

      const resolvedToken =
        data.token || "";

      if (!resolvedToken) {
        throw new Error("Login did not return a secure staff token.");
      }

      const storedUser = {
        id: returnedUser.id || 0,
        username: resolvedUsername,
        is_staff: Boolean(returnedUser.is_staff ?? true),
        is_superuser: Boolean(returnedUser.is_superuser ?? false),
        is_active: Boolean(returnedUser.is_active ?? true),
        role: resolvedRole,
        permissions: returnedUser.permissions || data.permissions || {},
      };

      window.localStorage.setItem("staff_token", resolvedToken);
      window.localStorage.setItem("staff_username", resolvedUsername);
      window.localStorage.setItem("username", resolvedUsername);
      window.localStorage.setItem("staff_role", resolvedRole);
      window.localStorage.setItem("recyclrUser", JSON.stringify(storedUser));

      router.replace("/dashboard");
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }

  if (!authResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#4a2ea8] text-white">
        <div className="rounded-3xl border border-white/20 bg-white/10 px-6 py-4 backdrop-blur-lg">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#4a2ea8] px-4 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 backdrop-blur-lg">
        <div className="mb-8 text-center">
          <img
            src="/recyclrcore-logo.png"
            alt="RecyclrCore"
            className="mx-auto mb-6 h-auto w-[220px]"
          />
          <h1 className="text-5xl font-bold">Staff Login</h1>
          <p className="mt-4 text-white/70">
            Access Recyclr Core to manage leads, customers, sites, quotes and operations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/85">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handleKeyDown}
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
            disabled={submitting}
            className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
