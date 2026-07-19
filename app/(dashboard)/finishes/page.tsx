"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Palette, Loader2, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function FinishesPage() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFinish, setNewFinish] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ["finishes", { page: currentPage, search: searchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
      });
      const res = await fetch(`/api/finishes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch finishes");
      return res.json();
    },
  });

  const finishes = response?.data || [];
  const totalItems = response?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleAddFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinish) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("finishes")
      .insert([{ name: newFinish }]);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success("Finish added successfully");
      setNewFinish("");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["finishes"] });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("finishes").delete().eq("id", id);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success("Finish deleted");
      queryClient.invalidateQueries({ queryKey: ["finishes"] });
    }
  };

  return (
    <div className="flex flex-col gap-6 md:h-full animate-in fade-in duration-500 md:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Catalog
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Finishes
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Define ceramic finishes (e.g. Matte, Polished).
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Finish
          </Button>
        )}
      </div>

      <Card className="py-0 gap-0 md:flex-1 flex flex-col md:overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b shrink-0 bg-muted/30 gap-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search finishes..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="md:flex-1 md:overflow-y-auto md:overflow-x-hidden p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : finishes.length === 0 ? (
            <EmptyState
              icon={Palette}
              title="No finishes found"
              description={
                searchTerm
                  ? "Try a different search term."
                  : "Add your first finish to get started."
              }
              action={
                isAdmin && !searchTerm ? (
                  <Button size="sm" onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Finish
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {finishes.map((f: any) => {
                const dot = f.name?.toLowerCase().includes("polish")
                  ? "bg-indigo-400"
                  : f.name?.toLowerCase().includes("decor")
                    ? "bg-violet-400"
                    : "bg-zinc-400";
                return (
                  <div
                    key={f.id}
                    className="group relative flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-xs transition-all hover:shadow-md hover:border-primary/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <span className={`h-3 w-3 rounded-full shrink-0 ${dot}`} />
                    </div>
                    <span className="font-medium text-sm truncate">
                      {f.name}
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setConfirmDeleteId(f.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            finishes
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
        title="Delete Finish"
        description="This may affect existing products that use this finish. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-106.25">
          <form onSubmit={handleAddFinish}>
            <DialogHeader>
              <DialogTitle>Add Finish</DialogTitle>
              <DialogDescription>
                Define a new ceramic finish for your catalog.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="name" className="sm:text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newFinish}
                  onChange={(e) => setNewFinish(e.target.value)}
                  className="sm:col-span-3"
                  placeholder="e.g. Polished"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || !newFinish}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Finish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
