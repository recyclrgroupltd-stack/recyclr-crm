export type FeatureStatus = "live" | "basic" | "next";

export type CoreFeature = {
  name: string;
  status: FeatureStatus;
  note: string;
  href?: string;
};

export type CoreFeatureGroup = {
  title: string;
  purpose: string;
  features: CoreFeature[];
};

export const statusLabels: Record<FeatureStatus, string> = {
  live: "Live",
  basic: "Basic",
  next: "Next Build",
};

export const coreFeatureGroups: CoreFeatureGroup[] = [
  {
    title: "CRM & Sales",
    purpose: "Lead capture, quotes, customer conversion, and the sales paper trail.",
    features: [
      { name: "Leads management", status: "live", href: "/leads", note: "Lead records, follow-up dates, status tracking, and quote creation are working." },
      { name: "Sales pipeline", status: "basic", href: "/leads", note: "Lead statuses act as the first pipeline. A proper visual pipeline board is still a future upgrade." },
      { name: "Quotes", status: "live", href: "/quotes", note: "Quotes can be created from leads, edited, priced, saved, emailed, downloaded, and deleted." },
      { name: "Quote acceptance portal", status: "live", href: "/quotes", note: "Customer email links open a public acceptance page before onboarding continues." },
      { name: "Automatic quote PDFs", status: "live", href: "/quotes", note: "Quote PDFs are generated from the quote detail page and attached to quote emails." },
      { name: "Margin calculator", status: "basic", href: "/quotes", note: "Quote line totals are live. True margin needs supplier cost and overhead rules connected." },
      { name: "Contract generation", status: "live", href: "/contract-signing", note: "Accepted quotes generate service agreement, duty of care, and service schedule documents." },
      { name: "Contract tracking", status: "live", href: "/contract-signing", note: "Contract signing records and public signing links are tracked." },
      { name: "Customer onboarding workflow", status: "basic", href: "/contract-signing", note: "Quote acceptance to document signing is wired. Staff task automation still needs tightening." },
      { name: "Tasks & reminders", status: "next", note: "Calendar requests exist, but a central task/reminder module is still needed." },
      { name: "Activity log", status: "live", href: "/customers", note: "Customer dashboards show activity, documents, notes, emails, and service records." },
      { name: "Quick notes", status: "live", href: "/customers", note: "Customer quick notes are available on customer dashboards." },
      { name: "Email tracking", status: "basic", href: "/email", note: "CRM email is connected to Zoho and customer emails are recorded. Detailed open/click tracking is not built yet." },
      { name: "Automated email templates", status: "next", note: "Several automated emails exist, but editable template management is still a future feature." },
      { name: "Branded email system", status: "basic", href: "/email", note: "Zoho sending is wired and key CRM emails are branded. More template controls are needed." },
    ],
  },
  {
    title: "Customer Management",
    purpose: "Customer records, sites, services, documents, and ownership.",
    features: [
      { name: "Customer records", status: "live", href: "/customers", note: "Customer directory, dashboards, IDs, status, contact fields, and account managers are live." },
      { name: "Multiple contacts per customer", status: "next", href: "/customers", note: "Primary contact is live. Multiple named contacts still need their own proper table and UI." },
      { name: "Multiple sites per customer", status: "live", href: "/sites", note: "Customer sites are created during onboarding and can be managed separately." },
      { name: "Site-specific services", status: "live", href: "/services", note: "Services are tied to customer sites and drive scheduled jobs." },
      { name: "Service history", status: "basic", href: "/customers", note: "Customer dashboards show service and collection history. It can become more filterable." },
      { name: "Customer documents", status: "live", href: "/customers", note: "Generated and signed documents are stored against the customer." },
      { name: "Customer communication history", status: "basic", href: "/customers", note: "CRM emails and notes are shown, but full timeline filtering can be improved." },
      { name: "Customer portal", status: "live", href: "/customer-portal/login", note: "Customers can log in with their customer ID and email to view services, collections, documents, signing links, and send requests." },
      { name: "Online signup", status: "next", note: "Not built yet. This needs pricing rules, service availability, and customer portal decisions." },
      { name: "Preferred collection day requests", status: "next", note: "Not built yet. This belongs with service scheduling and customer portal work." },
      { name: "Customer account manager assignment", status: "live", href: "/my-customers", note: "Account managers can be assigned, auto-assigned, viewed, and changed by admins." },
    ],
  },
  {
    title: "Waste Services",
    purpose: "Waste stream setup, collection rules, service logs, and operational evidence.",
    features: [
      { name: "Waste stream management", status: "live", href: "/pricing", note: "Waste streams are used across pricing, quotes, services, jobs, and dashboard reporting." },
      { name: "Bin inventory", status: "live", href: "/containers", note: "Container inventory is live with IDs, statuses, QR codes, and site assignment." },
      { name: "Bin rental tracking", status: "basic", href: "/quotes", note: "Rental charges are calculated on quote and service lines. Full rental ledger reporting can be improved." },
      { name: "Delivery charges", status: "next", note: "Not built yet as a separate charge type." },
      { name: "Collection scheduling", status: "live", href: "/services", note: "Services generate scheduled collection jobs for the next seven days." },
      { name: "Additional lift requests", status: "next", note: "Not built yet. This should connect customer requests, operations approval, and job creation." },
      { name: "Missed collection reporting", status: "basic", href: "/jobs", note: "Failed jobs are tracked. A dedicated missed collection report flow is still needed." },
      { name: "Contamination reporting", status: "next", note: "Not built yet. This will need photos, notes, customer notification, and charge rules." },
      { name: "Service logs", status: "basic", href: "/customers", note: "Customer activity and job records give a first service log. A dedicated log view can be built later." },
      { name: "Collection history", status: "basic", href: "/jobs", note: "Completed, failed, overdue, and scheduled jobs are stored. History filtering can be improved." },
      { name: "Weight tracking", status: "next", note: "Not built yet. This belongs with weighing integrations and collection completion." },
      { name: "Revenue by waste stream", status: "basic", href: "/dashboard", note: "The dashboard shows service mix and revenue signals. Full revenue-by-stream reports need deeper finance work." },
      { name: "Recycling rate reporting", status: "next", note: "Not built yet. This needs stream classifications and weight data." },
    ],
  },
  {
    title: "Supplier / Haulier Management",
    purpose: "Haulier records, pricing, portal users, and supplier-side operations.",
    features: [
      { name: "Supplier records", status: "basic", href: "/purchase-orders", note: "Supplier use exists through purchase orders. A dedicated supplier directory is still needed." },
      { name: "Haulier records", status: "live", href: "/haulier-pricing", note: "Haulier companies can be created and managed." },
      { name: "Haulier rates", status: "live", href: "/haulier-pricing", note: "Waste stream, bin size, lift, weight, and excess rates are stored." },
      { name: "Haulier contracts", status: "next", note: "Not built as a separate contract workflow yet." },
      { name: "Haulier portal", status: "live", href: "/haulier-portal/login", note: "Portal access exists for hauliers and jobs." },
      { name: "Job allocation", status: "basic", href: "/jobs", note: "Jobs link to hauliers, but dispatch-style allocation needs more tooling." },
      { name: "Job status updates", status: "live", href: "/jobs", note: "Jobs can be marked collected or failed and appear in operational views." },
      { name: "Haulier performance tracking", status: "basic", href: "/jobs", note: "Failed and overdue jobs provide early performance signals. Full scorecards are still needed." },
      { name: "Password resets", status: "live", href: "/haulier-portal/forgot-password", note: "Haulier portal reset flow is present." },
      { name: "Portal user management", status: "live", href: "/haulier-pricing", note: "Haulier portal users can be created and managed from haulier pricing." },
    ],
  },
  {
    title: "Operations",
    purpose: "Collections, service scheduling, operational exceptions, and daily work.",
    features: [
      { name: "Collection management", status: "live", href: "/jobs", note: "Jobs page tracks due, overdue, failed, scheduled, and collected work." },
      { name: "Service scheduling", status: "live", href: "/services", note: "Services generate the next seven days of jobs automatically." },
      { name: "Driver allocation", status: "next", note: "Not built yet. This should come with driver records, shifts, and route planning." },
      { name: "Vehicle allocation", status: "next", note: "Not built yet. This needs fleet records and dispatch planning." },
      { name: "Route planning", status: "next", note: "Not built yet. This is a later operations and AI optimisation feature." },
      { name: "Collection completion logging", status: "basic", href: "/jobs", note: "Jobs can be marked collected. Richer completion logs need driver/mobile inputs." },
      { name: "Collection exceptions", status: "basic", href: "/jobs", note: "Failed jobs act as the first exception flow. Exception categories and customer notifications can be expanded." },
      { name: "Site notes", status: "basic", href: "/sites", note: "Sites exist, but richer operational notes and warnings need a dedicated UI." },
      { name: "Operational dashboard", status: "live", href: "/dashboard", note: "Dashboard shows live work queues, service mix, and operational alerts." },
    ],
  },
  {
    title: "Driver Portal",
    purpose: "Driver-facing work, documents, messages, evidence capture, and shift tools.",
    features: [
      { name: "Upcoming shifts", status: "next", note: "Not built yet. This needs driver users and shift scheduling." },
      { name: "Assigned jobs", status: "next", note: "Not built yet for drivers. Haulier job visibility exists, but an internal driver portal is separate." },
      { name: "Driver documents", status: "next", note: "Not built yet. This should connect staff files, compliance documents, and driver access." },
      { name: "Holiday requests", status: "next", note: "Not built yet. This belongs with HR-style staff scheduling." },
      { name: "Driver messages", status: "basic", href: "/dashboard", note: "Staff messenger exists. A driver-specific messaging portal is not built yet." },
      { name: "Collection completion", status: "next", note: "Not built yet as a driver mobile workflow." },
      { name: "Signature capture", status: "next", note: "Not built yet for collection proof of service." },
      { name: "Photo uploads", status: "next", note: "Not built yet for driver job evidence." },
      { name: "Driver debriefs", status: "next", note: "Not built yet." },
      { name: "Clock in / clock out", status: "next", note: "Not built yet." },
    ],
  },
  {
    title: "Tachograph & Compliance",
    purpose: "Driver-hours compliance, alerts, infringements, and tachograph data.",
    features: [
      { name: "Driver hours", status: "next", note: "Not built yet." },
      { name: "Driving time remaining", status: "next", note: "Not built yet." },
      { name: "Break countdowns", status: "next", note: "Not built yet." },
      { name: "Daily driving limits", status: "next", note: "Not built yet." },
      { name: "Weekly driving limits", status: "next", note: "Not built yet." },
      { name: "Fortnight driving limits", status: "next", note: "Not built yet." },
      { name: "Reduced rest tracking", status: "next", note: "Not built yet." },
      { name: "Weekly rest tracking", status: "next", note: "Not built yet." },
      { name: "WTD calculations", status: "next", note: "Not built yet." },
      { name: "POA calculations", status: "next", note: "Not built yet." },
      { name: "Tachograph card downloads", status: "next", note: "Not built yet." },
      { name: "Compliance alerts", status: "next", note: "Not built yet." },
      { name: "Driver infringement reports", status: "next", note: "Not built yet." },
    ],
  },
  {
    title: "Fleet Management",
    purpose: "Vehicle and trailer records, service dates, defects, and fleet costs.",
    features: [
      { name: "Vehicle records", status: "next", note: "Not built yet." },
      { name: "Trailer records", status: "next", note: "Not built yet." },
      { name: "MOT tracking", status: "next", note: "Not built yet." },
      { name: "PMI tracking", status: "next", note: "Not built yet." },
      { name: "Defect reporting", status: "next", note: "Not built yet." },
      { name: "Service schedules", status: "next", note: "Not built yet for fleet servicing." },
      { name: "Vehicle documents", status: "next", note: "Not built yet." },
      { name: "Fleet costs", status: "next", note: "Not built yet." },
      { name: "Fleet utilisation", status: "next", note: "Not built yet." },
    ],
  },
  {
    title: "Fuel Management",
    purpose: "Fuel cards, transactions, MPG, and anomaly reporting.",
    features: [
      { name: "Fuel cards", status: "next", note: "Not built yet." },
      { name: "Fuel card assignment", status: "next", note: "Not built yet." },
      { name: "Lost fuel card management", status: "next", note: "Not built yet." },
      { name: "Fuel transactions", status: "next", note: "Not built yet." },
      { name: "Fuel usage reporting", status: "next", note: "Not built yet." },
      { name: "MPG calculations", status: "next", note: "Not built yet." },
      { name: "Fuel theft anomaly reporting", status: "next", note: "Not built yet." },
    ],
  },
  {
    title: "Weighing & Collection Technology",
    purpose: "Vehicle weighing integrations, bin weights, uploads, and live weight history.",
    features: [
      { name: "VWS integration", status: "next", note: "Not built yet. This will need vendor API or file import details." },
      { name: "Bluetooth vehicle weighing connection", status: "next", note: "Not built yet. This is likely a mobile app or device integration project." },
      { name: "Bin weight capture", status: "next", note: "Not built yet." },
      { name: "Collection weight uploads", status: "next", note: "Not built yet." },
      { name: "Live weight reporting", status: "next", note: "Not built yet." },
      { name: "Weight history", status: "next", note: "Not built yet." },
    ],
  },
  {
    title: "Bin Asset Management",
    purpose: "Container inventory, QR codes, site assignment, and asset lifecycle.",
    features: [
      { name: "Bin serial numbers", status: "live", href: "/containers", note: "Containers get unique CONT IDs based on bin size and stream." },
      { name: "QR codes on bins", status: "live", href: "/containers", note: "Each container has its own QR code for future scanning and tracking." },
      { name: "RFID bins (future)", status: "next", note: "Not built yet. This should come after QR workflows are stable." },
      { name: "Bin delivery tracking", status: "basic", href: "/containers", note: "Container statuses cover in stock, assigned, active, and EOL." },
      { name: "Bin exchanges", status: "next", note: "Not built yet. This should be part of the asset movement workflow." },
      { name: "Bin repairs", status: "basic", href: "/containers/maintenance", note: "Maintenance area exists for tracking container maintenance." },
      { name: "Bin replacement tracking", status: "next", note: "Not built yet. It should connect maintenance, exchanges, and EOL." },
      { name: "Asset location tracking", status: "basic", href: "/containers", note: "Container assignment to customer sites is live. Full movement history needs more detail." },
    ],
  },
  {
    title: "Documents",
    purpose: "PDFs, contracts, signing, and customer document storage.",
    features: [
      { name: "Waste Transfer Notes", status: "live", href: "/contract-signing", note: "Generated as part of onboarding documents." },
      { name: "Duty of Care documents", status: "live", href: "/contract-signing", note: "Generated and signed as part of onboarding." },
      { name: "Service Agreements", status: "live", href: "/contract-signing", note: "Generated, sent for signing, and stored." },
      { name: "Service Schedules", status: "live", href: "/contract-signing", note: "Generated, sent for signing, and stored." },
      { name: "Customer contracts", status: "basic", href: "/contract-signing", note: "Customer contract documents exist through service agreements. Contract management can be expanded." },
      { name: "Supplier contracts", status: "next", note: "Not built yet." },
      { name: "E-signatures", status: "live", href: "/contract-signing", note: "Customers can sign documents from a public signing link." },
      { name: "Document storage", status: "live", href: "/customers", note: "Generated and signed documents are stored on customer records." },
      { name: "PDF generation", status: "live", href: "/quotes", note: "Quote and onboarding document PDFs are generated." },
    ],
  },
  {
    title: "Finance",
    purpose: "Revenue, costs, margins, and exportable financial information.",
    features: [
      { name: "Revenue reporting", status: "live", href: "/reporting", note: "Dashboard and reporting show revenue figures from active services." },
      { name: "Margin reporting", status: "basic", href: "/reporting", note: "Pricing and totals exist. True margin reporting needs supplier costs connected more deeply." },
      { name: "Customer profitability", status: "basic", href: "/customers", note: "Customer revenue is visible. Full profitability needs cost allocation." },
      { name: "Supplier cost tracking", status: "basic", href: "/haulier-pricing", note: "Haulier rates and purchase orders give the first cost layer." },
      { name: "Invoice exports", status: "next", note: "Not built yet." },
      { name: "Bin rental income", status: "basic", href: "/quotes", note: "Quote lines calculate rental income. Reporting can be expanded." },
      { name: "Collection income", status: "basic", href: "/quotes", note: "Quote lines calculate collection charges. Reporting can be expanded." },
      { name: "Overweight charge management", status: "next", note: "Not built yet. This needs weight capture and billing rules." },
    ],
  },
  {
    title: "Reporting & BI",
    purpose: "Dashboards, KPIs, trends, and management reporting.",
    features: [
      { name: "Dashboard", status: "live", href: "/dashboard", note: "Main CRM dashboard is live." },
      { name: "Revenue charts", status: "basic", href: "/reporting", note: "Reporting exists, but charts can be made more complete." },
      { name: "Customer growth", status: "basic", href: "/reporting", note: "Customer counts are visible. Growth trends need richer charts." },
      { name: "Waste volumes", status: "basic", href: "/reporting", note: "Waste stream service mix is visible. True weight volumes need weight capture." },
      { name: "Stream breakdowns", status: "live", href: "/dashboard", note: "Dashboard shows top waste streams with the correct stream colours." },
      { name: "Recycling performance", status: "next", note: "Not built yet. This needs stream rules and weight/recycling calculations." },
      { name: "Top customers", status: "live", href: "/dashboard", note: "Dashboard can surface top customer revenue." },
      { name: "Operational KPIs", status: "basic", href: "/jobs", note: "Overdue, failed, due, and scheduled jobs are tracked." },
      { name: "Financial KPIs", status: "basic", href: "/reporting", note: "Revenue is visible. Margin, profitability, and exports need deeper build-out." },
    ],
  },
  {
    title: "Future AI Features",
    purpose: "AI assistance, automation, compliance support, route optimisation, and insight generation.",
    features: [
      { name: "AI customer support assistant", status: "next", note: "Not built yet. Best added after customer portal and communication history are stronger." },
      { name: "AI document generation", status: "next", note: "Not built yet. Document templates should be stabilised first." },
      { name: "AI compliance monitoring", status: "next", note: "Not built yet. This needs compliance data and rules before AI can help." },
      { name: "AI route optimisation", status: "next", note: "Not built yet. This needs route planning, vehicles, drivers, and collection history." },
      { name: "AI reporting summaries", status: "next", note: "Not built yet. Reporting data should be cleaned and structured first." },
      { name: "AI-powered business insights", status: "next", note: "Not built yet. This should sit on top of finance, operations, and sales reporting." },
    ],
  },
  {
    title: "Future Recyclr Group Features",
    purpose: "Longer-term product and ERP ambitions beyond the current CRM core.",
    features: [
      { name: "RFID collection verification", status: "next", note: "Not built yet. This follows RFID bin support and driver collection tooling." },
      { name: "QR scan collection verification", status: "next", note: "Not built yet. Container QR codes exist, but scan-based collection proof is future work." },
      { name: "Public QR marketing links", status: "next", note: "Not built yet." },
      { name: "Mobile Android app", status: "next", note: "Not built yet." },
      { name: "Driver mobile app", status: "next", note: "Not built yet. This should come after the driver portal workflow is settled." },
      { name: "Customer mobile app", status: "next", note: "Not built yet. Customer portal should come first." },
      { name: "Supplier mobile app", status: "next", note: "Not built yet. Haulier portal should come first." },
      { name: "Transfer station management", status: "next", note: "Not built yet." },
      { name: "Own fleet management", status: "next", note: "Not built yet. The fleet module should come first." },
      { name: "Full waste management ERP functionality", status: "next", note: "Long-term target that brings CRM, operations, fleet, finance, compliance, portals, and reporting together." },
    ],
  },
];

export function countFeatures(status?: FeatureStatus) {
  return coreFeatureGroups.reduce((total, group) => {
    return total + group.features.filter((feature) => !status || feature.status === status).length;
  }, 0);
}
