"use client";

import { cn } from "@/lib/utils";

/**
 * 6-digit code drawn as 6 boxes over one real input, so paste, SMS/password
 * manager autofill (autoComplete="one-time-code") and screen readers all
 * behave like a normal text field. Submits its form once all 6 digits are in.
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
        // No maxLength: a pasted "228 400" or "228-400" must reach the digit filter whole.
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(next);
          // Sixth digit typed or pasted: submit the form. Deferred so the
          // form's handler runs after React has the new value.
          const form = e.target.form;
          if (next.length === 6 && value.length < 6 && form) setTimeout(() => form.requestSubmit());
        }}
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
