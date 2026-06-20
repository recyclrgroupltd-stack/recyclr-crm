"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders, getStoredUser } from "../../lib/auth";
import { apiPath } from "../../lib/apiBase";
import { getWasteStreamStyle, wasteStreamSortOrder } from "../../lib/wasteStreams";

type DashboardOverview = {
  summary: {
    total_monthly_revenue: number;
    active_customers: number;
    active_services: number;
    quotes_pending: number;
    ready_for_setup_customers: number;
    pending_schedule_services: number;
    todays_jobs: number;
    overdue_jobs: number;
    failed_jobs: number;
    assigned_containers: number;
    containers_in_stock: number;
    containers_in_maintenance: number;
    open_container_maintenance: number;
    pending_calendar_requests: number;
    unread_notifications: number;
    pending_purchase_orders: number;
    signing_packs_waiting: number;
    my_customers_count: number;
  };
  attention: {
    accepted_quotes_awaiting_setup_count: number;
    leads_needing_follow_up_count: number;
    failed_collections_count: number;
    accepted_quotes_awaiting_setup: {
      quote_number: string;
      customer_name: string;
      site_name: string;
      monthly_total: number;
      created_at: string;
    }[];
    leads_needing_follow_up: {
      id: number;
      company_name: string;
      contact_name: string;
      phone: string;
      status: string;
      follow_up_date: string;
    }[];
    failed_collections: {
      id: number;
      customer_name: string;
      site_name: string;
      waste_type: string;
      reason: string;
      date_time: string;
    }[];
    ready_for_setup_customers: {
      id: number;
      business_name: string;
      account_manager: string;
      created_at: string;
    }[];
    pending_schedule_services: {
      id: number;
      customer_name: string;
      site_name: string;
      waste_type: string;
      bin_size: string;
      created_at: string;
    }[];
    upcoming_jobs: {
      id: number;
      customer_name: string;
      site_name: string;
      waste_type: string;
      bin_size: string;
      status: string;
      collection_date: string;
    }[];
    container_actions: {
      id: number;
      container_uid: string;
      status: string;
      bin_size: string;
      waste_stream: string;
      site_name: string;
      customer_name: string;
    }[];
  };
  top_customers: {
    id: number;
    business_name: string;
    active_service_count: number;
    monthly_revenue: number;
  }[];
  services_by_waste_type: {
    waste_type: string;
    label: string;
    service_count: number;
    monthly_value: number;
  }[];
};

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDateOnly(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatStatus(value: string) {
  if (!value) return "-";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFromUsername(username?: string) {
  const firstPart = (username || "Jay").split(/[.\s_-]+/).filter(Boolean)[0] || "Jay";
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-violet-100 bg-white text-slate-950 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#120a35]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function PriorityCard({
  value,
  label,
  helper,
  href,
  tone,
}: {
  value: number | string;
  label: string;
  helper: string;
  href: string;
  tone: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className={`mb-3 inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-black ${tone}`}>
          {value}
        </div>
        <div className="text-sm font-black text-[#120a35]">{label}</div>
        <div className="mt-2 text-xs font-bold text-slate-500">{helper}</div>
      </Card>
    </Link>
  );
}

function MiniAction({ label, href, icon, tone }: { label: string; href: string; icon: string; tone: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md bg-violet-50 px-3 py-2 text-sm font-bold text-[#160663] transition hover:bg-violet-100">
      <span className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black text-white ${tone}`}>{icon}</span>
        {label}
      </span>
      <span className="text-slate-400">{">"}</span>
    </Link>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">{children}</div>;
}

function WasteDonut({ items, total }: { items: DashboardOverview["services_by_waste_type"]; total: number }) {
  const activeItems = items.length
    ? [...items].sort((a, b) => wasteStreamSortOrder(a.waste_type || a.label) - wasteStreamSortOrder(b.waste_type || b.label))
    : [{ waste_type: "none", label: "No data", service_count: 1, monthly_value: 0 }];
  const stops = activeItems
    .reduce<{ running: number; stops: string[] }>((acc, item) => {
      const start = acc.running;
      const pct = activeItems.length && total ? (item.service_count / total) * 100 : 100;
      const end = start + pct;
      acc.stops.push(`${getWasteStreamStyle(item.waste_type || item.label).color} ${start}% ${end}%`);
      return { running: end, stops: acc.stops };
    }, { running: 0, stops: [] })
    .stops
    .join(", ");

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <div className="text-xl font-black text-[#120a35]">{total}</div>
          <div className="text-[10px] font-bold text-slate-500">Services</div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {activeItems.slice(0, 6).map((item) => {
          const pct = total ? Math.round((item.service_count / total) * 100) : 0;
          const style = getWasteStreamStyle(item.waste_type || item.label);
          return (
            <div key={item.waste_type} className="flex items-center justify-between gap-3 text-xs font-bold">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full border border-slate-200" style={{ backgroundColor: style.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-slate-500">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(apiPath("/api/dashboard/overview/"), {
          headers: getAuthHeaders(),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to load dashboard.");
        setData(result);
      } catch (err) {
        console.error(err);
        setError("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const totalServicesByWaste = useMemo(() => {
    return data?.services_by_waste_type.reduce((sum, item) => sum + Number(item.service_count || 0), 0) || 0;
  }, [data]);

  const actionRows = useMemo(() => {
    if (!data) return [];
    return [
      ...data.attention.ready_for_setup_customers.slice(0, 4).map((item) => ({
        date: formatDateOnly(item.created_at),
        title: item.business_name,
        detail: item.account_manager ? `Manager: ${item.account_manager}` : "No manager set",
        type: "Ready for setup",
        href: `/customers/${item.id}`,
        tone: "bg-emerald-600",
      })),
      ...data.attention.pending_schedule_services.slice(0, 4).map((item) => ({
        date: formatDateOnly(item.created_at),
        title: item.customer_name,
        detail: `${item.site_name || "No site"} - ${formatStatus(item.waste_type)} ${item.bin_size}L`,
        type: "Schedule needed",
        href: `/services/${item.id}`,
        tone: "bg-blue-600",
      })),
      ...data.attention.leads_needing_follow_up.slice(0, 3).map((item) => ({
        date: formatDateOnly(item.follow_up_date),
        title: item.company_name,
        detail: item.contact_name || item.phone || "No contact noted",
        type: "Lead follow-up",
        href: `/leads/${item.id}`,
        tone: "bg-violet-700",
      })),
      ...data.attention.upcoming_jobs.slice(0, 4).map((item) => ({
        date: formatDateOnly(item.collection_date),
        title: item.customer_name,
        detail: `${item.site_name || "No site"} - ${formatStatus(item.waste_type)} ${item.bin_size}`,
        type: formatStatus(item.status),
        href: "/jobs",
        tone: item.status === "failed" ? "bg-red-600" : "bg-orange-500",
      })),
    ].slice(0, 10);
  }, [data]);

  const dashboardGreeting = greetingForHour(currentTime.getHours());
  const dashboardName = firstNameFromUsername(getStoredUser()?.username);

  return (
    <StaffShell title="Dashboard">
      {loading ? (
        <Card className="p-6 text-sm font-bold">Loading dashboard...</Card>
      ) : error || !data ? (
        <Card className="border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
          {error || "Could not load dashboard."}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-white">
            <div>
              <h1 className="text-2xl font-black text-white">
                {dashboardGreeting}, {dashboardName}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/75">
                Your live work queue and business health in one place.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-right">
              <div className="text-xs font-bold text-white/70">Monthly active revenue</div>
              <div className="text-xl font-black">{formatMoney(data.summary.total_monthly_revenue)}</div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <PriorityCard
              value={data.summary.ready_for_setup_customers}
              label="Customers Ready For Setup"
              helper="Signed and waiting for operations"
              href="/my-customers"
              tone="bg-emerald-100 text-emerald-800"
            />
            <PriorityCard
              value={data.summary.pending_schedule_services}
              label="Services Need Scheduling"
              helper="Set days/start dates before live"
              href="/services"
              tone="bg-blue-100 text-blue-800"
            />
            <PriorityCard
              value={data.summary.todays_jobs}
              label="Jobs Today"
              helper={data.summary.overdue_jobs ? `${data.summary.overdue_jobs} overdue` : "Scheduled for today"}
              href="/jobs"
              tone={data.summary.overdue_jobs ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}
            />
            <PriorityCard
              value={data.attention.leads_needing_follow_up_count}
              label="Lead Follow-Ups"
              helper="Sales calls due now"
              href="/leads"
              tone="bg-violet-100 text-violet-800"
            />
            <PriorityCard
              value={data.summary.open_container_maintenance}
              label="Container Maintenance"
              helper={`${data.summary.assigned_containers} assigned, ${data.summary.containers_in_maintenance} in repair`}
              href="/containers/maintenance"
              tone="bg-amber-100 text-amber-800"
            />
            <PriorityCard
              value={data.summary.unread_notifications}
              label="Notifications"
              helper={`${data.summary.pending_calendar_requests} calendar request(s)`}
              href="/calendar"
              tone="bg-pink-100 text-pink-800"
            />
          </div>

          <div className="grid gap-2 xl:grid-cols-[1.25fr_0.75fr]">
            <Panel title="Priority Action Queue" subtitle="The main things that need moving next." action={<Link href="/jobs" className="text-xs font-black text-violet-700">Open jobs</Link>}>
              <div className="overflow-hidden rounded-md border border-slate-100">
                <div className="grid grid-cols-[0.7fr_1.25fr_1.25fr_1fr] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <span>Date</span>
                  <span>Item</span>
                  <span>Detail</span>
                  <span>Status</span>
                </div>
                {actionRows.length === 0 ? (
                  <EmptyState>No priority actions waiting right now.</EmptyState>
                ) : (
                  actionRows.map((row, index) => (
                    <Link
                      key={`${row.title}-${row.type}-${index}`}
                      href={row.href}
                      className="grid grid-cols-[0.7fr_1.25fr_1.25fr_1fr] items-center border-t border-slate-100 px-3 py-3 text-xs hover:bg-violet-50"
                    >
                      <span className="font-bold text-slate-600">{row.date}</span>
                      <span className="font-black text-[#120a35]">{row.title || "-"}</span>
                      <span className="font-bold text-slate-600">{row.detail}</span>
                      <span>
                        <span className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-black uppercase text-white ${row.tone}`}>
                          {row.type}
                        </span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Onboarding Pipeline" subtitle="Where new customers are getting stuck.">
              <div className="space-y-2">
                {[
                  { label: "Quotes not yet accepted", value: data.summary.quotes_pending, href: "/quotes" },
                  { label: "Signing packs waiting", value: data.summary.signing_packs_waiting, href: "/contract-signing" },
                  { label: "Customers ready for setup", value: data.summary.ready_for_setup_customers, href: "/my-customers" },
                  { label: "Services pending schedule", value: data.summary.pending_schedule_services, href: "/services" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-md bg-violet-50 px-3 py-3 text-sm font-bold hover:bg-violet-100">
                    <span>{item.label}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-violet-700">{item.value}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-2 xl:grid-cols-[0.9fr_0.8fr_0.65fr]">
            <Panel title="Container Operations" subtitle="Stock, assigned containers, and maintenance risk.">
              <div className="mb-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-2xl font-black">{data.summary.containers_in_stock}</div>
                  <div className="text-xs font-bold text-slate-500">In stock</div>
                </div>
                <div className="rounded-md bg-blue-50 p-3">
                  <div className="text-2xl font-black">{data.summary.assigned_containers}</div>
                  <div className="text-xs font-bold text-slate-500">Assigned</div>
                </div>
                <div className="rounded-md bg-amber-50 p-3">
                  <div className="text-2xl font-black">{data.summary.containers_in_maintenance}</div>
                  <div className="text-xs font-bold text-slate-500">Maintenance</div>
                </div>
              </div>
              {data.attention.container_actions.length === 0 ? (
                <EmptyState>No container actions waiting.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {data.attention.container_actions.slice(0, 5).map((item) => (
                    <Link key={item.id} href="/containers" className="block rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black">{item.container_uid}</span>
                        <span className="rounded bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">{formatStatus(item.status)}</span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {formatStatus(item.waste_stream)} {item.bin_size}L {item.site_name ? `- ${item.site_name}` : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Service Mix" subtitle="Active services by waste stream.">
              <WasteDonut items={data.services_by_waste_type} total={totalServicesByWaste} />
            </Panel>

            <Panel title="Quick Actions">
              <div className="space-y-2">
                <MiniAction icon="L" label="Add New Lead" href="/leads" tone="bg-green-600" />
                <MiniAction icon="Q" label="Create Quote" href="/quotes/new" tone="bg-violet-700" />
                <MiniAction icon="S" label="Schedule Service" href="/services" tone="bg-blue-600" />
                <MiniAction icon="B" label="Add Containers" href="/containers" tone="bg-orange-500" />
                <MiniAction icon="M" label="My Customers" href="/my-customers" tone="bg-pink-600" />
                <MiniAction icon="D" label="Documents" href="/quote-documents" tone="bg-blue-600" />
              </div>
            </Panel>
          </div>

          <div className="grid gap-2 xl:grid-cols-[0.8fr_0.8fr_0.8fr]">
            <Panel title="Business Health" subtitle="Quiet numbers, not urgent actions.">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-2xl font-black text-[#120a35]">{formatMoney(data.summary.total_monthly_revenue)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">Monthly revenue</div>
                </div>
                <div className="rounded-md bg-blue-50 p-4">
                  <div className="text-2xl font-black text-[#120a35]">{data.summary.active_customers}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">Active customers</div>
                </div>
                <div className="rounded-md bg-violet-50 p-4">
                  <div className="text-2xl font-black text-[#120a35]">{data.summary.my_customers_count}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">My customers</div>
                </div>
              </div>
            </Panel>

            <Panel title="Top Customers" action={<Link href="/customers" className="text-xs font-black text-violet-700">View all</Link>}>
              {data.top_customers.length === 0 ? (
                <EmptyState>No active customer revenue yet.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {data.top_customers.map((customer) => (
                    <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-bold hover:bg-violet-50">
                      <span>{customer.business_name}</span>
                      <span className="text-violet-700">{formatMoney(customer.monthly_revenue)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Exceptions" subtitle="Things that usually cause phone calls.">
              <div className="space-y-2">
                {[
                  { label: "Failed jobs", value: data.summary.failed_jobs, href: "/jobs" },
                  { label: "Failed collections", value: data.attention.failed_collections_count, href: "/jobs" },
                  { label: "POs pending approval", value: data.summary.pending_purchase_orders, href: "/purchase-orders" },
                  { label: "Calendar requests", value: data.summary.pending_calendar_requests, href: "/calendar" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-bold hover:bg-violet-50">
                    <span>{item.label}</span>
                    <span className="rounded bg-white px-2 py-1 text-violet-700">{item.value}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
