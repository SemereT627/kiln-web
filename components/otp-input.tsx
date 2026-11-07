"use client";

import { cn } from "@/lib/utils";

/**
 * 6-digit code drawn as 6 boxes over one real input, so paste, SMS/password
 * manager autofill (autoComplete="one-time-code") and screen readers all
 * behave like a normal text field.
 */
export function OtpInput({
  id,
  value,
  onChange,
  invalid = false,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="group relative">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        autoFocus={autoFocus}
        required
        aria-invalid={invalid}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      <div className="pointer-events-none grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => {
          const active = i === value.length;
          return (
            <div
              key={i}
              className={cn(
                "flex h-12 items-center justify-center rounded-lg border bg-background font-mono text-xl font-semibold transition-colors",
                invalid
                  ? "border-destructive"
                  : value[i]
                    ? "border-primary/60"
                    : active
                      ? "border-input group-focus-within:border-primary group-focus-within:ring-2 group-focus-within:ring-primary/30"
                      : "border-input",
              )}
            >
              {value[i] ??
                (active && (
                  <span className="hidden h-6 w-px animate-pulse bg-foreground group-focus-within:block" />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
