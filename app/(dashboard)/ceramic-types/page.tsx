"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Layers,
  Loader2,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUser } from "@/components/user-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const supabase = createClient();

export default function CeramicTypesPage() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<any | null>(null);
  const [brandId, setBrandId] = useState("");
  const [size, setSize] = useState("");
  const [finishId, setFinishId] = useState("");
  const [unit, setUnit] = useState("m²");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "size",
    direction: "asc",
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands", "list"],
    queryFn: async () => {
      const res = await fetch("/api/brands?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch brands");
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: finishes = [] } = useQuery({
    queryKey: ["finishes", "list"],
    queryFn: async () => {
      const res = await fetch("/api/finishes?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch finishes");
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: response, isLoading } = useQuery({
    queryKey: [
      "ceramic-types",
      { page: currentPage, search: searchTerm, sort: sortConfig },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        sortBy: sortConfig.key,
        order: sortConfig.direction,
      });
      const res = await fetch(`/api/ceramic-types?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch ceramic types");
      return res.json();
    },
  });

  const types = response?.data || [];
  const totalItems = response?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key)
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    if (sortConfig.direction === "asc")
      return <ArrowUp className="ml-2 h-3 w-3 text-primary" />;
    return <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const resetForm = () => {
    setEditingType(null);
    setBrandId("");
    setSize("");
    setFinishId("");
    setPrice("");
    setUnit("m²");
  };

  const handleAddClick = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditClick = (type: any) => {
    setEditingType(type);
    setBrandId(type.brand_id);
    setSize(type.size);
    setFinishId(type.finish_id);
    setUnit(type.measurement_unit || "m²");
    setPrice(type.price_per_unit?.toString() || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !size || !finishId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    const payload = {
      brand_id: brandId,
      size,
      finish_id: finishId,
      measurement_unit: unit,
      price_per_unit: price ? parseFloat(price) : null,
    };

    try {
      let error;
      if (editingType) {
        const res = await fetch(`/api/ceramic-types/${editingType.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          error = { message: data.error || "Failed to update type" };
        }
      } else {
        const { error: insertError } = await supabase
          .from("ceramic_types")
          .insert([payload]);
        error = insertError;
      }

      if (error) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.success(
          editingType ? "Ceramic type updated" : "Ceramic type added",
        );
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["ceramic-types"] });
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("ceramic_types")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success("Ceramic type deleted");
      queryClient.invalidateQueries({ queryKey: ["ceramic-types"] });
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between shrink-0 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Catalog
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Ceramic Types
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Define brand, size, and finish combinations.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={handleAddClick}>
            <Plus className="h-4 w-4" />
            Add Type
          </Button>
        )}
      </div>

      <Card className="py-0 gap-0 flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b shrink-0 bg-muted/30 gap-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search types by size..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <Table>
              <TableHeader className="border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="sticky top-0 z-10 bg-background pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("size")}
                  >
                    <div className="flex items-center gap-1">
                      Size {getSortIcon("size")}
                    </div>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Brand
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Finish
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Unit
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("price_per_unit")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Price {getSortIcon("price_per_unit")}
                    </div>
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="sticky top-0 z-10 w-20 bg-background" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[52px]">
                      <TableCell className="pl-4"><Skeleton className="h-3.5 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-16 ml-auto" /></TableCell>
                      {isAdmin && <TableCell />}
                    </TableRow>
                  ))
                ) : types.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isAdmin ? 6 : 5}>
                      <EmptyState
                        icon={Layers}
                        title="No ceramic types found"
                        description={
                          searchTerm
                            ? "Try a different search term."
                            : "Define your first brand + size + finish combo."
                        }
                        action={
                          isAdmin && !searchTerm ? (
                            <Button size="sm" onClick={handleAddClick}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Type
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  types.map((t: any) => {
                    const finishName = t.finish?.name || "Normal";
                    const dot = finishName.toLowerCase().includes("polish")
                      ? "bg-indigo-400"
                      : finishName.toLowerCase().includes("decor")
                        ? "bg-violet-400"
                        : "bg-zinc-400";
                    return (
                      <TableRow
                        key={t.id}
                        className="group border-b transition-colors hover:bg-muted/40 h-[52px]"
                      >
                        <TableCell className="pl-4 font-semibold text-sm tabular-nums">
                          {t.size}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {t.brand?.name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                            <span className="text-sm text-muted-foreground">
                              {finishName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {t.measurement_unit || "m²"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {t.price_per_unit != null
                            ? Number(t.price_per_unit).toFixed(2)
                            : "—"}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditClick(t)}
                              >
                                <Pencil className="h-4 w-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setConfirmDeleteId(t.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 shrink-0">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * itemsPerPage, totalItems)}
            </span>{" "}
            of <span className="font-medium text-foreground">{totalItems}</span>{" "}
            ceramic types
          </p>
          <Pagination className="w-auto mx-0">
            <PaginationContent className="gap-1.5">
              <PaginationItem>
                <PaginationPrevious
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-40"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="flex h-8 items-center rounded-lg border bg-background px-3 text-xs font-medium tabular-nums">
                  {currentPage} / {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-40"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Delete Ceramic Type"
        description="This may affect existing products that use this type. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit Ceramic Type" : "Add Ceramic Type"}
              </DialogTitle>
              <DialogDescription>
                Define brand, size, and finish combination.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Brand</Label>
                <div className="col-span-3">
                  <Select value={brandId} onValueChange={setBrandId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="size" className="text-right">
                  Size
                </Label>
                <Input
                  id="size"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. 60*60"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Finish</Label>
                <div className="col-span-3">
                  <Select value={finishId} onValueChange={setFinishId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Finish" />
                    </SelectTrigger>
                    <SelectContent>
                      {finishes.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Unit</Label>
                <div className="col-span-3">
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m²">m² — Square meters</SelectItem>
                      <SelectItem value="m">m — Linear meters</SelectItem>
                      <SelectItem value="pcs">pcs — Pieces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">
                  Price
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. 250.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingType ? "Update Type" : "Add Type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
