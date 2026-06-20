"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath, friendlyApiError, readApiPayload } from "@/lib/apiBase";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDeviceName, setActiveDeviceName] = useState("");

  function getDeviceName() {
    const platform = window.navigator.platform || "Unknown platform";
    const userAgent = window.navigator.userAgent || "";
    const browser = userAgent.includes("Edg/")
      ? "Edge"
      : userAgent.includes("Chrome/")
        ? "Chrome"
        : userAgent.includes("Firefox/")
          ? "Firefox"
          : userAgent.includes("Safari/")
            ? "Safari"
            : "Browser";
    return `${browser} on ${platform}`;
  }

  function storeLogin(data: any) {
    const returnedUser = data.user || {};
    const resolvedUsername = data.username || returnedUser.username || username;
    const resolvedRole = data.role || returnedUser.role || "staff";
    const resolvedToken = data.token || "staff-session-active";

    const storedUser = {
      id: returnedUser.id || 0,
      username: resolvedUsername,
      is_staff: Boolean(returnedUser.is_staff ?? true),
      is_superuser: Boolean(returnedUser.is_superuser ?? false),
      is_active: Boolean(returnedUser.is_active ?? true),
      role: resolvedRole,
      permissions: returnedUser.permissions || data.permissions || {},
    };

    localStorage.setItem("staff_token", resolvedToken);
    localStorage.setItem("staff_username", resolvedUsername);
    localStorage.setItem("username", resolvedUsername);
    localStorage.setItem("staff_role", resolvedRole);
    localStorage.setItem("staff_device_name", data.device_name || getDeviceName());
    localStorage.setItem("recyclrUser", JSON.stringify(storedUser));
  }

  async function handleSubmit(e?: FormEvent<HTMLFormElement>, forceLogin = false) {
    if (e) {
      e.preventDefault();
    }
    setLoading(true);
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
          device_name: getDeviceName(),
          force_login: forceLogin,
        }),
      });

      const data = await readApiPayload(response, "Login failed.");

      if (response.status === 409 && data.code === "active_session_exists") {
        setActiveDeviceName(data.active_device_name || "another device");
        setLoading(false);
        return;
      }

      if (!response.ok || !data.success) {
        setError(data.message || "Login failed.");
        setLoading(false);
        return;
      }

      storeLogin(data);
      router.replace("/dashboard");
    } catch (err) {
      setError(friendlyApiError(err));
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#412a8a]">
      {activeDeviceName ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white p-6 text-slate-950 shadow-2xl">
            <h2 className="text-xl font-bold">User Already Logged In</h2>
            <p className="mt-3 text-sm font-medium text-slate-600">
              This user is already logged into {activeDeviceName}. If you continue, that device will be logged out.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveDeviceName("")}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDeviceName("");
                  handleSubmit(undefined, true);
                }}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-800"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-10 shadow-xl backdrop-blur-lg">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/recyclrcore-logo.png"
            alt="Recyclr Core"
            className="mb-6 w-72"
          />
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-white">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/20 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/20 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white"
              placeholder="Enter password"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
