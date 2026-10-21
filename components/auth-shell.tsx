import Link from "next/link";
import Image from "next/image";

/**
 * Shared frame for the signed-out screens (login, request access, set
 * password): brand panel on the left from lg up, form column on the right
 * with a compact logo on small screens. Both logos link home.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-zinc-950 flex-col justify-between p-12 overflow-hidden">
        {/* Tile grid pattern */}
        <div className="login-tile-grid absolute inset-0 opacity-[0.06]" />
        {/* Decorative tile squares */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[8%] left-[12%] w-[120px] h-[120px] rotate-12 opacity-[0.08] rounded-xl border border-white" />
          <div className="absolute top-[18%] left-[62%] w-[80px] h-[80px] rotate-[-8deg] opacity-[0.06] rounded-xl border border-white" />
          <div className="absolute top-[52%] left-[6%] w-[90px] h-[90px] rotate-20 opacity-[0.07] rounded-xl border border-white" />
          <div className="absolute top-[62%] left-[55%] w-[140px] h-[140px] rotate-[-15deg] opacity-[0.05] rounded-xl border border-white" />
          <div className="absolute top-[80%] left-[28%] w-[70px] h-[70px] rotate-[5deg] opacity-[0.09] rounded-xl border border-white" />
        </div>

        {/* Logo */}
        <Link
          href="/"
          aria-label="Kiln home"
          className="relative z-10 flex w-fit items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Image
            src="/logo-192.png"
            alt=""
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <p className="text-white font-bold text-lg leading-none">Kiln</p>
            <p className="text-white/40 text-xs mt-0.5">Stock Management</p>
          </div>
        </Link>

        {/* Center copy */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Ceramic inventory,
              <br />
              <span className="text-white/50">under control.</span>
            </h1>
            <p className="text-white/40 text-base leading-relaxed max-w-sm">
              Track stock levels, record sales, and manage your entire ceramic
              catalog from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              "Real-time stock",
              "Sales tracking",
              "Brand catalog",
              "Role-based access",
            ].map((f) => (
              <span
                key={f}
                className="text-xs text-white/50 border border-white/10 rounded-full px-3 py-1 bg-white/5"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative z-10 text-white/20 text-xs">
          © {new Date().getFullYear()} Kiln
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <Link
            href="/"
            aria-label="Kiln home"
            className="flex w-fit items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
          >
            <Image
              src="/logo-192.png"
              alt=""
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-bold text-lg">Kiln</span>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
