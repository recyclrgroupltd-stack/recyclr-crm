import Link from "next/link";

const portalLinks = [
  { label: "Customer", href: "/customer-portal/login" },
  { label: "Haulier", href: "/haulier-portal/login" },
  { label: "Staff", href: "/login" },
];

const signalCards = [
  { label: "Collections", value: "Tracked", tone: "blue" },
  { label: "Containers", value: "QR Ready", tone: "lime" },
  { label: "Requests", value: "Connected", tone: "navy" },
];

const serviceCards = [
  {
    title: "Commercial Waste",
    text: "Reliable waste collections for offices, retail, hospitality, industrial sites, and growing multi-site businesses.",
  },
  {
    title: "Recycling Support",
    text: "Practical recycling streams, cleaner segregation, and better visibility over what happens at each site.",
  },
  {
    title: "Smart Containers",
    text: "QR-labelled containers, lifecycle status, site allocation, stock control, and maintenance records.",
  },
  {
    title: "Live Portals",
    text: "Customers, hauliers, and staff use the right portal to keep requests, jobs, documents, and updates moving.",
  },
];

const portalCards = [
  {
    label: "Customer Portal",
    href: "/customer-portal/login",
    text: "View services, collections, documents, and send account requests.",
  },
  {
    label: "Haulier Portal",
    href: "/haulier-portal/login",
    text: "See assigned work, update collection status, and submit evidence.",
  },
  {
    label: "Staff Login",
    href: "/login",
    text: "Open the staff CRM for sales, customers, pricing, containers, and operations.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#07152d]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center">
            <img src="/recyclr-group-logo.png" alt="Recyclr Group Ltd" className="h-auto w-32 rounded-md bg-[#1f1b60] sm:w-44" />
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-2 text-sm font-black text-[#07152d]">
            <Link href="/login" className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-[#0a9ee8] hover:text-[#0a78b8]">
              Login
            </Link>
            <span className="text-slate-300">|</span>
            {portalLinks.map((item, index) => (
              <span key={item.href} className="flex items-center gap-2">
                {index > 0 ? <span className="text-slate-300">|</span> : null}
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 transition hover:bg-[#b9ff2f] hover:text-[#07152d]"
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </header>

      <section className="relative bg-white">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,168,240,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(8,168,240,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#08a8f0] via-[#b9ff2f] to-[#44c821]" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full border border-[#08a8f0]/25" />
        <div className="absolute -right-10 top-44 h-40 w-40 rounded-full border border-[#b9ff2f]/60" />

        <div className="relative mx-auto grid min-h-[76vh] max-w-7xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[#b9ff2f] bg-white px-4 py-2 text-sm font-black text-[#246500] shadow-lg shadow-lime-100">
              <span className="h-2.5 w-2.5 rounded-full bg-[#b9ff2f] shadow-[0_0_18px_#b9ff2f]" />
              Waste, recycling and connected service management
            </div>

            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-tight text-[#07152d] sm:text-6xl lg:text-7xl">
              Recycling services with a smarter digital edge.
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-600 sm:text-xl">
              Recyclr Group Ltd helps businesses manage collections, recycling, containers, service requests, and documents through a cleaner, connected way of working.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/customer-portal/login" className="rounded-md bg-[#b9ff2f] px-5 py-3 text-sm font-black text-[#07152d] shadow-lg shadow-lime-200 transition hover:-translate-y-0.5 hover:bg-[#a6f018]">
                Customer Portal
              </Link>
              <Link href="/haulier-portal/login" className="rounded-md border border-[#0a9ee8] bg-white px-5 py-3 text-sm font-black text-[#075985] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#eff9ff]">
                Haulier Portal
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-[#08a8f0]/18 via-white to-[#b9ff2f]/24 blur-2xl" />
            <div className="relative rounded-[28px] border border-slate-200 bg-white/85 p-4 shadow-2xl shadow-slate-200/80 backdrop-blur-xl">
              <div className="rounded-[22px] bg-[#07152d] p-5 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9ff2f]">Recyclr Network</p>
                    <h2 className="mt-2 text-2xl font-black">Live operations layer</h2>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black">ONLINE</div>
                </div>

                <div className="mt-6 grid gap-3">
                  {signalCards.map((card, index) => (
                    <div key={card.label} className="rounded-xl border border-white/10 bg-white/8 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white/70">{card.label}</span>
                        <span className="text-sm font-black text-white">{card.value}</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div
                          className={`h-2 rounded-full ${
                            card.tone === "lime" ? "bg-[#b9ff2f]" : card.tone === "blue" ? "bg-[#08a8f0]" : "bg-white"
                          }`}
                          style={{ width: `${72 + index * 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-[#eff9ff] p-4">
                  <p className="text-xs font-black uppercase text-[#0a78b8]">Sites</p>
                  <p className="mt-2 text-2xl font-black">Mapped</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f5ffe7] p-4">
                  <p className="text-xs font-black uppercase text-[#246500]">Bins</p>
                  <p className="mt-2 text-2xl font-black">Scanned</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Docs</p>
                  <p className="mt-2 text-2xl font-black">Signed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-slate-200 bg-[#f8fbff] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black text-[#0a78b8]">What we do</p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black text-[#07152d] sm:text-4xl">
                Practical waste services, powered by better information.
              </h2>
            </div>
            <p className="max-w-xl font-semibold leading-7 text-slate-600">
              We keep the day-to-day simple: clear collections, cleaner recycling, visible containers, and portals that make requests easier to manage.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {serviceCards.map((service) => (
              <article key={service.title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#08a8f0] hover:shadow-xl hover:shadow-sky-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#07152d] text-lg font-black text-[#b9ff2f]">
                  {service.title.slice(0, 1)}
                </div>
                <h3 className="mt-5 text-xl font-black text-[#07152d]">{service.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div>
            <p className="text-sm font-black text-[#246500]">Portal access</p>
            <h2 className="mt-2 text-3xl font-black text-[#07152d] sm:text-4xl">Three doors. One connected service.</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {portalCards.map((portal) => (
              <Link
                key={portal.href}
                href={portal.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#b9ff2f] hover:shadow-xl hover:shadow-lime-100"
              >
                <h3 className="text-lg font-black text-[#07152d]">{portal.label}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{portal.text}</p>
                <div className="mt-5 inline-flex rounded-full bg-[#eff9ff] px-3 py-2 text-sm font-black text-[#0a78b8]">
                  Open portal
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#07152d] px-5 py-7 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <img src="/recyclr-group-logo.png" alt="Recyclr Group Ltd" className="h-auto w-40 rounded-md bg-[#1f1b60]" />
          <div className="text-sm font-semibold text-white/75">Recyclr Group Ltd</div>
        </div>
      </footer>
    </main>
  );
}
