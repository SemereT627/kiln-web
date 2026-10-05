"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Building2,
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { useUser } from "@/components/user-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";

const supabase = createClient();

export default function BrandsPage() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: [
      "brands",
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
      const res = await fetch(`/api/brands?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch brands");
      return res.json();
    },
  });

  const brands = response?.data || [];
  const totalItems = response?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
    setCurrentPage(1);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key)
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    if (sortConfig.direction === "asc")
      return <ArrowUp className="ml-2 h-3 w-3 text-primary" />;
    return <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const initialsFor = (name: string) =>
    name
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("brands")
      .insert([{ name: newBrand }]);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success("Brand added successfully");
      setNewBrand("");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success("Brand deleted");
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Catalog
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Brands
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage product brands for your catalog.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Brand
          </Button>
        )}
      </div>

      <Card className="py-0 gap-0 flex flex-col overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b shrink-0 bg-muted/30 gap-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brands..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          <div className="flex flex-col overflow-auto">
            <Table className="min-w-125">
              <TableHeader className="border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="pl-4 sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Name {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center gap-1">
                      Created {getSortIcon("created_at")}
                    </div>
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="sticky top-0 right-0 z-20 w-12 bg-background border-l" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[52px]">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                          <Skeleton className="h-3.5 w-28" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-20" />
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="sticky right-0 z-10 bg-background border-l" />
                      )}
                    </TableRow>
                  ))
                ) : brands.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isAdmin ? 3 : 2}>
                      <EmptyState
                        icon={Building2}
                        title="No brands found"
                        description={
                          searchTerm
                            ? "Try a different search term."
                            : "Add your first brand to get started."
                        }
                        action={
                          isAdmin && !searchTerm ? (
                            <Button size="sm" onClick={() => setIsModalOpen(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Brand
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  brands.map((b: any) => (
                    <TableRow
                      key={b.id}
                      className="group border-b transition-colors hover:bg-muted/40 h-[52px]"
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/10">
                            <span className="text-[10px] font-bold text-primary">
                              {initialsFor(b.name)}
                            </span>
                          </div>
                          <span className="font-medium text-sm truncate">
                            {b.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(b.created_at)}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="sticky right-0 z-10 bg-background border-l transition-colors group-hover:bg-muted/40">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setConfirmDeleteId(b.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 shrink-0">
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
            brands
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
        title="Delete Brand"
        description="This may affect existing products that use this brand. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-106.25">
          <form onSubmit={handleAddBrand}>
            <DialogHeader>
              <DialogTitle>Add Brand</DialogTitle>
              <DialogDescription>
                Create a new brand for your ceramic catalog.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="name" className="sm:text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="sm:col-span-3"
                  placeholder="e.g. DUKEM"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || !newBrand}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Brand
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
