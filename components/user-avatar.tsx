import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials } from "@/lib/avatar-color";

const SIZES = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-10 w-10 text-xs",
};

export function UserAvatar({
  name,
  size = "md",
  className,
}: {
  /** Name or email — used both for the initials and to seed the color. */
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = getInitials(name);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        SIZES[size],
        getAvatarColor(initials),
        className,
      )}
    >
      {initials}
    </div>
  );
}
