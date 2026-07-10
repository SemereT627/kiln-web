"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // still used for brand + filter count badges
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Download,
  Trash2,
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  PackageSearch,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CeramicForm } from "@/components/ceramic-form";
import { CeramicDetailsDrawer } from "@/components/ceramic-details-drawer";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/user-provider";

export default function InventoryPage() {
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter state
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedFinish, setSelectedFinish] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "updated_at",
    direction: "desc",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch brands for filter
  const { data: brands = [] } = useQuery({
    queryKey: ["brands", "list"],
    queryFn: async () => {
      const res = await fetch("/api/brands?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch brands");
      const json = await res.json();
      return json.data || [];
    },
  });

  // Fetch finishes for filter
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
      "ceramics",
      {
        page: currentPage,
        search: searchTerm,
        sort: sortConfig,
        brand: selectedBrand,
        finish: selectedFinish,
        status: selectedStatus,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        sortBy: sortConfig.key,
        order: sortConfig.direction,
      });

      if (selectedBrand !== "all") params.append("brandId", selectedBrand);
      if (selectedFinish !== "all") params.append("finishId", selectedFinish);
      if (selectedStatus !== "all") params.append("status", selectedStatus);

      const res = await fetch(`/api/ceramics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ceramics/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ceramics"] });
    },
  });

  const data = response?.data || [];
  const totalItems = response?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleEdit = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleRowClick = (product: any) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
    setCurrentPage(1); // Reset to first page on sort
  };

  const clearFilters = () => {
    setSelectedBrand("all");
    setSelectedFinish("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedBrand !== "all" ||
    selectedFinish !== "all" ||
    selectedStatus !== "all";

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key)
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    if (sortConfig.direction === "asc")
      return <ArrowUp className="ml-2 h-3 w-3 text-primary" />;
    return <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            Manage your ceramic stock and product catalog.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      <Card className="py-0 flex-1 flex flex-col border shadow-sm overflow-hidden bg-background/50">
        <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b shrink-0 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-8 bg-background h-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 gap-2",
                    hasActiveFilters && "border-primary bg-primary/5",
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 px-1.5 text-[10px] font-bold"
                    >
                      {
                        [selectedBrand, selectedFinish, selectedStatus].filter(
                          (v) => v !== "all",
                        ).length
                      }
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56"
                portal={false}
              >
                <DropdownMenuLabel>Brand</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedBrand}
                  onValueChange={setSelectedBrand}
                >
                  <DropdownMenuRadioItem value="all">
                    All Brands
                  </DropdownMenuRadioItem>
                  {brands.map((brand: any) => (
                    <DropdownMenuRadioItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Finish</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedFinish}
                  onValueChange={setSelectedFinish}
                >
                  <DropdownMenuRadioItem value="all">
                    All Finishes
                  </DropdownMenuRadioItem>
                  {finishes.map((finish: any) => (
                    <DropdownMenuRadioItem key={finish.id} value={finish.id}>
                      {finish.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <DropdownMenuRadioItem value="all">
                    All Status
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="in">
                    In Stock
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">
                    Low Stock
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="out">
                    Out of Stock
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="justify-center text-primary font-medium"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-2 text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Product {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("brand_name")}
                  >
                    <div className="flex items-center gap-1">
                      Brand {getSortIcon("brand_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("size")}
                  >
                    <div className="flex items-center gap-1">
                      Size {getSortIcon("size")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("finish_name")}
                  >
                    <div className="flex items-center gap-1">
                      Finish {getSortIcon("finish_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("initial_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Initial {getSortIcon("initial_stock")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("sold_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Sold {getSortIcon("sold_stock")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("current_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Stock {getSortIcon("current_stock")}
                    </div>
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Status
                  </TableHead>
                  {isAdmin && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[60px]">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-2.5 w-16" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-14 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-3 rounded-full" /></TableCell>
                      {isAdmin && <TableCell />}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isAdmin ? 9 : 8}>
                      <EmptyState
                        icon={PackageSearch}
                        title="No products found"
                        description={
                          hasActiveFilters || searchTerm
                            ? "Try adjusting your search or filters."
                            : "Add your first product to get started."
                        }
                        action={
                          isAdmin && !hasActiveFilters && !searchTerm ? (
                            <Button size="sm" onClick={handleAdd}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Product
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item: any) => {
                    const unit = item.measurementUnit || "m²";
                    const finishDot = item.finish?.toLowerCase().includes("polish")
                      ? "bg-indigo-400"
                      : item.finish?.toLowerCase().includes("decor")
                        ? "bg-violet-400"
                        : "bg-zinc-400";
                    return (
                      <TableRow
                        key={item._id}
                        className="group cursor-pointer border-b transition-colors hover:bg-muted/40 h-[60px]"
                        onClick={() => handleRowClick(item)}
                      >
                        {/* Product: image + name + code */}
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-10 w-10 rounded-lg shrink-0"
                              iconSize="sm"
                              sizes="40px"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate leading-tight">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                {item.productId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {/* Brand */}
                        <TableCell>
                          <span className="text-sm text-foreground">
                            {item.brand}
                          </span>
                        </TableCell>
                        {/* Size */}
                        <TableCell>
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {item.size}
                          </span>
                        </TableCell>
                        {/* Finish */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                finishDot,
                              )}
                            />
                            <span className="text-sm text-muted-foreground">
                              {item.finish}
                            </span>
                          </div>
                        </TableCell>
                        {/* Initial */}
                        <TableCell className="text-right">
                          <span className="text-sm tabular-nums text-muted-foreground/70">
                            {item.initialStock.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 ml-0.5">
                            {unit}
                          </span>
                        </TableCell>
                        {/* Sold */}
                        <TableCell className="text-right">
                          <span className="text-sm tabular-nums text-blue-600 dark:text-blue-400 font-medium">
                            {item.soldStock.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 ml-0.5">
                            {unit}
                          </span>
                        </TableCell>
                        {/* Current Stock */}
                        <TableCell className="text-right">
                          <span className="text-sm font-bold tabular-nums">
                            {item.currentStock.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 ml-0.5">
                            {unit}
                          </span>
                        </TableCell>
                        {/* Status dot */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                item.currentStock <= 0
                                  ? "bg-destructive"
                                  : item.currentStock < 5
                                    ? "bg-amber-500"
                                    : "bg-emerald-500",
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                item.currentStock <= 0
                                  ? "text-destructive"
                                  : item.currentStock < 5
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {item.currentStock <= 0
                                ? "Out"
                                : item.currentStock < 5
                                  ? "Low"
                                  : "Good"}
                            </span>
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  className="flex items-center"
                                  onClick={(e) => handleEdit(e, item)}
                                >
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive flex items-center"
                                  onClick={(e) => handleDelete(e, item._id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
            products
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

      {isAdmin && (
        <CeramicForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialData={editingProduct}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["ceramics"] })
          }
        />
      )}

      <CeramicDetailsDrawer
        ceramic={selectedProduct}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Delete Product"
        description="This will permanently delete the product and all associated stock entries. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
