"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  AlertCircle,
  Search,
  Mail,
  Calendar,
  Shield,
  UserPlus,
  Trash2,
  X,
} from "lucide-react";
import { useUser } from "@/components/user-provider";
import { EmptyState } from "@/components/empty-state";
import { AddUserForm } from "@/components/add-user-form";
import { UserAvatar } from "@/components/user-avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";

type Role = "admin" | "seller" | "viewer";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
};

const ROLE_OPTIONS: Role[] = ["admin", "seller", "viewer"];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery<UserRow[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: Role;
    }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success(`Role updated to ${variables.role}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const renderRoleAction = (user: UserRow) => {
    if (user.id === currentUser?.id) {
      return (
        <div
          className="inline-flex h-8 w-8 items-center justify-center"
          title="Current session"
        >
          <span className="size-2 rounded-full bg-emerald-500" />
        </div>
      );
    }
    const isUpdating =
      changeRoleMutation.isPending &&
      changeRoleMutation.variables?.userId === user.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isUpdating}
            className="h-8 w-8"
          >
            {isUpdating ? (
              <div className="size-2 rounded-full bg-primary animate-pulse" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {ROLE_OPTIONS.filter((role) => role !== user.role).map((role) => (
            <DropdownMenuItem
              key={role}
              className="text-xs font-medium capitalize"
              onClick={() =>
                changeRoleMutation.mutate({ userId: user.id, role })
              }
            >
              <Shield className="size-3 mr-2" />
              Set as {role}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="text-xs font-medium text-destructive focus:text-destructive"
            onClick={() => setDeleteTarget(user)}
          >
            <Trash2 className="size-3 mr-2" />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center animate-in fade-in duration-500">
        <AlertCircle className="size-12 text-destructive opacity-50" />
        <div>
          <h2 className="text-xl font-bold">Failed to load users</h2>
          <p className="text-muted-foreground">{(error as Error).message}</p>
        </div>
        <Button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
          }
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Administration
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Users
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage roles and permissions for all registered users.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddUserOpen(true)}>
          <UserPlus className="size-4" />
          Add User
        </Button>
      </div>

      <AddUserForm
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden rounded-lg border">
        <div className="py-3.5 px-5 border-b shrink-0 bg-muted/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[160px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {searchTerm
                ? `${filteredUsers.length} of ${users.length} users`
                : `${users.length} total users`}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-auto">
            <Table className="min-w-200">
              <TableHeader className="border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky top-0 z-10 bg-background pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Email
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Joined
                  </TableHead>
                  <TableHead className="sticky top-0 right-0 z-20 bg-background pr-4 text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground border-l">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[60px]">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-2.5 w-16" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-3.5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
                      <TableCell className="sticky right-0 z-10 bg-background border-l">
                        <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={UserPlus}
                        title="No users found"
                        description={
                          searchTerm
                            ? "Try a different search term."
                            : "Add your first user to get started."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "group border-b transition-colors hover:bg-muted/40 h-[60px]",
                        user.id === currentUser?.id &&
                          "bg-primary/5 hover:bg-primary/10",
                      )}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.full_name ?? user.email} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm flex items-center gap-2">
                              {user.full_name ?? "—"}
                              {user.id === currentUser?.id && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4 px-1 font-bold bg-primary/10 text-primary border-primary/20"
                                >
                                  YOU
                                </Badge>
                              )}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {user.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="size-3 opacity-50" />
                          <span className="text-sm">{user.email ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "capitalize font-bold text-[10px] h-5",
                            user.role === "admin"
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : user.role === "seller"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Shield className="size-2.5 mr-1" />
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="size-3 opacity-50" />
                          <span className="text-sm">
                            {formatDate(user.created_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-background border-l pr-4 text-right transition-colors group-hover:bg-muted/40">
                        {renderRoleAction(user)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this user?"
        description={`${deleteTarget?.full_name ?? deleteTarget?.email ?? "This user"} will lose access immediately. This can't be undone.`}
        confirmLabel="Delete User"
        destructive
        onConfirm={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
