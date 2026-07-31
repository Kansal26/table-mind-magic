import { createFileRoute } from "@tanstack/react-router";
import {
  QrCode,
  Sparkles,
  Mic,
  ShieldCheck,
  BadgePercent,
  Users,
  MessageSquareHeart,
  Timer,
  BarChart3,
  ArrowRight,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { PhoneMockup } from "@/components/landing/PhoneMockup";

const TITLE = "TableMind — QR menus that know your diners";
const DESCRIPTION =
  "TableMind turns the table QR code into a personalized, voice-ready ordering experience — allergy-safe menus, smart discounts, and real feedback data for restaurants.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const problems = [
  {
    stat: "1 in 3",
    label: "diners never re-open a static QR menu after the first scan",
    note: "Digitizing a PDF didn't change how people order.",
  },
  {
    stat: "< 2%",
    label: "of guests ever leave a review a restaurant can act on",
    note: "The kitchen is guessing which dishes actually land.",
  },
  {
    stat: "Everywhere else",
    label: "personalization is the default expectation",
    note: "Your table is the last screen that treats everyone the same.",
  },
];

const steps = [
  { icon: QrCode, title: "Scan the table QR", body: "No app, no signup wall. The table is already known." },
  {
    icon: Sparkles,
    title: "A menu that knows you",
    body: "Past orders, tastes and allergens shape what you see first.",
  },
  { icon: Mic, title: "Order by tap or voice", body: "Say it in plain language — the cart builds itself." },
  {
    icon: MessageSquareHeart,
    title: "Pay, rate, earn credits",
    body: "A 10-second rating turns into credit on the next visit.",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "Personalized recommendations",
    body: "Every guest sees the dishes they're most likely to love, first.",
  },
  { icon: Mic, title: "Voice ordering", body: "Natural-language orders, including modifiers and splits." },
  {
    icon: ShieldCheck,
    title: "Allergy-safe by design",
    body: "Flagged ingredients are filtered out before they're ever shown.",
  },
  {
    icon: BadgePercent,
    title: "Automatic discounts",
    body: "Coupons and credits apply themselves at the right moment.",
  },
  { icon: Users, title: "Group ordering", body: "One table, many phones, a single synced cart and bill." },
  {
    icon: MessageSquareHeart,
    title: "Feedback-for-credits loop",
    body: "Guests rate dishes for credit — you get data every service.",
  },
];

