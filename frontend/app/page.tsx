import Link from "next/link";

const portalLinks = [
  { label: "Customer", href: "/customer-portal/login" },
  { label: "Haulier", href: "/haulier-portal/login" },
  { label: "Staff", href: "/login" },
];

const services = [
  "Commercial waste collections",
  "Recycling services",
  "Container supply and tracking",
  "Customer service management",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#090029] text-white">
      <section className="relative min-h-[82vh] overflow-hidden border-b border-lime-300/20 bg-[radial-gradient(circle_at_18%_12%,rgba(0,145,255,0.26),transparent_26%),linear-gradient(135deg,#060020_0%,#190064_44%,#0094d9_140%)]">
        <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-[#00a7ff] via-[#b7ff1a] to-[#55d616]" />
        <div className="absolute -bottom-24 left-0 h-56 w-full skew-y-[-4deg] bg-[#b7ff1a]/12" />
        <div className="absolute bottom-20 right-[-10%] h-32 w-[58%] skew-y-[-8deg] rounded-l-full bg-[#00a7ff]/15" />

        <header className="relative z-10 mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/recyclrcore-logo.png" alt="Recyclr Group Ltd" className="h-auto w-40 sm:w-48" />
            <span className="sr-only">Recyclr Group Ltd</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-black text-white sm:justify-end">
            <span className="rounded-md bg-white/10 px-3 py-2 text-white/90 ring-1 ring-white/15">Login</span>
            <span className="text-lime-300">|</span>
            {portalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs text-white transition hover:border-lime-300 hover:bg-lime-300 hover:text-[#090029] sm:px-4 sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1fr_420px] lg:items-center lg:pt-28">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-300">Waste and recycling services</p>
            <h1 className="mt-5 text-5xl font-black leading-tight text-white sm:text-6xl lg:text-7xl">
              Recyclr Group Ltd
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-white/85 sm:text-xl">
              Reliable commercial waste collections, recycling support, and container management for businesses that need a cleaner way to operate.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/customer-portal/login" className="rounded-md bg-lime-300 px-5 py-3 text-sm font-black text-[#090029] transition hover:bg-lime-200">
                Customer Portal
              </Link>
              <Link href="/haulier-portal/login" className="rounded-md border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white hover:text-slate-950">
                Haulier Portal
              </Link>
            </div>
          </div>

          <div className="relative rounded-lg border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="rounded-md border border-lime-300/25 bg-[#070022]/80 p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Core services</div>
              <div className="mt-5 space-y-3">
                {services.map((service) => (
                  <div key={service} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-lime-300" />
                    <span className="text-sm font-black text-white">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-10 text-slate-950 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">What we do</p>
            <h2 className="mt-3 text-3xl font-black">Waste operations with clear account support.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <div key={service} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="text-base font-black">{service}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
