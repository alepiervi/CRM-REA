import React, { useEffect, useState } from "react";
import {
  Plane,
  Ship,
  Train,
  Bus,
  Bell,
  Search,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Clock,
  ArrowLeftRight,
  BadgePercent,
  Euro,
  Users,
  Star,
  Check,
  AlertTriangle,
  CalendarDays,
  MapPin,
  SlidersHorizontal,
  ExternalLink,
  Ticket,
  Wallet,
} from "lucide-react";

// ---------------------------------------------
// Minimal shadcn-like primitives (fallback if not present)
// ---------------------------------------------
const Btn = ({ className = "", children, ...props }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm hover:shadow-md transition ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Chip = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-gray-600 bg-white/70 backdrop-blur">
    {children}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border bg-white/70 backdrop-blur p-5 shadow-sm hover:shadow-md transition ${className}`}>{children}</div>
);

const Tag = ({ children, tone = "emerald" }) => (
  <span className={`text-xs font-medium rounded-full px-2 py-0.5 bg-${tone}-50 text-${tone}-700`}>{children}</span>
);

// Segmented control
function Seg({ value, onChange, options = [] }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-white p-1 w-full md:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs rounded-lg transition ${
            value === o.value ? "bg-sky-600 text-white" : "hover:bg-gray-50"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">{o.icon}{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------
// Mock data
// ---------------------------------------------
const deals = [
  { id: 1, title: "Weekend a Santorini", subtitle: "3 notti · volo da Roma", price: 199, was: 349, badge: "-43%", type: "pacchetto", meta: ["Set 20-23", "Solo 6 rimasti"] },
  { id: 2, title: "Ryanair: Roma → Porto", subtitle: "Solo andata domani", price: 24, was: 79, badge: "Flash", type: "volo", meta: ["Partenza 06:20", "Bagaglio piccolo"] },
  { id: 3, title: "Costa Toscana", subtitle: "Crociera 7 notti · balcone", price: 449, was: 799, badge: "Last minute", type: "crociera", meta: ["Imbarco Savona", "Set 28"] },
  { id: 4, title: "Weekend a Napoli", subtitle: "Treno A/R + B&B", price: 119, was: 189, badge: "-37%", type: "pacchetto", meta: ["Da Milano", "Ott 4-6"] },
];

const resaleListings = [
  { id: "L-1001", title: "PNR FR 1234 – Roma ⇄ Barcellona", supplier: "Ryanair", type: "volo", price: 58, transferability: true, deadline: "entro 24h", changeFee: 55 },
  { id: "L-1002", title: "Pacchetto 2 notti – Venezia Boutique Hotel", supplier: "Agenzia X", type: "pacchetto", price: 210, transferability: true, deadline: "entro 7 gg", changeFee: 0 },
  { id: "L-1003", title: "Costa Smeralda – cabina interna", supplier: "Costa Crociere", type: "crociera", price: 389, transferability: true, deadline: "entro 72h", changeFee: 25 },
  { id: "L-1004", title: "ITA AZ 567 – Milano → Palermo", supplier: "ITA Airways", type: "volo", price: 75, transferability: false, deadline: null, changeFee: null },
];

// ---------------------------------------------
// Dev test suite
// ---------------------------------------------
function DevTests({ currentTab }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const icons = { Plane, Ship, Train, Bus, Bell, Search, ShieldCheck, ArrowRight, Sparkles, Clock, ArrowLeftRight, BadgePercent, Euro, Users, Star, Check, AlertTriangle, CalendarDays, MapPin, SlidersHorizontal, ExternalLink, Ticket, Wallet };
    const required = Object.keys(icons);
    const missing = required.filter((k) => !icons[k]);

    const dealsSchemaOK = deals.every((d) => ["id", "title", "subtitle", "price", "was", "badge", "type", "meta"].every((k) => k in d));
    const resaleSchemaOK = resaleListings.every((l) => ["id", "title", "supplier", "type", "price", "transferability"].every((k) => k in l));

    const tests = [
      { name: "Icons available (lucide-react)", pass: missing.length === 0, message: missing.length ? `Missing: ${missing.join(", ")}` : "All good" },
      { name: "Deals dataset schema", pass: dealsSchemaOK, message: dealsSchemaOK ? "OK" : "Fields missing" },
      { name: "Resale dataset schema", pass: resaleSchemaOK, message: resaleSchemaOK ? "OK" : "Fields missing" },
      { name: "Default tab is 'scanner'", pass: currentTab === "scanner", message: `currentTab=${currentTab}` },
      { name: "Has resale non-transferable case", pass: resaleListings.some((l) => l.transferability === false), message: "Includes blocked listing" },
    ];

    setResults(tests);
    try { console.table(tests.map((t) => ({ Test: t.name, Pass: t.pass, Info: t.message }))); } catch {}
  }, [currentTab]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border bg-white/70 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold">Dev Tests</span>
          <Tag>auto</Tag>
        </div>
        <ul className="space-y-2 text-sm">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              {r.pass ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              <span className="font-medium">{r.name}:</span>
              <span className={r.pass ? "text-gray-600" : "text-amber-700"}>{r.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Homepage() {
  const [tab, setTab] = useState("scanner");
  const [searchType, setSearchType] = useState("tutto");

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-50 via-white to-emerald-50 text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/60 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-sky-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-extrabold tracking-tight">LastMinuteHub</span>
            <div className="hidden md:flex items-center gap-2 ml-4">
              <Chip><Plane className="h-3 w-3"/>Voli</Chip>
              <Chip><Ship className="h-3 w-3"/>Crociere</Chip>
              <Chip><Train className="h-3 w-3"/>Treni</Chip>
              <Chip><Bus className="h-3 w-3"/>Bus</Chip>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn className="bg-white border hover:bg-gray-50">Accedi</Btn>
            <Btn className="bg-sky-600 text-white hover:bg-sky-700">Crea account</Btn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 border text-xs mb-4">
                <BadgePercent className="h-4 w-4 text-emerald-600"/>
                Fino al <b>70%</b> in meno con offerte last second
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
                Trova le <span className="text-sky-700">offerte last minute</span>.
                Rivendi i <span className="text-emerald-700">viaggi che non usi</span>.
              </h1>
              <p className="mt-4 text-gray-600 max-w-xl">
                Uno scanner multi-piattaforma per voli, hotel, treni, crociere + un marketplace C2C sicuro con escrow.
              </p>

              {/* BEAUTIFIED Search Bar */}
              <div className="mt-6 rounded-3xl border bg-white/80 backdrop-blur p-4 shadow-lg">
                <div className="flex flex-col gap-3">
                  <Seg
                    value={searchType}
                    onChange={setSearchType}
                    options={[
                      { value: "tutto", label: "Tutto", icon: <SlidersHorizontal className="h-3.5 w-3.5"/> },
                      { value: "voli", label: "Voli", icon: <Plane className="h-3.5 w-3.5"/> },
                      { value: "pacchetti", label: "Pacchetti", icon: <Ticket className="h-3.5 w-3.5"/> },
                      { value: "treni", label: "Treni", icon: <Train className="h-3.5 w-3.5"/> },
                      { value: "crociere", label: "Crociere", icon: <Ship className="h-3.5 w-3.5"/> },
                    ]}
                  />

                  <div className="grid md:grid-cols-12 gap-2">
                    <div className="md:col-span-5 relative">
                      <MapPin className="h-4 w-4 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2"/>
                      <input className="w-full rounded-xl border pl-9 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Dove vuoi andare? (es. Santorini)"/>
                    </div>
                    <div className="md:col-span-3 relative">
                      <Plane className="h-4 w-4 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2"/>
                      <input className="w-full rounded-xl border pl-9 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Da (es. Roma)"/>
                    </div>
                    <div className="md:col-span-3 relative">
                      <CalendarDays className="h-4 w-4 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2"/>
                      <input className="w-full rounded-xl border pl-9 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Date"/>
                    </div>
                    <div className="md:col-span-1">
                      <Btn className="bg-sky-600 text-white hover:bg-sky-700 w-full h-full justify-center"><Search className="h-4 w-4"/> Cerca</Btn>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>Trending:</span>
                    <Chip><Clock className="h-3 w-3"/> Domani</Chip>
                    <Chip><Euro className="h-3 w-3"/> &lt; 200€</Chip>
                    <Chip>City break</Chip>
                    <Chip>Oktoberfest</Chip>
                  </div>
                </div>
              </div>

              {/* Trust row */}
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600"/>Escrow sicuro</div>
                <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-sky-600"/>Alert prezzo</div>
                <div className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-amber-600"/>Cessione pacchetti</div>
              </div>
            </div>

            {/* Illustration */}
            <div className="relative">
              <div className="aspect-[4/3] w-full rounded-3xl bg-gradient-to-br from-sky-100 via-white to-emerald-50 border shadow-inner overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-2 gap-3 p-4">
                  {deals.map((d) => (
                    <Card key={d.id}>
                      <div className="flex items-center justify-between">
                        <Tag>{d.badge}</Tag>
                        <span className="text-xs text-gray-500 capitalize">{d.type}</span>
                      </div>
                      <h3 className="mt-2 font-semibold">{d.title}</h3>
                      <p className="text-sm text-gray-500">{d.subtitle}</p>
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-2xl font-extrabold">€{d.price}</span>
                        <span className="text-xs line-through text-gray-400">€{d.was}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {d.meta.map((m, i) => (<Chip key={i}>{m}</Chip>))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs: Scanner vs Marketplace */}
      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="rounded-2xl border bg-white p-2 flex items-center w-full md:w-auto gap-2">
          <Btn onClick={() => setTab("scanner")} className={`${tab === "scanner" ? "bg-sky-600 text-white" : "bg-white border"}`}>🔎 Scanner offerte</Btn>
          <Btn onClick={() => setTab("marketplace")} className={`${tab === "marketplace" ? "bg-emerald-600 text-white" : "bg-white border"}`}>🤝 Marketplace C2C</Btn>
        </div>
      </section>

      {tab === "scanner" ? (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {deals.map((d) => (
              <Card key={d.id}>
                <div className="flex items-center justify-between">
                  <Tag>{d.badge}</Tag>
                  <span className="text-xs text-gray-500 capitalize">{d.type}</span>
                </div>
                <h3 className="mt-2 font-semibold">{d.title}</h3>
                <p className="text-sm text-gray-500">{d.subtitle}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-2xl font-extrabold">€{d.price}</span>
                  <span className="text-xs line-through text-gray-400">€{d.was}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.meta.map((m, i) => (<Chip key={i}>{m}</Chip>))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Btn className="bg-sky-600 text-white hover:bg-sky-700 w-full">Vedi offerta</Btn>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <Card className="lg:col-span-2">
              <h3 className="text-lg font-bold flex items-center gap-2">Vendi un viaggio non utilizzabile <ArrowRight className="h-4 w-4"/></h3>
              <p className="text-gray-600 mt-1">Carica PNR/voucher: verifichiamo se è trasferibile, stimiamo eventuali costi (cambio nome/cessione) e lo pubblichiamo in sicurezza.</p>
              <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
                <Card className="bg-white/60"><div className="font-semibold">1) Inserisci dettagli</div><p className="text-gray-600">Numero prenotazione, fornitore, date</p></Card>
                <Card className="bg-white/60"><div className="font-semibold">2) Verifica trasferibilità</div><p className="text-gray-600">Regole compagnia / tour operator</p></Card>
                <Card className="bg-white/60"><div className="font-semibold">3) Incassa</div><p className="text-gray-600">Pagamento in escrow, payout post-partenza</p></Card>
              </div>
              <div className="mt-5 flex gap-2">
                <Btn className="bg-emerald-600 text-white hover:bg-emerald-700">Pubblica annuncio</Btn>
                <Btn className="bg-white border">Regole trasferibilità</Btn>
              </div>
            </Card>
            <Card>
              <h4 className="font-bold">Commissioni</h4>
              <div className="mt-2 flex items-center gap-2 text-emerald-700">
                <span className="text-3xl font-extrabold">3%</span>
                <span className="text-sm">per ogni vendita andata a buon fine</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-gray-700 list-disc pl-5">
                <li>Escrow con Stripe Connect</li>
                <li>Protezione acquirente e venditore</li>
                <li>Payout automatico dopo partenza/check-in</li>
              </ul>
            </Card>
          </div>
        </section>
      )}

      {/* 🔁 Rivendite recenti (SEZIONE RICHIESTA) */}
      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-extrabold">Rivendite recenti</h3>
          <Btn className="bg-white border">Vedi tutte <ExternalLink className="h-4 w-4"/></Btn>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {resaleListings.map((l) => (
            <Card key={l.id}>
              <div className="flex items-center justify-between">
                <Tag tone={l.transferability ? "emerald" : "amber"}>{l.transferability ? "Trasferibile" : "Non trasferibile"}</Tag>
                <span className="text-xs text-gray-500">{l.supplier}</span>
              </div>
              <h4 className="mt-2 font-semibold">{l.title}</h4>
              <p className="text-sm text-gray-500 capitalize">{l.type}</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-xl font-extrabold">€{l.price}</span>
                {l.changeFee != null && <span className="text-xs text-gray-500">+ fee cambio €{l.changeFee}</span>}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <Wallet className="h-3.5 w-3.5"/>
                {l.transferability ? <span>Escrow attivo{l.deadline ? ` · ${l.deadline}` : ""}</span> : <span>Rivendita bloccata (no cambio nome)</span>}
              </div>
              <div className="mt-4 flex gap-2">
                <Btn className={`w-full ${l.transferability ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-100 text-gray-500 cursor-not-allowed"}`} disabled={!l.transferability}>
                  {l.transferability ? "Acquista" : "Non trasferibile"}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Alerts */}
      <section className="bg-gradient-to-br from-sky-50 to-emerald-50 border-y">
        <div className="mx-auto max-w-7xl px-4 py-10 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl font-extrabold">Attiva gli alert prezzo</h3>
            <p className="text-gray-600 mt-1">Ricevi una notifica appena scoviamo un affare che corrisponde ai tuoi criteri.</p>
            <div className="mt-4 flex gap-2">
              <input className="flex-1 rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Email"/>
              <Btn className="bg-sky-600 text-white hover:bg-sky-700"><Bell className="h-4 w-4"/> Attiva alert</Btn>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card><div className="font-bold">+120k</div><div className="text-sm text-gray-600">offerte scansionate/giorno</div></Card>
            <Card><div className="font-bold">98,7%</div><div className="text-sm text-gray-600">tasso successo cessioni</div></Card>
            <Card><div className="font-bold">4.8/5</div><div className="text-sm text-gray-600">rating utenti</div></Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h3 className="text-2xl font-extrabold text-center">Come funziona</h3>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-sky-700"/>
              <div className="font-semibold">Scanner intelligente</div>
            </div>
            <p className="text-gray-600 mt-2 text-sm">Aggrega offerte da più piattaforme italiane ed europee, normalizza i dati e rimuove i duplicati.</p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5 text-amber-600"/>
              <div className="font-semibold">Rivendi in sicurezza</div>
            </div>
            <p className="text-gray-600 mt-2 text-sm">Verifica di trasferibilità, escrow e guida al cambio nome/cessione pacchetto.</p>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-700"/>
              <div className="font-semibold">Pagamenti protetti</div>
            </div>
            <p className="text-gray-600 mt-2 text-sm">Stripe Connect, SCA/PSD2 e payout automatico (commissione piattaforma 3%).</p>
          </Card>
        </div>
      </section>

      {/* Dev tests panel */}
      <DevTests currentTab={tab} />

      {/* Footer */}
      <footer className="border-t bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="font-extrabold">LastMinuteHub</div>
            <p className="text-gray-600 mt-2">Scanner offerte & marketplace C2C per il mercato italiano.</p>
            <div className="mt-3 flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4"/> Community Telegram
            </div>
          </div>
          <div>
            <div className="font-semibold">Prodotto</div>
            <ul className="mt-2 space-y-2 text-gray-600">
              <li>Scanner</li>
              <li>Marketplace</li>
              <li>Alert Prezzo</li>
              <li>Affiliazioni</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Supporto</div>
            <ul className="mt-2 space-y-2 text-gray-600">
              <li>Centro assistenza</li>
              <li>Regole trasferibilità</li>
              <li>Termini & Privacy</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Contatti</div>
            <ul className="mt-2 space-y-2 text-gray-600">
              <li>Email: hello@lasthub.it</li>
              <li>Partnership & PR</li>
              <li>Lavora con noi</li>
            </ul>
          </div>
        </div>
        <div className="text-xs text-gray-500 text-center pb-6">© {new Date().getFullYear()} LastMinuteHub · Made for Italy</div>
      </footer>
    </div>
  );
}
