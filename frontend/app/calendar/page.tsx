"use client";

import { useEffect, useState } from "react";
import StaffCalendar from "../../components/StaffCalendar";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders, getStoredUser, setStoredUser, StoredUser } from "../../lib/auth";

export default function MyCalendarPage() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetEventId, setTargetEventId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTargetDate(params.get("date") || "");
    setTargetEventId(Number(params.get("event")) || null);
  }, []);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        setLoading(true);
        setError("");
        const storedUser = getStoredUser();
        if (storedUser) setCurrentUser(storedUser);

        const response = await fetch("/api/auth/profile/me/", {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not load your profile.");

        setCurrentUser(data.user);
        setStoredUser(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your calendar.");
      } finally {
        setLoading(false);
      }
    }

    loadCurrentUser();
  }, []);

  return (
    <StaffShell title="My Calendar">
      {loading && !currentUser ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-sm font-bold text-slate-950 shadow-sm">
          Loading calendar...
        </div>
      ) : error && !currentUser ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700 shadow-sm">
          {error}
        </div>
      ) : currentUser ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h1 className="text-2xl font-black">My Calendar</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Add your own events and review calendar requests from other staff.
            </p>
          </div>
          <StaffCalendar
            staffUser={currentUser}
            currentUser={currentUser}
            initialDate={targetDate || undefined}
            targetEventId={targetEventId}
          />
        </div>
      ) : null}
    </StaffShell>
  );
}
