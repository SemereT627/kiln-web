"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: "sm" | "md" | "lg";
  sizes?: string;
  /** "cover" crops to fill the box (thumbnails); "contain" shows the whole
   * uploaded image undistorted, letterboxed inside the box (detail previews). */
  fit?: "cover" | "contain";
}

export function ProductImage({
  src,
  alt,
  className,
  iconSize = "md",
  sizes = "100px",
  fit = "cover",
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const iconClass =
    iconSize === "sm" ? "h-4 w-4" : iconSize === "lg" ? "h-12 w-12" : "h-6 w-6";

  if (!src || error) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted", className)}
      >
        <ImageIcon
          className={cn("opacity-20 text-muted-foreground", iconClass)}
        />
      </div>
    );
  }

  if (fit === "contain") {
    // No fixed aspect box here — the container sizes to the image's own
    // natural aspect ratio so it renders at full width with no letterboxing
    // or cropping, whatever the uploaded photo's shape.
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          !loaded && "min-h-40",
          className,
        )}
      >
        {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "block w-full h-auto scale-[1.03] transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
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
