# TableMind: Smarter Dining

Design a landing page for "TableMind" — an AI-powered QR ordering platform

for restaurants and cafes. This page needs to speak to TWO audiences at once:

diners (who'll experience it in-restaurant) and restaurant owners (who decide

to buy it) — but the primary CTA is aimed at restaurant owners since they're

the ones adopting the platform.

STACK: React + Tailwind CSS, fully responsive (mobile-first), single page

for now.

VISUAL DIRECTION:

- Avoid the generic "AI SaaS" look (no purple-to-blue gradient hero, no

  generic robot/circuit-board imagery, no stock photo of people high-fiving

  over a laptop)

- Lean into food/hospitality warmth combined with tech precision: think

  warm neutrals (cream, charcoal, terracotta/rust accent) rather than cold

  tech blues — this is a restaurant product, it should feel inviting, not

  clinical

- Typography: a confident, slightly editorial serif or high-contrast sans

  for headlines, paired with a clean, highly readable sans for body text —

  avoid default system fonts

- Use real interface mockups/screenshots (placeholder boxes are fine for

  now) rather than abstract illustrations, so it's clear this is a real

  working product

- Subtle motion is welcome (fade/slide on scroll) but nothing gimmicky

SECTIONS (in order):

1. HERO

   - Headline that leads with the differentiator, not the category — not

     "AI Restaurant Ordering Platform" but something closer to "Your menu,

     but it actually knows the customer" (feel free to iterate on this)

   - Subheadline: one sentence on what makes this different from a static

     QR menu — personalization, voice ordering, automatic discounts

   - Primary CTA: "Book a demo" or "See it in action"

   - Secondary CTA: "For diners" (lighter weight, maybe just a text link)

   - A phone-mockup showing the actual menu/ordering screen

2. THE PROBLEM (brief, 3 short stat-style callouts, not paragraphs)

   - Static QR menus haven't changed ordering, they've just digitized it

   - Restaurants get almost zero usable customer feedback today

   - Personalization and speed are what customers expect everywhere else

3. HOW IT WORKS (for diners) — 4-step horizontal flow

   - Scan the table QR

   - Get a menu that already knows your preferences (and keeps you safe

     from allergens)

   - Order by tap or by voice

   - Pay, then earn credits for a 10-second feedback

4. KEY FEATURES GRID (6 cards, icon + short headline + 1-line description)

   - Personalized recommendations

   - Voice ordering

   - Allergy-safe by design

   - Automatic discounts & coupons

   - Group/table-level ordering

   - Feedback-for-credits loyalty loop

5. FOR RESTAURANTS (this section should feel like the sales pitch)

   - Headline reframing value for the owner, not the diner: faster tables,

     real feedback data, kitchen-load-aware suggestions during rush

   - 3 columns: "Turn tables faster" / "Actually get feedback" / "Know

     what's working" — each backed by one concrete mechanism (e.g. kitchen

     load smoothing, per-dish rating analytics, recommendation conversion

     tracking)

   - Secondary CTA here: "Talk to us about your restaurant"

6. SOCIAL PROOF placeholder

   - Logo row placeholder ("Trusted by restaurants like...") — use

     placeholder boxes, no real logos yet

   - One large testimonial-style quote block (placeholder text)

7. FINAL CTA BAND

   - Strong closing headline, single CTA button, contrasting background

     from the rest of the page

8. FOOTER

   - Simple: logo, nav links (Product, For Restaurants, Pricing, Contact),

     social icons, copyright

Keep copy concise everywhere — this should feel confident and uncluttered,

not text-heavy. Use realistic placeholder content (not "Lorem ipsum") so it

reads naturally even before final copy is written.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/467b6fb3-193d-4354-8f7d-47422c278c27).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
