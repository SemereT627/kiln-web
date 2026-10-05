import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BarChart3, RadioTower, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: BarChart3,
    title: "Real-time stock",
    description:
      "Every restock, adjustment, and sale updates the catalog instantly — stock is always computed, never stale.",
  },
  {
    icon: Smartphone,
    title: "Offline-first mobile sales",
    description:
      "Reps record sales and orders from the floor, connection or not. Everything queues on-device and syncs the moment signal's back.",
  },
  {
    icon: RadioTower,
    title: "Order approval workflow",
    description:
      "Credit and bank-transfer orders route to an admin for review before stock ever leaves the shelf.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-full bg-background text-foreground overflow-x-hidden">
      {/* Decorative tile squares backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[8%] left-[12%] w-30 h-30 rotate-12 opacity-[0.06] dark:opacity-[0.08] rounded-xl border border-foreground" />
        <div className="absolute top-[18%] left-[74%] w-20 h-20 rotate-[-8deg] opacity-[0.05] dark:opacity-[0.06] rounded-xl border border-foreground" />
        <div className="absolute top-[52%] left-[4%] w-22.5 h-22.5 rotate-20 opacity-[0.055] dark:opacity-[0.07] rounded-xl border border-foreground" />
        <div className="absolute top-[62%] left-[80%] w-35 h-35 rotate-[-15deg] opacity-[0.04] dark:opacity-[0.05] rounded-xl border border-foreground" />
      </div>

      <div className="relative z-10 flex min-h-full flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-6 sm:px-10">
          <div className="flex items-center gap-3">
            <Image src="/logo-192.png" alt="Kiln" width={36} height={36} className="rounded-lg" />
            <div>
              <p className="font-bold text-lg leading-none">Kiln</p>
              <p className="text-muted-foreground text-xs mt-0.5">Stock Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center sm:px-10">
          <div className="max-w-2xl space-y-6">
            <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
              Ceramic inventory,
              <br />
              <span className="text-muted-foreground">under control.</span>
            </h1>
            <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Track stock levels, record sales, and manage your entire ceramic
              catalog from one place — on the web or on the floor.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/login">
                  Sign In
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">Request access</Link>
              </Button>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="mt-12 grid w-full max-w-5xl gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-6 text-left"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-8 text-center sm:px-10">
          <p className="text-xs text-muted-foreground/60">© {new Date().getFullYear()} Kiln</p>
        </footer>
      </div>
    </div>
  );
}
