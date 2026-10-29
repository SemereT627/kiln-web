import Link from "next/link";
import Image from "next/image";
import { TileBoard } from "@/components/marketing/tile-board";

/**
 * Shared frame for the signed-out screens (login, request access, set
 * password): the landing page's sample board on the left from lg up, form
 * column on the right with a compact logo on small screens. Both logos
 * link home.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left brand panel */}
      <div className="marketing relative hidden flex-col justify-between overflow-hidden border-r border-(--m-line) p-10 lg:flex lg:w-[48%] xl:p-12">
        <Link
          href="/"
          aria-label="Kiln home"
          className="relative z-10 flex w-fit items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Image src="/logo-192.png" alt="" width={30} height={30} className="rounded-md" />
          <span className="font-display text-xl font-semibold">Kiln</span>
        </Link>

        <TileBoard className="mx-auto w-full max-w-[22rem] xl:max-w-[24rem]" />

        <p className="font-display max-w-sm text-2xl leading-snug font-medium tracking-[-0.01em]">
          Every tile in your shop, counted to the square metre.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <Link
            href="/"
            aria-label="Kiln home"
            className="flex w-fit items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
          >
            <Image src="/logo-192.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-display text-lg font-semibold">Kiln</span>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
