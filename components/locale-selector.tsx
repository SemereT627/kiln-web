"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser, useUserActions } from "@/components/user-provider";

const locales = [
  { value: "en-US", label: "English" },
  { value: "am-ET", label: "አማርኛ" },
];

export function LocaleSelector({ className }: { className?: string }) {
  const user = useUser();
  const { updateLocale } = useUserActions();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Select locale"
          className={className}
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={user.locale}
          onValueChange={updateLocale}
        >
          {locales.map((locale) => (
            <DropdownMenuRadioItem
              key={locale.value}
              value={locale.value}
              className="whitespace-nowrap"
            >
              {locale.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
