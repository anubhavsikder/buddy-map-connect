import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Search, UserPlus, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useUser } from "@/hooks/useAuth";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { distanceMeters, formatAgo, formatDistance } from "@/lib/geo";
import {
  fetchBuddies,
  fetchFriendships,
  fetchProfiles,
  respondToRequest,
  searchPeople,
  sendFriendRequest,
  type Buddy,
  type Profile,
} from "@/lib/warbuddy";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/buddies")({
  head: () => ({
    meta: [
      { title: "Buddies — WARBUDDY" },
      { name: "description", content: "Connect with friends and see how far away they are." },
      { property: "og:title", content: "Buddies — WARBUDDY" },
      { property: "og:description", content: "Connect with friends and see how far away they are." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuddiesScreen,
});

type PendingRequest = { id: string; profile: Profile; incoming: boolean };

function BuddiesScreen() {
  const { user } = useUser();
  const { position } = useLiveLocation({ userId: user?.id ?? null, sharing: true });
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [rows, friendships] = await Promise.all([
      fetchBuddies(user.id),
      fetchFriendships(user.id),
    ]);
    setBuddies(rows);
    const pendings = friendships.filter((f) => f.status === "pending");
    const ids = pendings.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
    const profiles = await fetchProfiles(ids);
    setPending(
      pendings
        .map((f) => {
          const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
          const profile = profiles.find((p) => p.id === otherId);
          return profile ? { id: f.id, profile, incoming: f.addressee_id === user.id } : null;
        })
        .filter((r): r is PendingRequest => r !== null),
    );
  }, [user]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("wb-buddies")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(query, user.id)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  async function add(targetId: string) {
    if (!user) return;
    try {
      await sendFriendRequest(user.id, targetId);
      toast.success("Request sent.");
      setQuery("");
      setResults([]);
      void load();
    } catch {
      toast.error("Couldn't send that request.");
    }
  }

  async function respond(id: string, accept: boolean) {
    try {
      await respondToRequest(id, accept);
      void load();
    } catch {
      toast.error("Couldn't update that request.");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="px-4 pt-6">
        <p className="font-display text-sm tracking-[0.2em] text-primary">WARBUDDY</p>
        <h1 className="font-display text-2xl">Buddies</h1>
      </header>

      <section className="px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="wb-input pl-9"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {searching && <p className="pt-2 text-xs text-muted-foreground">Searching…</p>}
        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((p) => (
              <li key={p.id} className="wb-card flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <button type="button" onClick={() => void add(p.id)} className="wb-btn wb-btn-primary text-xs">
                  <UserPlus className="mr-1 h-4 w-4" /> Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 && (
        <section className="px-4 pt-6">
          <h2 className="wb-label">Requests</h2>
          <ul className="mt-2 space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="wb-card flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm">{r.profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.incoming ? "wants to connect" : "request sent"}
                  </p>
                </div>
                {r.incoming ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void respond(r.id, true)} className="wb-btn wb-btn-primary px-2">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => void respond(r.id, false)} className="wb-btn wb-btn-outline px-2">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => void respond(r.id, false)} className="wb-btn wb-btn-ghost text-xs">
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-4 pt-6">
        <h2 className="wb-label">Connected ({buddies.length})</h2>
        <ul className="mt-2 space-y-2">
          {buddies.map((b) => {
            const d = position && b.location ? distanceMeters(position, b.location) : null;
            return (
              <li key={b.profile.id} className="wb-card flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm">{b.profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">{formatAgo(b.location?.updated_at)}</p>
                </div>
                <span className="font-display text-sm text-accent">
                  {d != null ? formatDistance(d) : "—"}
                </span>
              </li>
            );
          })}
          {buddies.length === 0 && (
            <p className="text-sm text-muted-foreground">No buddies yet. Search above to connect.</p>
          )}
        </ul>
      </section>

      <BottomNav />
    </div>
  );
}
