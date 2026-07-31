import { Mic, Sparkles, ShieldCheck } from "lucide-react";

export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[320px]">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-accent/60 blur-2xl" aria-hidden />
      <div className="rounded-[2.5rem] border border-border bg-secondary p-2.5 shadow-lift">
        <div className="overflow-hidden rounded-[2rem] bg-card">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground">
            <span>9:41</span>
            <span className="h-1.5 w-16 rounded-full bg-muted" />
            <span>Table 12</span>
          </div>

          <div className="space-y-3 px-4 pb-4">
            <div className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <p className="text-[11px] leading-snug text-accent-foreground">
                Welcome back, Mara — no peanuts, extra spice. Got it.
              </p>
            </div>

            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Picked for you
            </p>

            {[
              { name: "Charred harissa cauliflower", meta: "Ready in 8 min", price: "$14" },
              { name: "Smoked lamb flatbread", meta: "Chef's pick tonight", price: "$19" },
            ].map((dish) => (
              <div
                key={dish.name}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5"
              >
                <div className="size-12 shrink-0 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{dish.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3 text-olive" /> {dish.meta}
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">{dish.price}</span>
              </div>
            ))}

            <div className="rounded-xl border border-dashed border-border p-2.5">
              <div className="mb-2 h-2 w-2/3 rounded bg-muted" />
              <div className="h-2 w-1/2 rounded bg-muted" />
            </div>

            <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary">
                <Mic className="size-3.5 text-primary-foreground" />
              </span>
              <span className="text-[11px] text-secondary-foreground/80">
                “Two flatbreads, one without garlic”
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}