# Natural page scroll on mobile, nested scroll on desktop

**Status:** accepted

Every dashboard page (`app/(dashboard)/**`) is built on a fixed-viewport-height shell: the page root is `h-full overflow-hidden`, and each `Card` inside it is `flex-1 overflow-y-auto`, so the page itself never scrolls — only its internal panels do. This gives desktop a single-viewport app feel, but on mobile it produces stacked scroll-boxes-within-a-scroll-box (e.g. New Sale's catalog panel and transaction panel each fighting for a slice of a ~700px viewport).

Decided: below the `md` breakpoint, pages drop `h-full`/`overflow-hidden` and let cards grow to their content height, so only the outer page scrolls, matching normal mobile web behavior. At `md` and above, the existing fixed-height nested-scroll model is unchanged. This means page-shell classes are now responsive (`h-full md:h-full overflow-visible md:overflow-hidden`-style splits) rather than constant — a future contributor adding a new dashboard page must apply the same split, not just copy the old fixed-height pattern.
