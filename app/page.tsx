import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { TileBoard } from "@/components/marketing/tile-board";

// What the shop actually does with Kiln, in the order a day runs.
const workflows = [
  {
    title: "Stock that adds itself up",
    body: "Restocks, adjustments, returns and sales each move the count. Nobody types a stock number, so the figure on screen is the one on the shelf.",
  },
  {
    title: "Sales from the floor, signal or not",
    body: "Sellers record sales and orders on their phone beside the customer. If the connection drops, they keep working and it syncs when it's back.",
  },
  {
    title: "Credit you can follow up",
    body: "Credit and bank-transfer orders wait for an admin before stock is taken off. Unpaid credit stays on the list until the money arrives.",
  },
  {
    title: "Returns that don't rewrite history",
    body: "Take back part of an order and the tiles go back into stock. The original sale stays as it was, so the books still match.",
  },
];

const localFit = [
  { title: "Priced in birr", body: "Prices, totals and outstanding credit in ETB." },
  {
    title: "Both calendars",
    body: "Ethiopian dates shown beside Gregorian, and sales importable by Ethiopian date.",
  },
  { title: "Amharic and English", body: "Each person picks their language." },
  {
    title: "The right unit for each product",
    body: "Square metres for tiles, metres for skirting, pieces for the rest.",
  },
];

export default function LandingPage() {
  return (
    <div className="marketing min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Image src="/logo-192.png" alt="" width={30} height={30} className="rounded-md" />
          <span className="font-display text-xl font-semibold">Kiln</span>
        </Link>
        <nav className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero — the headline beside a sample board, the way tiles are
            actually shown in a shop. */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-8 pb-20 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pt-14 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="font-display text-[2.75rem] leading-[1.02] font-medium tracking-[-0.02em] text-balance sm:text-6xl lg:text-[4.25rem]">
              Every tile in your shop, counted to the square metre.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-(--m-muted)">
              Kiln keeps stock, sales and credit for ceramic tile shops in one
              place. Your counter staff use it on the web, your sellers use it
              on their phones, and the numbers always agree.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/signup">Request access</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-11 px-5">
                <Link href="/login">Sign in to your shop</Link>
              </Button>
            </div>
          </div>

          <TileBoard className="mx-auto w-full max-w-[26rem] lg:max-w-none" />
        </section>

        {/* Workflows — grout-line rules between rows, heading left / text right */}
        <section className="border-t border-(--m-line)">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <h2 className="font-display max-w-lg text-3xl leading-tight font-medium tracking-[-0.015em] sm:text-4xl">
              How a tile shop runs on Kiln
            </h2>
            <dl className="mt-12 divide-y divide-(--m-line) border-y border-(--m-line)">
              {workflows.map((w) => (
                <div
                  key={w.title}
                  className="grid gap-2 py-7 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10"
                >
                  <dt className="font-display text-xl leading-snug font-medium">
                    {w.title}
                  </dt>
                  <dd className="max-w-[38rem] text-base leading-relaxed text-(--m-muted)">
                    {w.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Local fit — what makes it right for shops in Ethiopia */}
        <section className="border-t border-(--m-line)">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:py-24">
            <h2 className="font-display max-w-sm text-3xl leading-tight font-medium tracking-[-0.015em] sm:text-4xl">
              Made for how tile shops work in Ethiopia
            </h2>
            <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {localFit.map((f) => (
                <li key={f.title} className="border-t-2 border-(--m-glaze) pt-4">
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-1.5 leading-relaxed text-(--m-muted)">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-(--m-line)">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-20 sm:px-8 md:flex-row md:items-end md:justify-between lg:py-24">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl leading-tight font-medium tracking-[-0.015em] sm:text-4xl">
                Bring your shop onto Kiln
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-(--m-muted)">
                Send a request with your name and shop, and we&apos;ll set up
                your catalog and accounts with you.
              </p>
            </div>
            <Button asChild size="lg" className="h-11 shrink-0 px-6">
              <Link href="/signup">Request access</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--m-line)">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-sm text-(--m-muted) sm:px-8">
          <p>© {new Date().getFullYear()} Kiln</p>
          <Link href="/login" className="hover:text-(--m-ink) hover:underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
