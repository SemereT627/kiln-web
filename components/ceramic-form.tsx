"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, X, ImageIcon, AlertCircle } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const supabase = createClient();

const ceramicSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  brandId: z.string().min(1, "Please select a brand"),
  typeId: z.string().min(1, "Please select a ceramic type"),
  initialStock: z.number().min(0, "Stock cannot be negative"),
});

type CeramicFormValues = z.infer<typeof ceramicSchema>;

interface CeramicFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  onSuccess: () => void;
}

export function CeramicForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: CeramicFormProps) {
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CeramicFormValues>({
    resolver: zodResolver(ceramicSchema),
    defaultValues: {
      productId: "",
      name: "",
      brandId: "",
      typeId: "",
      initialStock: 0,
    },
  });

  const watchedBrandId = watch("brandId");
  const skipTypeResetRef = useRef(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      skipTypeResetRef.current = true;
      reset({
        productId: initialData?.productId ?? "",
        name: initialData?.name ?? "",
        brandId: initialData?.brandId ?? "",
        typeId: initialData?.typeId ?? "",
        initialStock: initialData?.initialStock ?? 0,
      });
      setImagePreview(initialData?.imageUrl ?? null);
      setImageUrl(initialData?.imageUrl ?? null);
      setServerError(null);
    }
  }, [open, initialData, reset]);

  // Fetch brands
  useEffect(() => {
    if (!open) return;
    supabase
      .from("brands")
      .select("*")
      .order("name")
      .then(({ data }) => setBrands(data || []));
  }, [open]);

  // Fetch types when brand changes
  useEffect(() => {
    const skipReset = skipTypeResetRef.current;
    skipTypeResetRef.current = false;

    if (!watchedBrandId) {
      setTypes([]);
      if (!skipReset) setValue("typeId", "");
      return;
    }
    fetch(`/api/ceramic-types?brandId=${watchedBrandId}&limit=-1`)
      .then((r) => r.json())
      .then((json) => setTypes(json.data || []));
    if (!skipReset) setValue("typeId", "");
  }, [watchedBrandId, setValue]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage
        .from("ceramic-images")
        .upload(`ceramics/${fileName}`, file);
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("ceramic-images")
        .getPublicUrl(`ceramics/${fileName}`);
      setImageUrl(publicUrl);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: CeramicFormValues) => {
    setServerError(null);
    const payload = {
      productId: values.productId || undefined,
      name: values.name,
      brandId: values.brandId,
      typeId: values.typeId,
      initialStock: values.initialStock,
      imageUrl,
    };

    try {
      const url = isEditing ? `/api/ceramics/${initialData._id}` : "/api/ceramics";
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? "Product updated" : "Product added");
        onSuccess();
        onOpenChange(false);
      } else {
        const err = await res.json();
        setServerError(err.error || "Failed to save product");
      }
    } catch {
      setServerError("An unexpected error occurred");
    }
  };

  const selectedType = types.find((t) => t.id === watch("typeId"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              Enter the ceramic product details below.
            </DialogDescription>
          </DialogHeader>

          <div className="py-5 space-y-5">
            {/* Image upload */}
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-muted-foreground/25 overflow-hidden bg-muted/50 flex items-center justify-center">
                {imagePreview ? (
                  <>
                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => { setImagePreview(null); setImageUrl(null); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="h-7 w-7 opacity-20 text-muted-foreground" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-sm font-medium">Product Image</Label>
                <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
                <Label
                  htmlFor="image-upload"
                  className="cursor-pointer inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 rounded-md text-xs font-medium"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {imageUrl ? "Change Image" : "Upload Image"}
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    title="Upload product image"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </Label>
              </div>
            </div>

            {/* Product Code + Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="productId" className="text-sm">Product Code</Label>
                <Input
                  id="productId"
                  placeholder="Auto-generated"
                  {...register("productId")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
            </div>

            {/* Brand */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Brand <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="brandId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger aria-invalid={!!errors.brandId} className="w-full">
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.brandId && (
                <p className="text-xs text-destructive">{errors.brandId.message}</p>
              )}
            </div>

            {/* Ceramic Type */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Size &amp; Finish <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="typeId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!watchedBrandId || types.length === 0}
                  >
                    <SelectTrigger aria-invalid={!!errors.typeId} className="w-full">
                      <SelectValue
                        placeholder={
                          !watchedBrandId
                            ? "Select a brand first"
                            : types.length === 0
                              ? "No types for this brand"
                              : "Select size / finish"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.size} — {t.finish?.name || "Normal"}
                          {t.measurement_unit !== "m²" ? ` (${t.measurement_unit})` : ""}
                          {t.price_per_unit != null
                            ? ` · ${Number(t.price_per_unit).toFixed(2)} ETB`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.typeId && (
                <p className="text-xs text-destructive">{errors.typeId.message}</p>
              )}
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  Unit: {selectedType.measurement_unit || "m²"}
                  {selectedType.price_per_unit != null &&
                    ` · Price: ${Number(selectedType.price_per_unit).toFixed(2)} ETB`}
                </p>
              )}
            </div>

            {/* Initial Stock */}
            <div className="space-y-1.5">
              <Label htmlFor="initialStock" className="text-sm">
                Initial Stock{" "}
                {selectedType && (
                  <span className="text-muted-foreground font-normal">
                    ({selectedType.measurement_unit || "m²"})
                  </span>
                )}
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                id="initialStock"
                type="number"
                step="0.01"
                min="0"
                aria-invalid={!!errors.initialStock}
                {...register("initialStock", { valueAsNumber: true })}
              />
              {errors.initialStock && (
                <p className="text-xs text-destructive">{errors.initialStock.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 animate-in slide-in-from-bottom-1">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {serverError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || uploading}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
