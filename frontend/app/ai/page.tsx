"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import StaffShell from "@/components/StaffShell";
import { apiPath, friendlyApiError, readApiPayload } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/auth";

type AiStatus = {
  enabled: boolean;
  mode: string;
  provider: string;
  model: string;
  monthly_spend_limit_gbp: string;
  capabilities: string[];
  guardrails: string[];
};

type Insight = {
  severity: "ok" | "medium" | "high";
  title: string;
  count: number;
  detail: string;
  href: string;
};

type InteractionLog = {
  id: number;
  created_at: string;
  user: string;
  provider: string;
  model: string;
  context_type: string;
  context_id: number | null;
  intent: string;
  status: string;
  estimated_cost_gbp: string;
};

export default function AiPage() {
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [logs, setLogs] = useState<InteractionLog[]>([]);
  const [prompt, setPrompt] = useState("Summarise anything urgent in the CRM today.");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  async function loadAi() {
    setLoading(true);
    setError("");
    try {
      const [statusResponse, logsResponse] = await Promise.all([
        fetch(apiPath("/api/ai/status/"), { headers: getAuthHeaders() }),
        fetch(apiPath("/api/ai/logs/"), { headers: getAuthHeaders() }),
      ]);
      const statusData = await readApiPayload(statusResponse, "Could not load AI status.");
      const logsData = await readApiPayload(logsResponse, "Could not load AI logs.");
      if (!statusResponse.ok || !statusData.success) {
        throw new Error(statusData.message || "Could not load AI status.");
      }
      setAi(statusData.ai || null);
      setInsights(Array.isArray(statusData.insights) ? statusData.insights : []);
      setLogs(logsResponse.ok && Array.isArray(logsData.logs) ? logsData.logs : []);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAi();
  }, []);

  const urgentCount = useMemo(
    () => insights.filter((item) => item.severity !== "ok" && item.count > 0).length,
    [insights]
  );

  async function testWiring() {
    setChecking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(apiPath("/api/ai/assist/"), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          intent: "wiring_check",
          context_type: "crm",
        }),
      });
      const data = await readApiPayload(response, "Could not test AI wiring.");
      setMessage(data.message || "AI wiring checked.");
      await loadAi();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setChecking(false);
    }
  }

  function formatDate(value: string) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("en-GB");
    } catch {
      return value;
    }
  }

  return (
    <StaffShell title="AI Assistant">
      <div className="space-y-5">
        <section className="rounded-md border border-white/10 bg-white p-5 text-slate-950 shadow-xl shadow-violet-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-lime-600">Recyclr AI</div>
              <h1 className="mt-2 text-3xl font-black tracking-normal">OpenAI wiring is ready</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Installed in the CRM, held behind a feature flag, and ready to switch on when the live rules are agreed.
              </p>
            </div>
            <div
              className={`rounded-md px-4 py-3 text-sm font-black ${
                ai?.enabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {ai?.enabled ? "LIVE" : "DISABLED"}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
              {message}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Provider", ai?.provider || "openai"],
            ["Model", ai?.model || "Not selected yet"],
            ["Monthly cap", `GBP ${ai?.monthly_spend_limit_gbp || "0"}`],
            ["Open issues", String(urgentCount)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-white p-5 text-slate-950">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
              <div className="mt-3 break-words text-2xl font-black">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-md bg-white p-5 text-slate-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Free CRM Checks</h2>
                <p className="mt-1 text-sm text-slate-500">Rules-based checks, no AI cost.</p>
              </div>
              <button
                type="button"
                onClick={loadAi}
                disabled={loading}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {insights.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`rounded-md border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                    item.severity === "high" && item.count > 0
                      ? "border-red-200 bg-red-50"
                      : item.severity === "medium" && item.count > 0
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black">{item.title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</div>
                    </div>
                    <div className="text-3xl font-black">{item.count}</div>
                  </div>
                </Link>
              ))}
              {!loading && insights.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                  No checks returned yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-md bg-white p-5 text-slate-950">
              <h2 className="text-xl font-black">Switch-On Plan</h2>
              <div className="mt-4 space-y-3">
                {(ai?.guardrails || []).map((item) => (
                  <div key={item} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-white p-5 text-slate-950">
              <h2 className="text-xl font-black">Wiring Check</h2>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                className="mt-3 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={testWiring}
                disabled={checking || !prompt.trim()}
                className="mt-3 w-full rounded-md bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {checking ? "Checking..." : "Check AI Wiring"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-md bg-white p-5 text-slate-950">
            <h2 className="text-xl font-black">Planned Jobs</h2>
            <div className="mt-4 grid gap-3">
              {(ai?.capabilities || []).map((item) => (
                <div key={item} className="rounded-md border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-white p-5 text-slate-950">
            <h2 className="text-xl font-black">Recent AI Log</h2>
            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              {logs.length ? (
                logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="border-b border-slate-100 p-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black">{log.intent || "assistant"}</div>
                      <div className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-600">{log.status}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(log.created_at)} by {log.user || "Unknown"} - {log.provider}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-slate-500">No AI requests logged yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
