"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { ProductImage } from "@/components/product-image";

/**
 * Full-screen image viewer: dark backdrop, image fitted to the viewport,
 * close button top-right. Esc, the button or a click on the backdrop closes it.
 */
export function ImageLightbox({
  src,
  alt,
  title,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          // Clicks on empty space around the image close the viewer.
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <DialogPrimitive.Title className="font-mono text-sm text-white/80">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Full-size product image
            </DialogPrimitive.Description>
            <DialogPrimitive.Close className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60">
              <XIcon className="size-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-10"
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            <ProductImage
              src={src}
              alt={alt}
              className="h-full w-full bg-transparent"
              iconSize="lg"
              sizes="100vw"
              fit="letterbox"
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
