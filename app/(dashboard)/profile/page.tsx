"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, KeyRound, LogOut } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [locale, setLocale] = useState("en-US");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      setUser(user);

      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setFullName(data.full_name ?? "");
        setLocale(data.locale ?? "en-US");
      }
    }
    load();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    const { error } = await supabase
      .from("user_profiles")
      .update({ full_name: fullName, locale })
      .eq("id", user.id);

    setProfileMsg(error ? error.message : "Profile updated.");
    setSavingProfile(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Password updated.");
    setSavingPassword(false);
    setNewPassword("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) return null;

  const initials = (fullName || user.email || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-500 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Identity card */}
      <Card className="border shadow-md">
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
            <div>
              <p className="text-lg font-semibold">{fullName || "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {profile?.role ?? "viewer"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit name */}
      <Card className="border shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <CardTitle className="text-base">Personal Info</CardTitle>
          </div>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">Locale</Label>
              <select
                title="locale"
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="en-US">English (US)</option>
                <option value="am-ET">Amharic (AM)</option>
              </select>
            </div>
            {profileMsg && (
              <p className="text-sm text-muted-foreground">{profileMsg}</p>
            )}
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="border shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <CardTitle className="text-base">Change Password</CardTitle>
          </div>
          <CardDescription>Choose a strong password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>
            {passwordMsg && (
              <p className="text-sm text-muted-foreground">{passwordMsg}</p>
            )}
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Sign out */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Sign out</p>
          <p className="text-sm text-muted-foreground">
            Sign out of this device
          </p>
        </div>
        <Button variant="destructive" onClick={signOut} className="gap-2">
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
