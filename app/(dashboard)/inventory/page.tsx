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
  ChevronRight,
  ChevronLeft,
  Layers,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/user-provider";
import { useTranslations } from "next-intl";

export default function InventoryPage() {
  const t = useTranslations("Inventory");
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isStockDrawerOpen, setIsStockDrawerOpen] = useState(false);
  const [stockDrawerBrand, setStockDrawerBrand] = useState<string | null>(
    null,
  );

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

  // byType is already sorted brand -> size by the API. Group it into
  // Brand -> Size -> Finish for the stock breakdown drawer.
  const stockByBrand = byType.reduce(
    (acc: Record<string, any[]>, row: any) => {
      (acc[row.brand] ??= []).push(row);
      return acc;
    },
    {},
  );
  const brandNames = Object.keys(stockByBrand).sort((a, b) =>
    a.localeCompare(b),
  );

  function groupBySize(rows: any[]) {
    const bySize = rows.reduce((acc: Record<string, any[]>, row: any) => {
      (acc[row.size] ??= []).push(row);
      return acc;
    }, {});
    return Object.entries(bySize).map(([size, finishRows]) => ({
      size,
      subtotal: finishRows.reduce((s, r) => s + Number(r.currentStock), 0),
      measurementUnit: finishRows[0]?.measurementUnit || "m²",
      finishRows,
    }));
  }

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
    { key: "name", label: t("columns.product") },
    { key: "brand_name", label: t("columns.brand") },
    { key: "size", label: t("columns.size") },
    { key: "finish_name", label: t("columns.finish") },
    { key: "initial_stock", label: t("columns.initial") },
    { key: "sold_stock", label: t("columns.sold") },
    { key: "current_stock", label: t("columns.stock") },
  ];

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            {t("export")}
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              {t("addProduct")}
            </Button>
          )}
        </div>
      </div>

      {(isLoading || byType.length > 0) && (
        <div className="shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isLoading}
            onClick={() => {
              setStockDrawerBrand(null);
              setIsStockDrawerOpen(true);
            }}
          >
            <Layers className="h-4 w-4" />
            {t("showTotalStock")}
            {!isLoading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">
                {totalStockSqm.toFixed(2)}
                <span className="text-[9px] font-medium text-muted-foreground">
                  m²
                </span>
                {totalStockLinear > 0 && (
                  <>
                    <span className="text-muted-foreground/40">+</span>
                    {totalStockLinear.toFixed(2)}
                    <span className="text-[9px] font-medium text-muted-foreground">
                      m
                    </span>
                  </>
                )}
              </span>
            )}
          </Button>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden rounded-lg border">
        <div className="bg-muted/30 border-b shrink-0 py-3.5 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-25 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
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
                  aria-label={t("clearSearch")}
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
                  aria-label={t("filters")}
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("filters")}</span>
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
                <DropdownMenuLabel>{t("filterBrand")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedBrand}
                  onValueChange={setSelectedBrand}
                >
                  <DropdownMenuRadioItem value="all">
                    {t("allBrands")}
                  </DropdownMenuRadioItem>
                  {brands.map((brand: any) => (
                    <DropdownMenuRadioItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>{t("filterFinish")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedFinish}
                  onValueChange={setSelectedFinish}
                >
                  <DropdownMenuRadioItem value="all">
                    {t("allFinishes")}
                  </DropdownMenuRadioItem>
                  {finishes.map((finish: any) => (
                    <DropdownMenuRadioItem key={finish.id} value={finish.id}>
                      {finish.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>{t("filterSize")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedSize}
                  onValueChange={setSelectedSize}
                >
                  <DropdownMenuRadioItem value="all">
                    {t("allSizes")}
                  </DropdownMenuRadioItem>
                  {sizes.map((size: string) => (
                    <DropdownMenuRadioItem key={size} value={size}>
                      {size}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>{t("filterStatus")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <DropdownMenuRadioItem value="all">
                    {t("allStatus")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="in">
                    {t("statusIn")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">
                    {t("statusLow")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="out">
                    {t("statusOut")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="justify-center text-primary font-medium"
                      onClick={clearFilters}
                    >
                      {t("clearFilters")}
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
                {t("clear")}
              </Button>
            )}

            <div className="flex md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-r-none"
                    aria-label={t("sortAriaLabel", {
                      label:
                        SORT_OPTIONS.find((o) => o.key === sortConfig.key)
                          ?.label ?? "",
                    })}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
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
                aria-label={t("toggleSortDirection")}
                onClick={() => handleSort(sortConfig.key)}
              >
                {getSortIcon(sortConfig.key)}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-col overflow-auto">
            <Table className="min-w-200">
              <TableHeader className="border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="pl-4 sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      {t("columns.product")} {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("brand_name")}
                  >
                    <div className="flex items-center gap-1">
                      {t("columns.brand")} {getSortIcon("brand_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("size")}
                  >
                    <div className="flex items-center gap-1">
                      {t("columns.size")} {getSortIcon("size")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("finish_name")}
                  >
                    <div className="flex items-center gap-1">
                      {t("columns.finish")} {getSortIcon("finish_name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("initial_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {t("columns.initial")} {getSortIcon("initial_stock")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("sold_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {t("columns.sold")} {getSortIcon("sold_stock")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("current_stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {t("columns.stock")} {getSortIcon("current_stock")}
                    </div>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {t("columns.status")}
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="sticky top-0 right-0 z-20 w-12 bg-background border-l" />
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
                      {isAdmin && (
                        <TableCell className="sticky right-0 z-10 bg-background border-l" />
                      )}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={isAdmin ? 9 : 8}>
                      <EmptyState
                        icon={PackageSearch}
                        title={t("emptyTitle")}
                        description={
                          hasActiveFilters || searchTerm
                            ? t("emptyFiltered")
                            : t("emptyDefault")
                        }
                        action={
                          isAdmin && !hasActiveFilters && !searchTerm ? (
                            <Button size="sm" onClick={handleAdd}>
                              <Plus className="mr-2 h-4 w-4" />
                              {t("addProduct")}
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
                                ? t("dotOut")
                                : item.currentStock <= 5
                                  ? t("dotLow")
                                  : t("dotGood")}
                            </span>
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="sticky right-0 z-10 bg-background border-l transition-colors group-hover:bg-muted/40">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
                                <DropdownMenuItem
                                  className="flex items-center"
                                  onClick={(e) => handleEdit(e, item)}
                                >
                                  <Edit className="mr-2 h-4 w-4" /> {t("edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive flex items-center"
                                  onClick={(e) => handleDelete(e, item._id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> {t("delete")}
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
            {t("showing", {
              from: (currentPage - 1) * itemsPerPage + 1,
              to: Math.min(currentPage * itemsPerPage, totalItems),
              total: totalItems,
            })}
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

      <Sheet
        open={isStockDrawerOpen}
        onOpenChange={(open) => {
          setIsStockDrawerOpen(open);
          if (!open) setStockDrawerBrand(null);
        }}
      >
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md overflow-y-auto">
          <SheetHeader>
            {stockDrawerBrand ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 -ml-1.5"
                  onClick={() => setStockDrawerBrand(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <SheetTitle>{stockDrawerBrand}</SheetTitle>
              </div>
            ) : (
              <SheetTitle>{t("totalStock")}</SheetTitle>
            )}
            <SheetDescription>
              {stockDrawerBrand
                ? t("stockDrawer.brandSubtitle")
                : t("stockDrawer.brandListSubtitle")}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 flex flex-col gap-2">
            {!stockDrawerBrand
              ? brandNames.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setStockDrawerBrand(brand)}
                    className="flex items-center justify-between rounded-lg border p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <span className="font-medium text-sm">{brand}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              : groupBySize(stockByBrand[stockDrawerBrand] || []).map(
                  (group) => (
                    <div key={group.size} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between px-0.5 pt-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.size}
                        </span>
                        <span className="text-xs font-bold tabular-nums">
                          {group.subtotal.toFixed(2)}{" "}
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {group.measurementUnit}
                          </span>
                        </span>
                      </div>
                      {group.finishRows.map((row: any) => (
                        <div
                          key={row.typeId}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{row.finish}</span>
                            <span className="font-bold tabular-nums">
                              {Number(row.currentStock).toFixed(2)}{" "}
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {row.measurementUnit}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground pt-1.5 mt-1.5 border-t border-dashed">
                            <span>
                              {t("sold")}{" "}
                              <span className="tabular-nums font-medium text-primary">
                                {Number(row.soldStock).toFixed(2)}
                              </span>
                            </span>
                            <span>
                              {t("initial")}{" "}
                              <span className="tabular-nums font-medium text-foreground">
                                {Number(row.initialStock).toFixed(2)}
                              </span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
                )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description")}
        confirmLabel={t("deleteDialog.confirmLabel")}
        destructive
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
