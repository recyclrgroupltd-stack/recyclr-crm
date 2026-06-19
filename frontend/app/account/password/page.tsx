"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StaffShell from "../../../components/StaffShell";

type StoredUser = {
  username: string;
  is_superuser?: boolean;
  is_staff?: boolean;
};

export default function ChangePasswordPage() {
  const router = useRouter();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const rawUser = localStorage.getItem("recyclrUser");

    if (!rawUser) {
      router.push("/login");
      return;
    }

    try {
      setUser(JSON.parse(rawUser));
    } catch {
      localStorage.removeItem("recyclrUser");
      router.push("/login");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.username) {
      setError("No logged in user found.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/auth/change-password/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user.username,
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not change password.");
      }

      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not change password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffShell title="Change Password">
      <div className="mx-auto max-w-3xl">
        {(message || error) && (
          <div
            className={`mb-6 rounded-3xl border p-4 backdrop-blur-lg ${
              error
                ? "border-red-300/30 bg-red-500/20"
                : "border-emerald-300/30 bg-emerald-500/20"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Update your password</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Logged in as <span className="font-semibold text-white">{user?.username ?? "Unknown"}</span>.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-[#412a8a] transition hover:bg-gray-200 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </StaffShell>
  );
}
