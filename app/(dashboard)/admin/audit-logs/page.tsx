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
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, AlertCircle, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

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

function DiffCell({ before, after }: { before: unknown; after: unknown }) {
  if (!before && !after) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-1 text-xs font-mono max-w-[360px]">
      {before ? (
        <div className="text-destructive/80 truncate">
          − {JSON.stringify(before)}
        </div>
      ) : null}
      {after ? (
        <div className="text-emerald-600 dark:text-emerald-400 truncate">
          + {JSON.stringify(after)}
        </div>
      ) : null}
    </div>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading, error } = useQuery<{
    data: AuditLog[];
    total: number;
  }>({
    queryKey: ["admin", "audit-logs", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/audit-logs?page=${page}&limit=${limit}`,
      );
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

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
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center gap-3 shrink-0">
        <div className="bg-primary/10 rounded-lg p-2.5">
          <ScrollText className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">
            Who did what, and the before/after diff, across the system.
          </p>
        </div>
      </div>

      <Card className="py-0 flex-1 flex flex-col border shadow-sm overflow-hidden bg-background/50">
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    When
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Actor
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Target
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Diff
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[52px]">
                      <TableCell className="pl-4"><Skeleton className="h-3.5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-40" /></TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No audit events recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="border-b hover:bg-muted/40">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Calendar className="size-3 opacity-50" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="size-3 opacity-50 text-muted-foreground" />
                          {log.actorName ?? "System"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-bold text-[10px] h-5", actionColor(log.action))}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{log.targetTable}</span>
                          {log.targetId && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {log.targetId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DiffCell before={log.before} after={log.after} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <div className="flex items-center justify-between border-t px-4 py-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} events
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
