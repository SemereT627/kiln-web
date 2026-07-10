"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackagePlus, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestockFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSuccess: () => void;
}

export function RestockForm({
  open,
  onOpenChange,
  product,
  onSuccess,
}: RestockFormProps) {
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [entryType, setEntryType] = useState("Restock");
  const [direction, setDirection] = useState("add");
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const handleClose = () => {
    onOpenChange(false);
    // Reset form state after close animation
    setTimeout(() => {
      setQuantity("");
      setEntryType("Restock");
      setDirection("add");
      setReason("");
      setSupplier("");
      setNotes("");
      setStatus({ type: "idle", message: "" });
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) return;
    if (entryType === "Adjustment" && !reason) {
      setStatus({ type: "error", message: "Please select a reason for this adjustment." });
      return;
    }

    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const res = await fetch(`/api/ceramics/${product._id}/restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: qty,
          entryType,
          direction: entryType === "Adjustment" ? direction : undefined,
          reason: entryType === "Adjustment" ? reason : undefined,
          supplier: supplier || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to add stock");
      }

      setStatus({
        type: "success",
        message: `Successfully added ${qty.toFixed(2)} ${product?.measurementUnit || "m²"} to stock.`,
      });

      onSuccess();

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error: any) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const unit = product?.measurementUnit || "m²";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Restock Product
            </DialogTitle>
            <DialogDescription>
              Add stock for{" "}
              <strong className="text-foreground">{product?.name}</strong>.
              Current stock:{" "}
              <span className="font-semibold text-foreground">
                {product?.currentStock?.toFixed(2)} {unit}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-5">
            {/* Quantity */}
            <div className="grid gap-2">
              <Label htmlFor="restock-amount" className="font-semibold">
                Quantity to Add ({unit}){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="restock-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                required
                className="text-lg font-bold h-11"
              />
            </div>

            {/* Entry Type */}
            <div className="grid gap-2">
              <Label className="font-semibold">Type</Label>
              <Select value={entryType} onValueChange={setEntryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Restock">New Shipment (Restock)</SelectItem>
                  <SelectItem value="Adjustment">Manual Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Direction + Reason (Adjustment only) */}
            {entryType === "Adjustment" && (
              <>
                <div className="grid gap-2">
                  <Label className="font-semibold">
                    Direction <span className="text-destructive">*</span>
                  </Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add to stock</SelectItem>
                      <SelectItem value="remove">Remove from stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="font-semibold">
                    Reason <span className="text-destructive">*</span>
                  </Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="miscount">Miscount</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Supplier */}
            <div className="grid gap-2">
              <Label htmlFor="restock-supplier" className="font-semibold">
                Supplier{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="restock-supplier"
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Supplier name or factory"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="restock-notes" className="font-semibold">
                Notes{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="restock-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this restock…"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Status feedback */}
            {status.type !== "idle" && (
              <div
                className={cn(
                  "flex items-start gap-2 p-3 rounded-lg text-sm font-medium animate-in slide-in-from-bottom-2",
                  status.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                {status.message}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !quantity || (entryType === "Adjustment" && !reason)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Adding Stock…" : "Confirm Restock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
