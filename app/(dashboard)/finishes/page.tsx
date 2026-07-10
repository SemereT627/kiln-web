"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Trash2, Palette, Loader2, X, Search } from "lucide-react";
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
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finishes</h1>
          <p className="text-muted-foreground text-sm">
            Define ceramic finishes (e.g. Matte, Polished).
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Finish
          </Button>
        )}
      </div>

      <Card className="py-0 flex-1 flex flex-col border shadow-sm overflow-hidden bg-background/50">
        <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b shrink-0 py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search finishes..."
              className="pl-8 bg-background h-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Name
                  </TableHead>
                  {isAdmin && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[52px]">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                          <Skeleton className="h-3.5 w-24" />
                        </div>
                      </TableCell>
                      {isAdmin && <TableCell />}
                    </TableRow>
                  ))
                ) : finishes.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isAdmin ? 2 : 1}>
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
                    </TableCell>
                  </TableRow>
                ) : (
                  finishes.map((f: any) => {
                    const dot = f.name?.toLowerCase().includes("polish")
                      ? "bg-indigo-400"
                      : f.name?.toLowerCase().includes("decor")
                        ? "bg-violet-400"
                        : "bg-zinc-400";
                    return (
                      <TableRow
                        key={f.id}
                        className="group border-b transition-colors hover:bg-muted/40 h-[52px]"
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                            <span className="font-medium text-sm">{f.name}</span>
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setConfirmDeleteId(f.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
        <div className="flex items-center justify-between px-2 shrink-0">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
            finishes
          </p>
          <Pagination className="w-auto mx-0 scale-90 origin-right">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newFinish}
                  onChange={(e) => setNewFinish(e.target.value)}
                  className="col-span-3"
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
