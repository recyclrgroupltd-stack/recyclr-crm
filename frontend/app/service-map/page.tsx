"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap } from "leaflet";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders } from "../../lib/auth";
import { friendlyApiError, readApiPayload } from "../../lib/apiBase";

type LeafletModule = typeof import("leaflet");

type ServiceRow = {
  id: number;
  customer_id: number | null;
  customer_uid?: string;
  customer_name: string;
  site_id: number | null;
  site_name: string;
  site_postcode?: string;
  waste_type: string;
  waste_type_label: string;
  bin_size?: string;
  bin_size_label?: string;
  bin_count?: number;
  status: string;
  status_label?: string;
};

type SiteRow = {
  id: number;
  customer_id: number | null;
  customer_name?: string;
  site_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  town?: string;
  county?: string;
  postcode?: string;
};

type GeocodeResult = {
  lat: number;
  lng: number;
};

type MapPoint = {
  key: string;
  service: ServiceRow;
  site: SiteRow | null;
  lat: number;
  lng: number;
  offsetIndex: number;
};

type UnmappedService = {
  service: ServiceRow;
  reason: string;
};

const GEOCODE_CACHE_KEY = "recyclr_service_map_geocode_cache_v1";

const WASTE_STREAM_STYLES: Record<string, { label: string; color: string; text: string }> = {
  general: { label: "General Waste", color: "#111827", text: "text-slate-950" },
  mixed_recycling: { label: "Mixed Recycling", color: "#0ea5e9", text: "text-sky-700" },
  recycling: { label: "Mixed Recycling", color: "#0ea5e9", text: "text-sky-700" },
  glass: { label: "Glass", color: "#65a30d", text: "text-lime-700" },
  food: { label: "Food", color: "#f59e0b", text: "text-amber-700" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending_schedule", label: "Pending schedule" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

function normalizePostcode(value?: string) {
  return (value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function streamStyle(value: string, label?: string) {
  return WASTE_STREAM_STYLES[value] || {
    label: label || value.replaceAll("_", " "),
    color: "#7c3aed",
    text: "text-violet-700",
  };
}

function formatStatus(value: string, label?: string) {
  return label || value.replaceAll("_", " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readGeocodeCache() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(GEOCODE_CACHE_KEY) || "{}") as Record<string, GeocodeResult>;
  } catch {
    return {};
  }
}

function writeGeocodeCache(cache: Record<string, GeocodeResult>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache is an optimisation only.
  }
}

async function geocodePostcode(postcode: string, cache: Record<string, GeocodeResult>) {
  const normalized = normalizePostcode(postcode);
  if (!normalized) return null;
  if (cache[normalized]) return cache[normalized];

  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`);
  if (!response.ok) return null;
  const data = await response.json();
  const lat = Number(data?.result?.latitude);
  const lng = Number(data?.result?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const result = { lat, lng };
  cache[normalized] = result;
  writeGeocodeCache(cache);
  return result;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await worker(current));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function makeMarkerHtml(color: string, label: string) {
  return `
    <span style="
      display:block;
      width:18px;
      height:18px;
      border-radius:9999px;
      background:${color};
      border:3px solid white;
      box-shadow:0 10px 24px rgba(15, 23, 42, 0.45);
    " title="${escapeHtml(label)}"></span>
  `;
}

function makePopupHtml(point: MapPoint) {
  const service = point.service;
  const site = point.site;
  const style = streamStyle(service.waste_type, service.waste_type_label);
  const customerId = service.customer_id || site?.customer_id;
  const address = [
    site?.address_line_1,
    site?.address_line_2,
    site?.town,
    site?.county,
    site?.postcode || service.site_postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return `
    <div style="min-width:230px; max-width:280px;">
      <div style="font-size:14px; font-weight:900; color:#020617;">${escapeHtml(service.customer_name || site?.customer_name || "Customer")}</div>
      <div style="margin-top:2px; font-size:12px; font-weight:700; color:#475569;">${escapeHtml(service.site_name || site?.site_name || "Site")}</div>
      <div style="margin-top:10px; display:inline-flex; border-radius:999px; padding:5px 9px; background:${style.color}; color:white; font-size:11px; font-weight:900;">
        ${escapeHtml(style.label)}
      </div>
      <div style="margin-top:10px; font-size:12px; color:#334155;">
        <strong>Bin:</strong> ${escapeHtml(`${service.bin_count || 0} x ${service.bin_size_label || service.bin_size || "bin"}`)}<br />
        <strong>Status:</strong> ${escapeHtml(formatStatus(service.status, service.status_label))}<br />
        <strong>Address:</strong> ${escapeHtml(address || "No address")}
      </div>
      ${
        customerId
          ? `<a href="/customers/${customerId}" style="margin-top:12px; display:block; border-radius:6px; background:#6d00e8; color:white; padding:9px 10px; text-align:center; font-size:12px; font-weight:900; text-decoration:none;">Open customer</a>`
          : ""
      }
    </div>
  `;
}

export default function ServiceMapPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Service Map - Recyclr";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setupMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapContainerRef.current) return;

      leafletRef.current = L;
      mapRef.current = L.map(mapContainerRef.current, {
        center: [52.85, -1.55],
        zoom: 6,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    }

    setupMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const loadMapData = useCallback(async () => {
    try {
      setLoading(true);
      setGeocoding(true);
      setError("");

      const [servicesResponse, sitesResponse] = await Promise.all([
        fetch("/api/services/", { headers: getAuthHeaders() }),
        fetch("/api/customers/sites/", { headers: getAuthHeaders() }),
      ]);
      const servicesData = await readApiPayload(servicesResponse, "Could not load services for the map.");
      const sitesData = await readApiPayload(sitesResponse, "Could not load customer sites for the map.");

      if (!servicesResponse.ok) throw new Error(servicesData?.message || "Could not load services for the map.");
      if (!sitesResponse.ok) throw new Error(sitesData?.message || "Could not load customer sites for the map.");

      const serviceRows: ServiceRow[] = Array.isArray(servicesData)
        ? servicesData
        : Array.isArray(servicesData?.rows)
          ? servicesData.rows
          : Array.isArray(servicesData?.services)
            ? servicesData.services
            : [];
      const siteRows: SiteRow[] = Array.isArray(sitesData)
        ? sitesData
        : Array.isArray(sitesData?.rows)
          ? sitesData.rows
          : Array.isArray(sitesData?.sites)
            ? sitesData.sites
            : [];

      const siteById = new Map(siteRows.map((site) => [Number(site.id), site]));
      const cache = readGeocodeCache();
      const offsetCounts = new Map<string, number>();
      const skipped: UnmappedService[] = [];

      const mapped = await mapWithConcurrency(serviceRows, 6, async (service) => {
        const site = service.site_id ? siteById.get(Number(service.site_id)) || null : null;
        const postcode = normalizePostcode(site?.postcode || service.site_postcode);
        if (!postcode) {
          skipped.push({ service, reason: "No site postcode" });
          return null;
        }

        const geocode = await geocodePostcode(postcode, cache);
        if (!geocode) {
          skipped.push({ service, reason: `Could not map postcode ${postcode}` });
          return null;
        }

        const coordinateKey = `${geocode.lat.toFixed(5)},${geocode.lng.toFixed(5)}`;
        const offsetIndex = offsetCounts.get(coordinateKey) || 0;
        offsetCounts.set(coordinateKey, offsetIndex + 1);

        return {
          key: `${service.id}-${coordinateKey}`,
          service,
          site,
          lat: geocode.lat,
          lng: geocode.lng,
          offsetIndex,
        } satisfies MapPoint;
      });

      const validPoints = mapped.filter(Boolean) as MapPoint[];
      const streams = Array.from(new Set(serviceRows.map((row) => row.waste_type).filter(Boolean)));

      setServices(serviceRows);
      setSites(siteRows);
      setPoints(validPoints);
      setUnmapped(skipped);
      setSelectedStreams((current) => (current.length ? current.filter((item) => streams.includes(item)) : streams));
    } catch (err) {
      setError(friendlyApiError(err));
      setServices([]);
      setSites([]);
      setPoints([]);
      setUnmapped([]);
    } finally {
      setLoading(false);
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  const availableStreams = useMemo(() => {
    const values = Array.from(new Set(services.map((row) => row.waste_type).filter(Boolean)));
    return values.sort((a, b) => streamStyle(a).label.localeCompare(streamStyle(b).label));
  }, [services]);

  const filteredPoints = useMemo(() => {
    const term = search.trim().toLowerCase();
    return points.filter((point) => {
      const service = point.service;
      const site = point.site;
      if (statusFilter !== "all" && service.status !== statusFilter) return false;
      if (selectedStreams.length && !selectedStreams.includes(service.waste_type)) return false;
      if (!term) return true;
      return [
        service.customer_name,
        service.customer_uid,
        service.site_name,
        service.site_postcode,
        service.waste_type_label,
        service.bin_size_label,
        service.status_label,
        site?.address_line_1,
        site?.town,
        site?.county,
        site?.postcode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [points, search, selectedStreams, statusFilter]);

  const filteredSiteCount = useMemo(() => {
    const siteKeys = new Set(filteredPoints.map((point) => point.service.site_id || point.site?.id || point.key));
    return siteKeys.size;
  }, [filteredPoints]);

  const activeCount = useMemo(() => filteredPoints.filter((point) => point.service.status === "active").length, [filteredPoints]);

  const streamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of points) {
      counts.set(point.service.waste_type, (counts.get(point.service.waste_type) || 0) + 1);
    }
    return counts;
  }, [points]);

  const fitToResults = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || filteredPoints.length === 0) return;
    const bounds = filteredPoints.map((point) => [point.lat, point.lng]) as LatLngBoundsExpression;
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
  }, [filteredPoints]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    const layer = L.layerGroup();
    for (const point of filteredPoints) {
      const style = streamStyle(point.service.waste_type, point.service.waste_type_label);
      const spread = 0.00075;
      const angle = (point.offsetIndex % 10) * ((Math.PI * 2) / 10);
      const radius = point.offsetIndex === 0 ? 0 : spread * (1 + Math.floor(point.offsetIndex / 10));
      const lat = point.lat + Math.sin(angle) * radius;
      const lng = point.lng + Math.cos(angle) * radius;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          html: makeMarkerHtml(style.color, style.label),
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          popupAnchor: [0, -8],
        }),
      });
      marker.bindPopup(makePopupHtml(point), { className: "service-map-popup" });
      marker.addTo(layer);
    }

    layer.addTo(map);
    layerRef.current = layer;
  }, [filteredPoints]);

  useEffect(() => {
    if (!loading && filteredPoints.length) {
      window.setTimeout(fitToResults, 120);
    }
  }, [fitToResults, filteredPoints.length, loading]);

  function toggleStream(stream: string) {
    setSelectedStreams((current) => {
      if (current.includes(stream)) return current.filter((item) => item !== stream);
      return [...current, stream];
    });
  }

  function selectAllStreams() {
    setSelectedStreams(availableStreams);
  }

  function clearStreams() {
    setSelectedStreams([]);
  }

  return (
    <StaffShell title="Service Map">
      <div className="space-y-5">
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-950">Service Map</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
                See customer service coverage across the country. Each dot is a service waste stream, and each popup links back to the customer record.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadMapData}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={fitToResults}
                disabled={!filteredPoints.length}
                className="rounded-md bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Fit to Results
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Mapped Services</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{filteredPoints.length}</div>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Customer Sites</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{filteredSiteCount}</div>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Active Services</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{activeCount}</div>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Unmapped</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{unmapped.length}</div>
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <label>
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Search map</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, site, postcode, stream..."
                className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-violet-500"
              />
            </label>
            <label>
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 bg-violet-50 px-4 py-3 text-sm font-black text-slate-950"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Waste streams</div>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllStreams} className="text-xs font-black text-violet-700">
                  All
                </button>
                <button type="button" onClick={clearStreams} className="text-xs font-black text-slate-500">
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableStreams.length === 0 ? (
                <span className="text-sm font-semibold text-slate-500">No service waste streams found yet.</span>
              ) : (
                availableStreams.map((stream) => {
                  const style = streamStyle(stream);
                  const selected = selectedStreams.includes(stream);
                  return (
                    <button
                      key={stream}
                      type="button"
                      onClick={() => toggleStream(stream)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
                        selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: style.color }} />
                      {style.label}
                      <span className={selected ? "text-white/70" : "text-slate-400"}>{streamCounts.get(stream) || 0}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">Coverage View</h2>
                <p className="text-sm font-semibold text-slate-600">
                  {loading || geocoding ? "Loading and mapping postcodes..." : `${filteredPoints.length} visible service dots.`}
                </p>
              </div>
              <div className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800">
                OpenStreetMap
              </div>
            </div>
            <div ref={mapContainerRef} className="h-[520px] w-full bg-slate-100 md:h-[680px]" />
          </div>

          <div className="space-y-5">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">What This Shows</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Dense clusters show where Recyclr already has services. Empty regions show where sales can target similar customers or suppliers.
              </p>
              <div className="mt-4 space-y-2">
                {availableStreams.map((stream) => {
                  const style = streamStyle(stream);
                  return (
                    <div key={stream} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm font-black text-slate-950">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: style.color }} />
                        {style.label}
                      </span>
                      <span className="text-sm font-black text-slate-500">{streamCounts.get(stream) || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Unmapped Services</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                These need a clean site postcode before they can appear on the map.
              </p>
              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {unmapped.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">
                    Everything with a service has mapped cleanly.
                  </div>
                ) : (
                  unmapped.slice(0, 30).map(({ service, reason }) => (
                    <div key={service.id} className="rounded-md bg-red-50 p-3">
                      <div className="font-black text-slate-950">{service.customer_name || "Customer"}</div>
                      <div className="text-xs font-semibold text-slate-600">
                        {service.site_name || "Site"} - {service.waste_type_label || service.waste_type}
                      </div>
                      <div className="mt-2 text-xs font-black text-red-700">{reason}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
