import Link from "next/link";

const portalLinks = [
  { label: "Customer", href: "/customer-portal/login" },
  { label: "Haulier", href: "/haulier-portal/login" },
  { label: "Staff", href: "/login" },
];

const serviceCards = [
  {
    title: "Commercial Waste",
    text: "Reliable collections for offices, retail, hospitality, industrial sites, and multi-site businesses.",
  },
  {
    title: "Recycling Support",
    text: "Clear recycling streams, better segregation, and practical help to reduce waste going to landfill.",
  },
  {
    title: "Container Management",
    text: "Tracked bins, site allocation, QR labels, lifecycle status, and stock visibility through Recyclr systems.",
  },
  {
    title: "Customer Operations",
    text: "Requests, service changes, documents, collections, and account support managed in one place.",
  },
];

const portalCards = [
  {
    label: "Customer Portal",
    href: "/customer-portal/login",
    text: "View services, requests, collections, documents, and account updates.",
  },
  {
    label: "Haulier Portal",
    href: "/haulier-portal/login",
    text: "Manage assigned jobs, updates, and operational work with Recyclr.",
  },
  {
    label: "Staff Login",
    href: "/login",
    text: "Access the staff CRM for sales, customers, containers, pricing, and operations.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#07152d]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center">
            <img src="/recyclr-group-logo.png" alt="Recyclr Group Ltd" className="h-auto w-40 sm:w-52" />
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-2 text-sm font-black text-[#07152d]">
            <Link href="/login" className="rounded-md border border-slate-200 px-3 py-2 transition hover:border-[#0a9ee8] hover:text-[#0a78b8]">
              Login
            </Link>
            <span className="text-slate-300">|</span>
            {portalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 transition hover:bg-[#b9ff2f] hover:text-[#07152d]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#08a8f0] via-[#b9ff2f] to-[#44c821]" />

        <div className="mx-auto grid min-h-[72vh] max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-[#b9ff2f] bg-[#f5ffe7] px-3 py-2 text-sm font-black text-[#246500]">
              Waste, recycling and container services
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight text-[#07152d] sm:text-6xl lg:text-7xl">
              Cleaner commercial waste support, built around your business.
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-650 sm:text-xl">
              Recyclr Group Ltd helps businesses manage collections, recycling, containers, documents, and service requests with a simple connected portal for customers, hauliers, and staff.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/customer-portal/login" className="rounded-md bg-[#b9ff2f] px-5 py-3 text-sm font-black text-[#07152d] shadow-sm transition hover:bg-[#a6f018]">
                Customer Portal
              </Link>
              <Link href="/haulier-portal/login" className="rounded-md border border-[#0a9ee8] px-5 py-3 text-sm font-black text-[#075985] transition hover:bg-[#e8f8ff]">
                Haulier Portal
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-4 top-8 hidden h-[82%] w-2 rounded-md bg-[#b9ff2f] sm:block" />
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80">
              <div className="rounded-md bg-[#07152d] p-5 text-white">
                <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
                  <div>
                    <p className="text-sm font-black text-[#b9ff2f]">Recyclr Group Ltd</p>
                    <h2 className="mt-1 text-2xl font-black">Live service visibility</h2>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2 text-sm font-black text-[#07152d]">24/7</div>
                </div>

                <div className="mt-5 grid gap-3">
                  {["Collections tracked", "Customer requests logged", "Containers QR managed", "Documents kept together"].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-md border border-white/10 bg-white/8 px-4 py-3">
                      <span className="font-bold">{item}</span>
                      <span className="h-3 w-3 rounded-sm bg-[#b9ff2f]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md bg-[#eff9ff] p-4">
                  <div className="text-2xl font-black text-[#0a78b8]">CRM</div>
                  <div className="mt-1 text-xs font-bold text-slate-600">Connected</div>
                </div>
                <div className="rounded-md bg-[#f5ffe7] p-4">
                  <div className="text-2xl font-black text-[#246500]">QR</div>
                  <div className="mt-1 text-xs font-bold text-slate-600">Tracked</div>
                </div>
                <div className="rounded-md bg-slate-50 p-4">
                  <div className="text-2xl font-black text-[#07152d]">UK</div>
                  <div className="mt-1 text-xs font-bold text-slate-600">Support</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black text-[#0a78b8]">What we do</p>
              <h2 className="mt-2 text-3xl font-black text-[#07152d] sm:text-4xl">Practical waste services with proper account control.</h2>
            </div>
            <p className="max-w-lg font-semibold leading-7 text-slate-600">
              Clear service management for businesses that need collections handled properly and information easy to find.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {serviceCards.map((service) => (
              <article key={service.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-1.5 w-16 rounded-sm bg-[#b9ff2f]" />
                <h3 className="mt-5 text-xl font-black text-[#07152d]">{service.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-black text-[#246500]">Portal access</p>
            <h2 className="mt-2 text-3xl font-black text-[#07152d] sm:text-4xl">The right portal for the right job.</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {portalCards.map((portal) => (
              <Link
                key={portal.href}
                href={portal.href}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0a9ee8] hover:shadow-lg"
              >
                <h3 className="text-lg font-black text-[#07152d]">{portal.label}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{portal.text}</p>
                <div className="mt-5 text-sm font-black text-[#0a78b8]">Open portal</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#07152d] px-5 py-7 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <img src="/recyclr-group-logo.png" alt="Recyclr Group Ltd" className="h-auto w-36 rounded bg-white p-2" />
          <div className="text-sm font-semibold text-white/75">Recyclr Group Ltd</div>
        </div>
      </footer>
    </main>
  );
}
