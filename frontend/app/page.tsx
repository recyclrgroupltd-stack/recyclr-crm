import Link from "next/link";

const portalLinks = [
  { label: "Staff", href: "/login" },
  { label: "Haulier", href: "/haulier-portal/login" },
  { label: "Customer", href: "/customer-portal/login" },
];

const services = [
  "Commercial waste collections",
  "Recycling services",
  "Container supply and tracking",
  "Customer service management",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative min-h-[82vh] overflow-hidden">
        <img
          src="/recyclr-home-hero.png"
          alt="Recyclr Group recycling operations"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/65" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/recyclrcore-logo.png" alt="Recyclr Group Ltd" className="h-auto w-36 sm:w-44" />
            <span className="sr-only">Recyclr Group Ltd</span>
          </Link>

          <nav className="flex items-center gap-2">
            {portalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-slate-950 sm:px-4 sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24 lg:pt-32">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-300">Waste and recycling services</p>
            <h1 className="mt-5 text-5xl font-black leading-tight text-white sm:text-6xl lg:text-7xl">
              Recyclr Group Ltd
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-white/85 sm:text-xl">
              Reliable commercial waste collections, recycling support, and container management for businesses that need a cleaner way to operate.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/customer-portal/login" className="rounded-md bg-lime-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-lime-200">
                Customer Portal
              </Link>
              <Link href="/haulier-portal/login" className="rounded-md border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white hover:text-slate-950">
                Haulier Portal
              </Link>
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
