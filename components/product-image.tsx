"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: "sm" | "md" | "lg";
  sizes?: string;
}

export function ProductImage({
  src,
  alt,
  className,
  iconSize = "md",
  sizes = "100px",
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const iconClass = iconSize === "sm" ? "h-4 w-4" : iconSize === "lg" ? "h-12 w-12" : "h-6 w-6";

  if (!src || error) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <ImageIcon className={cn("opacity-20 text-muted-foreground", iconClass)} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn(
          "object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
