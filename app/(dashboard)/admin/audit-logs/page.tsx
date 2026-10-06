"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { AuditDiffDialog, type CeramicLookup } from "@/components/audit-diff-dialog";
import { DateRangePicker } from "@/components/date-range-picker";
import { AlertCircle, Calendar, Filter, Search, User, X } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const TARGET_TABLES = [
  { value: "brands", label: "Brands" },
  { value: "ceramics", label: "Ceramics" },
  { value: "ceramic_types", label: "Ceramic Types" },
  { value: "finishes", label: "Finishes" },
  { value: "orders", label: "Orders" },
  { value: "return_requests", label: "Return Requests" },
  { value: "sales", label: "Sales" },
  { value: "stock_entries", label: "Stock Entries" },
  { value: "user_profiles", label: "Users" },
];

type AuditLog = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetTable: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  delete: "bg-destructive/10 text-destructive",
  role_change: "bg-primary/10 text-primary",
};

function actionColor(action: string) {
  const suffix = action.split(".")[1] ?? action;
  return ACTION_COLORS[suffix] ?? "bg-muted text-muted-foreground";
}

function DiffCell({
  before,
  after,
  onOpen,
}: {
  before: unknown;
  after: unknown;
  onOpen: () => void;
}) {
  if (!before && !after)
    return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex max-w-[360px] flex-col gap-1 rounded-md p-1 -m-1 text-left font-mono text-xs transition-colors hover:bg-muted/60"
    >
      {before ? (
        <div className="truncate text-destructive/80">
          − {JSON.stringify(before)}
        </div>
      ) : null}
      {after ? (
        <div className="truncate text-emerald-600 dark:text-emerald-400">
          + {JSON.stringify(after)}
        </div>
      ) : null}
    </button>
  );
}

function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [targetTable, setTargetTable] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const hasActiveFilters = targetTable !== "all";
  const limit = 50;

  const changeDateRange = (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => {
    setDateFrom(range.from);
    setDateTo(range.to);
    setPage(1);
  };

  const clearFilters = () => {
    setTargetTable("all");
    setPage(1);
  };

  const { data, isLoading, error } = useQuery<{
    data: AuditLog[];
    total: number;
  }>({
    queryKey: [
      "admin",
      "audit-logs",
      page,
      searchTerm,
      targetTable,
      dateFrom?.getTime(),
      dateTo?.getTime(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: searchTerm,
      });
      if (targetTable !== "all") params.set("targetTable", targetTable);
      if (dateFrom) params.set("dateFrom", toDateParam(dateFrom));
      if (dateTo) params.set("dateTo", toDateParam(dateTo));
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const { data: ceramicsData } = useQuery<{
    data: { _id: string; name: string; productId: string }[];
  }>({
    queryKey: ["ceramics", "list", "all"],
    queryFn: async () => {
      const res = await fetch("/api/ceramics?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch ceramics");
      return res.json();
    },
  });

  const ceramicLookup: CeramicLookup = new Map(
    (ceramicsData?.data ?? []).map((c) => [
      c._id,
      { name: c.name, productId: c.productId },
    ]),
  );

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center animate-in fade-in duration-500">
        <AlertCircle className="size-12 text-destructive opacity-50" />
        <div>
          <h2 className="text-xl font-bold">Failed to load audit logs</h2>
          <p className="text-muted-foreground">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="shrink-0">
        <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
          Administration
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
          Audit Logs
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Who did what, and the before/after diff, across the system.
        </p>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden rounded-lg border">
        <div className="bg-muted/30 border-b shrink-0 py-3.5 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-25 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by actor or target ID..."
                className="pl-8 bg-background h-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchTerm("");
                    setPage(1);
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
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Target</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={targetTable}
                  onValueChange={(value) => {
                    setTargetTable(value);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All Targets
                  </DropdownMenuRadioItem>
                  {TARGET_TABLES.map((t) => (
                    <DropdownMenuRadioItem key={t.value} value={t.value}>
                      {t.label}
                    </DropdownMenuRadioItem>
                  ))}
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

            <DateRangePicker from={dateFrom} to={dateTo} onChange={changeDateRange} />
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-auto">
            <Table className="min-w-175">
              <TableHeader className="border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky top-0 z-10 bg-background pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    When
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Actor
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Target
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Diff
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[52px]">
                      <TableCell className="pl-4">
                        <Skeleton className="h-3.5 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={AlertCircle}
                        title="No audit events recorded yet"
                        description="System activity will show up here as it happens."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Calendar className="size-3 opacity-50" />
                          {formatDateTime(log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="size-3 opacity-50 text-muted-foreground" />
                          {log.actorName ?? "System"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "font-bold text-[10px] h-5",
                            actionColor(log.action),
                          )}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {log.targetTable}
                          </span>
                          {log.targetId && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {log.targetId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DiffCell
                          before={log.before}
                          after={log.after}
                          onOpen={() => setSelectedLog(log)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 shrink-0 bg-muted/30">
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{total}</span> events
          </span>
          <Pagination className="w-auto mx-0">
            <PaginationContent className="gap-1.5">
              <PaginationItem>
                <PaginationPrevious
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-40"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="flex h-8 items-center rounded-lg border bg-background px-3 text-xs font-medium tabular-nums">
                  {page} / {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-40"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <AuditDiffDialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
        before={selectedLog?.before}
        after={selectedLog?.after}
        title={selectedLog ? `${selectedLog.targetTable} · ${selectedLog.action}` : undefined}
        targetTable={selectedLog?.targetTable}
        targetId={selectedLog?.targetId}
        ceramicLookup={ceramicLookup}
      />
    </div>
  );
}
