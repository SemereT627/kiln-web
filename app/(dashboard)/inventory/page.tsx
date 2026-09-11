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
import { Card, CardContent } from "@/components/ui/card";
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
import { DataCardList } from "@/components/data-card-list";
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
  const [selectedSize, setSelectedSize] = useState<string>("all");
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

  // Fetch distinct sizes for filter (derived from ceramic types)
  const { data: sizes = [] } = useQuery({
    queryKey: ["ceramic-types", "sizes"],
    queryFn: async () => {
      const res = await fetch("/api/ceramic-types?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch sizes");
      const json = await res.json();
      const all = (json.data || []).map((t: any) => t.size).filter(Boolean);
      return Array.from(new Set(all)).sort() as string[];
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
        size: selectedSize,
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
      if (selectedSize !== "all") params.append("size", selectedSize);
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
  const summary = response?.summary;
  const byType: any[] = summary?.byType || [];
  const stockByUnit: Record<string, number> = summary?.stockByUnit || {};
  const totalStockSqm = stockByUnit["m²"] ?? 0;
  const totalStockLinear = stockByUnit["m"] ?? 0;

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
    setSelectedSize("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedBrand !== "all" ||
    selectedFinish !== "all" ||
    selectedSize !== "all" ||
    selectedStatus !== "all";

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key)
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    if (sortConfig.direction === "asc")
      return <ArrowUp className="ml-2 h-3 w-3 text-primary" />;
    return <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const SORT_OPTIONS: { key: string; label: string }[] = [
    { key: "name", label: "Product" },
    { key: "brand_name", label: "Brand" },
    { key: "size", label: "Size" },
    { key: "finish_name", label: "Finish" },
    { key: "initial_stock", label: "Initial" },
    { key: "sold_stock", label: "Sold" },
    { key: "current_stock", label: "Stock" },
  ];

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Catalog
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Inventory
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your ceramic stock and product catalog.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      {(isLoading || byType.length > 0) && (
        <div className="shrink-0 -mb-2">
          <div className="flex flex-nowrap items-center justify-between gap-2 mb-2.5 px-0.5">
            <h2 className="shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Stock
            </h2>
            {!isLoading && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-full border bg-background px-3 py-1 shadow-xs">
                <span className="text-xs font-bold tabular-nums">
                  {totalStockSqm.toFixed(2)}
                </span>
                <span className="text-[9px] text-muted-foreground/60">m²</span>
                {totalStockLinear > 0 && (
                  <>
                    <span className="text-muted-foreground/30">+</span>
                    <span className="text-xs font-bold tabular-nums">
                      {totalStockLinear.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">
                      m
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="shrink-0 w-52 py-0 snap-start">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-6 rounded-full" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              : byType.map((t: any) => (
                  <Card
                    key={t.typeId}
                    className="shrink-0 w-52 py-0 gap-0 snap-start"
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight line-clamp-2">
                          {t.label}
                        </p>
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px]"
                        >
                          {t.productCount}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold tabular-nums tracking-tight">
                          {Number(t.currentStock).toFixed(2)}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60">
                          {t.measurementUnit}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-dashed">
                        <span className="pt-1.5">
                          Sold{" "}
                          <span className="tabular-nums font-medium text-primary">
                            {Number(t.soldStock).toFixed(2)}
                          </span>
                        </span>
                        <span className="pt-1.5">
                          Initial{" "}
                          <span className="tabular-nums font-medium text-foreground">
                            {Number(t.initialStock).toFixed(2)}
                          </span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden rounded-lg border">
        <div className="bg-muted/30 border-b shrink-0 py-3.5 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-25 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-8 bg-background h-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
                  aria-label="Filters"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 px-1.5 text-[10px] font-bold"
                    >
                      {
                        [
                          selectedBrand,
                          selectedFinish,
                          selectedSize,
                          selectedStatus,
                        ].filter((v) => v !== "all").length
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

                <DropdownMenuLabel>Size</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedSize}
                  onValueChange={setSelectedSize}
                >
                  <DropdownMenuRadioItem value="all">
                    All Sizes
                  </DropdownMenuRadioItem>
                  {sizes.map((size: string) => (
                    <DropdownMenuRadioItem key={size} value={size}>
                      {size}
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
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}

            <div className="flex md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-r-none"
                    aria-label={`Sort by ${
                      SORT_OPTIONS.find((o) => o.key === sortConfig.key)
                        ?.label ?? "Recent"
                    }`}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortConfig.key}
                    onValueChange={handleSort}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 rounded-l-none border-l-0 p-0"
                aria-label="Toggle sort direction"
                onClick={() => handleSort(sortConfig.key)}
              >
                {getSortIcon(sortConfig.key)}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile card list */}
          <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : data.length === 0 ? (
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
            ) : (
              <DataCardList
                items={data}
                keyFor={(item: any) => item._id}
                onRowClick={handleRowClick}
                renderLeading={(item: any) => (
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-10 w-10 rounded-lg ring-1 ring-border"
                    iconSize="sm"
                    sizes="40px"
                  />
                )}
                renderTitle={(item: any) => item.name}
                renderSubtitle={(item: any) => item.productId}
                renderTrailing={(item: any) =>
                  isAdmin ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => handleEdit(e, item)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => handleDelete(e, item._id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : undefined
                }
                fields={[
                  { label: "Brand", render: (item: any) => item.brand },
                  { label: "Size", render: (item: any) => item.size },
                  { label: "Finish", render: (item: any) => item.finish },
                  {
                    label: "Unit",
                    render: (item: any) => item.measurementUnit || "m²",
                  },
                  {
                    label: "Initial",
                    render: (item: any) => item.initialStock.toFixed(2),
                  },
                  {
                    label: "Sold",
                    render: (item: any) => item.soldStock.toFixed(2),
                  },
                  {
                    label: "Stock",
                    render: (item: any) => item.currentStock.toFixed(2),
                  },
                  {
                    label: "Status",
                    render: (item: any) => (
                      <StockBadge stock={item.currentStock} size="sm" />
                    ),
                  },
                ]}
              />
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:flex md:flex-1 md:flex-col md:overflow-auto">
            <Table>
              <TableHeader className="border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="pl-4 sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Product {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("brand_name")}
                  >
                    <div className="flex items-center gap-1">
                      Brand {getSortIcon("brand_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("size")}
                  >
                    <div className="flex items-center gap-1">
                      Size {getSortIcon("size")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("finish_name")}
                  >
                    <div className="flex items-center gap-1">
                      Finish {getSortIcon("finish_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("initial_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Initial {getSortIcon("initial_stock")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("sold_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Sold {getSortIcon("sold_stock")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("current_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Stock {getSortIcon("current_stock")}
                    </div>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Status
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="sticky top-0 z-10 w-12 bg-background" />
                  )}
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
                      <TableCell>
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-14 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-14 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3 w-3 rounded-full" />
                      </TableCell>
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
                    const finishDot = item.finish
                      ?.toLowerCase()
                      .includes("polish")
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
                              className="h-10 w-10 rounded-lg shrink-0 ring-1 ring-border"
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
                          <span className="text-sm tabular-nums text-primary font-medium">
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
                                  : item.currentStock <= 5
                                    ? "bg-amber-500"
                                    : "bg-emerald-500",
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                item.currentStock <= 0
                                  ? "text-destructive"
                                  : item.currentStock <= 5
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {item.currentStock <= 0
                                ? "Out"
                                : item.currentStock <= 5
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
        </div>
      </div>

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
            products
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
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
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
