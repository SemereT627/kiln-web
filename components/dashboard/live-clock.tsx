"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  return (
    <div className="hidden md:flex flex-col items-end gap-0.5 text-right shrink-0">
      <p className="text-sm font-semibold tabular-nums text-foreground leading-tight">
        {now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </p>
      <p className="text-xs text-muted-foreground leading-tight">
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </div>
  );
}
