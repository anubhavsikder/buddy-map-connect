import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Radio } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useUser } from "@/hooks/useAuth";
import { formatAgo } from "@/lib/geo";
import {
  fetchBuddies,
  fetchPings,
  fetchProfiles,
  markPingsSeen,
  sendPing,
  type Buddy,
  type Ping,
  type Profile,
} from "@/lib/warbuddy";
import { ensureNotificationPermission, ringPhone, showNotification, vibrate } from "@/lib/alerts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({
    meta: [
      { title: "Signals — WARBUDDY" },
      { name: "description", content: "Ring a buddy's phone or send a find-me alert." },
      { property: "og:title", content: "Signals — WARBUDDY" },
      { property: "og:description", content: "Ring a buddy's phone or send a find-me alert." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignalsScreen,
});

type Ping = {
  id: string;
  from_user: string;
  to_user: string;
  kind: string;
  message: string | null;
  created_at: string;
};

function SignalsScreen() {
  const { user } = useUser();
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const rows = await fetchBuddies(user.id);
    setBuddies(rows);
    const { data } = await supabase
      .from("pings")
      .select("id, from_user, to_user, kind, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as Ping[];
    setPings(list);
    const ids = Array.from(new Set(list.flatMap((p) => [p.from_user, p.to_user])));
    setPeople(await fetchProfiles(ids));
  }, [user]);

  useEffect(() => {
    void ensureNotificationPermission();
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wb-signals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pings", filter: `to_user=eq.${user.id}` },
        (payload) => {
          const ping = payload.new as Ping;
          if (ping.kind === "ring") {
            ringPhone();
            toast.warning("A buddy is ringing your phone!");
            showNotification("WARBUDDY", "A buddy is ringing your phone!");
          } else {
            vibrate();
            toast.info(ping.kind === "find" ? "A buddy wants to find you." : "A buddy wants to meet.");
            showNotification("WARBUDDY", "A buddy is signalling you.");
          }
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  const nameOf = (id: string) =>
    people.find((p) => p.id === id)?.display_name ?? (id === user?.id ? "You" : "Buddy");

  async function fire(targetId: string, kind: "find" | "ring") {
    if (!user) return;
    try {
      await sendPing(user.id, targetId, kind);
      toast.success(kind === "ring" ? "Ringing their phone." : "Find request sent.");
      void load();
    } catch {
      toast.error("Couldn't send that signal.");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="px-4 pt-6">
        <p className="font-display text-sm tracking-[0.2em] text-primary">WARBUDDY</p>
        <h1 className="font-display text-2xl">Signals</h1>
      </header>

      <section className="px-4 pt-4">
        <h2 className="wb-label">Alert a buddy</h2>
        <ul className="mt-2 space-y-2">
          {buddies.map((b) => (
            <li key={b.profile.id} className="wb-card flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm">{b.profile.display_name}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void fire(b.profile.id, "find")} className="wb-btn wb-btn-outline text-xs">
                  <Bell className="mr-1 h-4 w-4" /> Find
                </button>
                <button type="button" onClick={() => void fire(b.profile.id, "ring")} className="wb-btn wb-btn-primary text-xs">
                  <Radio className="mr-1 h-4 w-4" /> Ring
                </button>
              </div>
            </li>
          ))}
          {buddies.length === 0 && (
            <p className="text-sm text-muted-foreground">Connect with buddies first.</p>
          )}
        </ul>
      </section>

      <section className="px-4 pt-6">
        <h2 className="wb-label">History</h2>
        <ul className="mt-2 space-y-2">
          {pings.map((p) => (
            <li key={p.id} className="wb-card px-4 py-3">
              <p className="text-sm">
                {p.from_user === user?.id
                  ? `You ${p.kind === "ring" ? "rang" : "pinged"} ${nameOf(p.to_user)}`
                  : `${nameOf(p.from_user)} ${p.kind === "ring" ? "rang you" : "pinged you"}`}
              </p>
              <p className="text-xs text-muted-foreground">{formatAgo(p.created_at)}</p>
            </li>
          ))}
          {pings.length === 0 && <p className="text-sm text-muted-foreground">No signals yet.</p>}
        </ul>
      </section>

      <BottomNav />
    </div>
  );
}
