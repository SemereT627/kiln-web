import { cn } from "@/lib/utils";

/**
 * The overview's grid for every page: a narrow left column (page card,
 * filters, summary numbers) and a wide right column (the table or main
 * content). On wide screens it fits the window: cards keep their natural
 * height, and one that would run past the bottom shrinks and scrolls inside
 * instead of the page. Below xl the columns stack and scroll.
 */
export function PageLayout({
  aside,
  children,
  className,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 animate-in fade-in duration-500 xl:h-full xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]",
        className,
      )}
    >
      <aside className="no-scrollbar flex min-w-0 flex-col gap-4 xl:min-h-0 xl:overflow-y-auto">
        {aside}
      </aside>
      <div className="no-scrollbar flex min-w-0 flex-col gap-4 xl:min-h-0 xl:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

/** Plain white card for the left column (filters, lists, notes). */
export function AsideCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[20px] bg-card p-5", className)}>
      {title && <h2 className="mb-3 text-[15px] font-medium">{title}</h2>}
      {children}
    </section>
  );
}
