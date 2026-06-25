"use client";

import { usePathname } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type Message = {
  sender: "bot" | "visitor";
  text: string;
};

const HIDDEN_PREFIXES = [
  "/account",
  "/ai",
  "/calendar",
  "/change-log",
  "/containers",
  "/contract-signing",
  "/core-map",
  "/customer-portal",
  "/customers",
  "/dashboard",
  "/email",
  "/expenses",
  "/haulier-portal",
  "/haulier-pricing",
  "/jobs",
  "/leads",
  "/login",
  "/my-customers",
  "/personnel",
  "/pricing",
  "/purchase-orders",
  "/quote-documents",
  "/quotes",
  "/reporting",
  "/service-map",
  "/services",
  "/settings",
  "/sign",
  "/sites",
  "/staff",
];

function buildGuidedReply(input: string) {
  const text = input.toLowerCase();
  const isRestaurant = /restaurant|cafe|takeaway|pub|bar|hotel|kitchen|food/.test(text);
  const isOffice = /office|desk|admin|call centre|agency/.test(text);
  const isRetail = /shop|retail|salon|store|showroom/.test(text);
  const isIndustrial = /warehouse|factory|industrial|unit|manufacturing|garage|workshop/.test(text);

  if (isRestaurant) {
    return "For a restaurant or cafe, I would usually look at food waste, glass, mixed recycling, and general waste. To size it properly I need your postcode, rough number of covers, how many days you open, and whether you have space for 240L or 660L bins.";
  }

  if (isOffice) {
    return "For an office, the usual setup is mixed recycling plus general waste, sometimes confidential paper or cardboard depending on volume. Tell me your postcode, number of staff, and how often bins are currently filling up.";
  }

  if (isRetail) {
    return "For retail, I would usually check cardboard volume first, then general waste and mixed recycling. If there is packaging, deliveries, or customer waste, tell me roughly how many bags or boxes you produce per week.";
  }

  if (isIndustrial) {
    return "For warehouses, factories, garages, or workshops, I need to understand the material first. Tell me the waste streams, postcode, access for vehicles, and whether you need scheduled collections or ad-hoc skips/bins.";
  }

  if (/quote|price|cost|setup|start/.test(text)) {
    return "I can help work out the right service. Send your business type, postcode, waste types, estimated weekly volume, and preferred start date. A Recyclr team member can then turn that into a checked quote.";
  }

  return "Tell me what kind of business you run, your postcode, and what waste you produce. I will suggest the likely bins and what details Recyclr needs before setting up a quote.";
}

export function TheBinfluencerWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hi, I'm The Binfluencer. Tell me what business you run and I'll suggest the waste setup Recyclr should look at.",
    },
  ]);

  const hidden = useMemo(() => HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)), [pathname]);

  if (hidden) return null;

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((current) => [
      ...current,
      { sender: "visitor", text: trimmed },
      { sender: "bot", text: buildGuidedReply(trimmed) },
    ]);
    setInput("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="mb-3 flex h-[560px] max-h-[calc(100vh-110px)] w-[calc(100vw-32px)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <div className="bg-[#07152d] p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#b9ff2f]">Recyclr Group Ltd</div>
                <div className="mt-1 text-xl font-black">The Binfluencer</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/15 px-3 py-2 text-sm font-black text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-5 text-white/75">
              Quick guidance now. Full AI quote automation is being prepared for launch.
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fbff] p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.sender}-${index}`}
                className={`flex ${message.sender === "visitor" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm font-semibold leading-5 ${
                    message.sender === "visitor"
                      ? "bg-[#08a8f0] text-white"
                      : "border border-slate-200 bg-white text-[#07152d]"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Example: I run a restaurant..."
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-[#07152d] outline-none focus:border-[#08a8f0]"
              />
              <button
                type="submit"
                className="rounded-md bg-[#b9ff2f] px-4 py-3 text-sm font-black text-[#07152d] hover:bg-[#a6f018]"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex items-center gap-3 rounded-full border border-[#b9ff2f] bg-[#07152d] px-4 py-3 text-left text-white shadow-2xl shadow-slate-900/25 transition hover:-translate-y-0.5"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b9ff2f] text-lg font-black text-[#07152d]">
          B
        </span>
        <span className="hidden sm:block">
          <span className="block text-sm font-black">Ask The Binfluencer</span>
          <span className="block text-xs font-semibold text-white/70">Find the right bins</span>
        </span>
      </button>
    </div>
  );
}
