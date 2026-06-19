"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import {
  CoreFeature,
  FeatureStatus,
  coreFeatureGroups,
  countFeatures,
  statusLabels,
} from "@/lib/coreFeatureMap";

const statusStyles: Record<FeatureStatus, string> = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-700",
  basic: "border-amber-200 bg-amber-50 text-amber-800",
  next: "border-slate-200 bg-slate-100 text-slate-700",
};

const filterOptions: Array<{ label: string; value: "all" | FeatureStatus }> = [
  { label: "All", value: "all" },
  { label: "Live", value: "live" },
  { label: "Basic", value: "basic" },
  { label: "Next Build", value: "next" },
];

function StatusBadge({ status }: { status: FeatureStatus }) {
  return (
    <span className={`inline-flex min-w-[82px] justify-center rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function FeatureRow({ feature }: { feature: CoreFeature }) {
  return (
    <div className="grid gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-700 md:grid-cols-[210px_100px_minmax(0,1fr)_92px] md:items-center">
      <div className="font-bold text-slate-950">{feature.name}</div>
      <StatusBadge status={feature.status} />
      <div className="leading-5">{feature.note}</div>
      <div className="md:text-right">
        {feature.href ? (
          <Link href={feature.href} className="font-bold text-violet-700 hover:text-violet-900">
            Open
          </Link>
        ) : (
          <span className="text-xs font-bold uppercase text-slate-400">Planned</span>
        )}
      </div>
    </div>
  );
}

export default function CoreMapPage() {
  const [filter, setFilter] = useState<"all" | FeatureStatus>("all");

  const filteredGroups = useMemo(() => {
    return coreFeatureGroups
      .map((group) => ({
        ...group,
        features: group.features.filter((feature) => filter === "all" || feature.status === filter),
      }))
      .filter((group) => group.features.length > 0);
  }, [filter]);

  const total = countFeatures();
  const live = countFeatures("live");
  const basic = countFeatures("basic");
  const next = countFeatures("next");

  return (
    <StaffShell title="CRM Map">
      <div className="space-y-5">
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Recyclr Core</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">CRM Build Map</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                A working map of the CRM features, showing what is live now, what has a basic first version, and what still needs a proper build.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-md px-4 py-2 text-sm font-bold ${
                    filter === option.value
                      ? "bg-violet-700 text-white"
                      : "bg-violet-50 text-violet-800 hover:bg-violet-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total Features</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{total}</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Live</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{live}</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Basic</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{basic}</p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Next Build</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{next}</p>
          </div>
        </section>

        <div className="space-y-5">
          {filteredGroups.map((group) => (
            <section key={group.title} className="overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">{group.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{group.purpose}</p>
                </div>
                <p className="text-sm font-bold text-slate-500">{group.features.length} shown</p>
              </div>
              <div className="border-t border-slate-100">
                {group.features.map((feature) => (
                  <FeatureRow key={`${group.title}-${feature.name}`} feature={feature} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}