const ownerPillars = [
  {
    icon: Timer,
    title: "Turn tables faster",
    body: "Kitchen-load smoothing nudges guests toward dishes the pass can fire now, cutting ticket times during rush.",
  },
  {
    icon: MessageSquareHeart,
    title: "Actually get feedback",
    body: "Per-dish ratings collected at payment — hundreds of responses a week instead of a handful of reviews.",
  },
  {
    icon: BarChart3,
    title: "Know what's working",
    body: "Recommendation conversion tracking shows which suggestions sell, and which dishes quietly cost you margin.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:flex sm:justify-between">
          <a href="#top" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary">
              <QrCode className="size-4 text-primary-foreground" />
            </span>
            <span className="truncate font-display text-lg font-semibold tracking-tight">TableMind</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#restaurants" className="transition-colors hover:text-foreground">
              For restaurants
            </a>
          </nav>
          <a
            href="#demo"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-primary"
          >
            Book a demo
          </a>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="bg-warm">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              AI ordering for restaurants & cafés
            </p>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your menu, but it actually knows the customer.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              TableMind replaces the static QR PDF with a menu that remembers tastes, hides allergens, takes
              voice orders and applies the right discount on its own.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-deep"
              >
                Book a demo <ArrowRight className="size-4" />
              </a>
              <a
                href="#how"
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                For diners →
              </a>
            </div>
            <p className="mt-8 text-xs text-muted-foreground">
              Live in 40+ dining rooms · No app download for guests
            </p>
          </Reveal>
          <Reveal delay={120}>
            <PhoneMockup />
          </Reveal>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            QR menus digitized ordering. They never improved it.
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {problems.map((p, i) => (
            <Reveal as="li" key={p.stat} delay={i * 90}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-soft">
                <p className="font-display text-3xl font-semibold text-primary">{p.stat}</p>
                <p className="mt-3 text-sm font-semibold">{p.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-y border-border bg-muted/50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">For diners</p>
            <h2 className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Four steps, start to plate.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 90} className="relative">
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent">
                      <s.icon className="size-5 text-primary" />
                    </span>
                    <span className="font-display text-sm font-semibold text-muted-foreground">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Everything the table needs, in one scan.
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal as="li" key={f.title} delay={(i % 3) * 80}>
              <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-soft">
                <span className="grid size-10 place-items-center rounded-xl bg-accent">
                  <f.icon className="size-5 text-primary" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* FOR RESTAURANTS */}
      <section id="restaurants" className="border-y border-border bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <Reveal>
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                For restaurants
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
                Faster tables, honest feedback, and a kitchen that never gets buried.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-secondary-foreground/70 sm:text-base">
                TableMind reads live kitchen load and guest history at the same time, so what gets
                recommended is both what the diner wants and what your pass can actually deliver.
              </p>
              <a
                href="#demo"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-deep"
              >
                Talk to us about your restaurant <ArrowRight className="size-4" />
              </a>
            </Reveal>
            <Reveal delay={120}>
              {/* dashboard mockup */}
              <div className="rounded-2xl border border-secondary-foreground/15 bg-secondary-foreground/[0.04] p-4 shadow-lift">
                <div className="flex items-center gap-2 pb-3">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="text-xs font-semibold tracking-wide text-secondary-foreground/60">
                    Service dashboard · Friday 20:15
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { k: "Avg. table time", v: "48m", d: "-11m" },
                    { k: "Ratings tonight", v: "126", d: "+38%" },
                    { k: "Rec. conversion", v: "31%", d: "+6pt" },
                  ].map((m) => (
                    <div key={m.k} className="rounded-xl bg-background/95 p-3 text-foreground">
                      <p className="text-[11px] text-muted-foreground">{m.k}</p>
                      <p className="mt-1 font-display text-xl font-semibold">{m.v}</p>
                      <p className="text-[11px] font-semibold text-olive">{m.d}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 rounded-xl bg-background/95 p-4">
                  {[
                    ["Harissa cauliflower", "92%", "w-[92%]"],
                    ["Lamb flatbread", "78%", "w-[78%]"],
                    ["Saffron risotto", "54%", "w-[54%]"],
                  ].map(([name, pct, w]) => (
                    <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{name}</p>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                          <div className={`h-1.5 rounded-full bg-primary ${w}`} />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <ul className="mt-14 grid gap-5 sm:grid-cols-3">
            {ownerPillars.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-secondary-foreground/12 bg-secondary-foreground/[0.04] p-6">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/15">
                    <p.icon className="size-5 text-primary" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-foreground/70">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <Reveal className="text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Trusted by restaurants like...
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg border border-dashed border-border bg-muted/60"
                aria-hidden
              />
            ))}
          </div>
        </Reveal>
        <Reveal delay={120} className="mx-auto mt-14 max-w-3xl">
          <blockquote className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft sm:p-12">
            <p className="font-display text-2xl leading-snug font-semibold text-balance sm:text-3xl">
              “We stopped guessing. Within a month we knew which six dishes were carrying the menu — and our
              Friday covers went up without adding a single seat.”
            </p>
            <footer className="mt-6 flex items-center justify-center gap-3">
              <span className="size-10 rounded-full bg-muted" aria-hidden />
              <span className="text-left text-sm">
                <span className="block font-semibold">Placeholder Name</span>
                <span className="block text-muted-foreground">Owner, Placeholder Kitchen</span>
              </span>
            </footer>
          </blockquote>
        </Reveal>
      </section>

      {/* FINAL CTA */}
      <section id="demo" className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <Reveal>
            <h2 className="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
              Give every table a menu that pays attention.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
              See TableMind running on your own menu in a 20-minute walkthrough.
            </p>
            <a
              href="#demo"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-secondary px-7 py-3.5 text-sm font-semibold text-secondary-foreground transition-transform hover:-translate-y-0.5"
            >
              Book a demo <ArrowRight className="size-4" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary">
              <QrCode className="size-4 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-semibold">TableMind</span>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">
              Product
            </a>
            <a href="#restaurants" className="hover:text-foreground">
              For Restaurants
            </a>
            <a href="#demo" className="hover:text-foreground">
              Pricing
            </a>
            <a href="#demo" className="hover:text-foreground">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#top" aria-label="TableMind on Instagram" className="hover:text-foreground">
              <Instagram className="size-5" />
            </a>
            <a href="#top" aria-label="TableMind on X" className="hover:text-foreground">
              <Twitter className="size-5" />
            </a>
            <a href="#top" aria-label="TableMind on LinkedIn" className="hover:text-foreground">
              <Linkedin className="size-5" />
            </a>
          </div>
        </div>
        <p className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TableMind. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
