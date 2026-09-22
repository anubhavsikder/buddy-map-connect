import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Bus, Crosshair, Loader2, PictureInPicture2, Radio, Share2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import type { MapMarker } from "@/components/MapView";
import { useUser } from "@/hooks/useAuth";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { distanceMeters, formatAgo, formatDistance, bearing, compass } from "@/lib/geo";
import { fetchBuddies, sendPing, setSharing, type Buddy } from "@/lib/warbuddy";
import { ensureNotificationPermission } from "@/lib/alerts";
import { openPipTracker, pipSupported, type PipHandle } from "@/lib/pip";
import { planRoute, type RoutePlan } from "@/lib/directions.functions";
import { supabase } from "@/integrations/supabase/client";

const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Live Map — WARBUDDY" },
      { name: "description", content: "Track your buddies live on the WARBUDDY tactical map." },
      { property: "og:title", content: "Live Map — WARBUDDY" },
      { property: "og:description", content: "Track your buddies live on the WARBUDDY tactical map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapScreen,
});

function MapScreen() {
  const { user } = useUser();
  const [sharing, setSharingState] = useState(true);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [pip, setPip] = useState<PipHandle | null>(null);
  const { position, error } = useLiveLocation({ userId: user?.id ?? null, sharing });
  const getRoute = useServerFn(planRoute);

  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = () => {
      fetchBuddies(user.id)
        .then((rows) => active && setBuddies(rows))
        .catch(() => undefined);
    };
    load();
    const channel = supabase
      .channel("wb-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, load)
      .subscribe();
    const timer = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (position) list.push({ id: "me", label: "You", lat: position.lat, lng: position.lng, self: true });
    for (const b of buddies) {
      if (!b.location || !b.location.sharing) continue;
      list.push({
        id: b.profile.id,
        label: b.profile.display_name,
        lat: b.location.lat,
        lng: b.location.lng,
        stale: Date.now() - new Date(b.location.updated_at).getTime() > 5 * 60 * 1000,
      });
    }
    return list;
  }, [position, buddies]);

  const focused = buddies.find((b) => b.profile.id === focusId) ?? null;
  const focusDistance =
    position && focused?.location ? distanceMeters(position, focused.location) : null;

  useEffect(() => {
    if (!pip) return;
    pip.update({
      title: focusDistance != null ? formatDistance(focusDistance) : "—",
      subtitle: focused ? focused.profile.display_name : "No buddy selected",
    });
  }, [pip, focusDistance, focused]);

  async function togglePip() {
    if (pip) {
      pip.close();
      setPip(null);
      return;
    }
    if (!pipSupported()) {
      toast.error("Your browser can't show the floating tracker.");
      return;
    }
    const handle = await openPipTracker(
      {
        title: focusDistance != null ? formatDistance(focusDistance) : "—",
        subtitle: focused ? focused.profile.display_name : "No buddy selected",
      },
      () => setPip(null),
    );
    setPip(handle);
  }

  async function toggleSharing() {
    const next = !sharing;
    setSharingState(next);
    if (user) await setSharing(user.id, next).catch(() => undefined);
  }

  async function routeToFocused(mode: "TRANSIT" | "WALK" | "DRIVE") {
    if (!position || !focused?.location) return;
    setPlanning(true);
    setPlan(null);
    try {
      const result = await getRoute({
        data: {
          origin: position,
          destination: { lat: focused.location.lat, lng: focused.location.lng },
          mode,
        },
      });
      setPlan(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build directions.");
    } finally {
      setPlanning(false);
    }
  }

  async function ping(kind: "find" | "ring") {
    if (!user || !focused) return;
    try {
      await sendPing(user.id, focused.profile.id, kind);
      toast.success(kind === "ring" ? "Ringing their phone." : "Find request sent.");
    } catch {
      toast.error("Couldn't send that signal.");
    }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground">Loading map…</div>}>
          <MapView me={position} markers={markers} focusId={focusId} onSelect={setFocusId} />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4">
        <div className="pointer-events-auto wb-card flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-sm tracking-[0.2em] text-primary">WARBUDDY</p>
            <p className="text-xs text-muted-foreground">
              {error ? error : position ? "Live signal locked" : "Acquiring signal…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={togglePip} className="wb-btn wb-btn-ghost px-2" aria-label="Floating tracker">
              <PictureInPicture2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleSharing}
              className={`wb-btn px-2 ${sharing ? "wb-btn-primary" : "wb-btn-outline"}`}
              aria-label="Toggle location sharing"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-16 z-20 max-h-[58dvh] overflow-y-auto p-4">
        {focused ? (
          <div className="wb-card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{focused.profile.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {focusDistance != null ? formatDistance(focusDistance) : "no fix"} ·{" "}
                  {position && focused.location
                    ? compass(bearing(position, focused.location))
                    : "—"}{" "}
                  · {formatAgo(focused.location?.updated_at)}
                </p>
              </div>
              <button type="button" onClick={() => setFocusId(null)} className="wb-btn wb-btn-ghost px-2 text-xs">
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void routeToFocused("TRANSIT")} className="wb-btn wb-btn-primary text-xs">
                <Bus className="mr-1 h-4 w-4" /> Bus / Train
              </button>
              <button type="button" onClick={() => void routeToFocused("WALK")} className="wb-btn wb-btn-outline text-xs">
                Walk
              </button>
              <button type="button" onClick={() => void routeToFocused("DRIVE")} className="wb-btn wb-btn-outline text-xs">
                Drive
              </button>
              <button type="button" onClick={() => void ping("find")} className="wb-btn wb-btn-ghost text-xs">
                <Bell className="mr-1 h-4 w-4" /> Find me
              </button>
              <button type="button" onClick={() => void ping("ring")} className="wb-btn wb-btn-ghost text-xs">
                <Radio className="mr-1 h-4 w-4" /> Ring phone
              </button>
            </div>
            {planning && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Building the fastest way there…
              </p>
            )}
            {plan && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {formatDistance(plan.distanceMeters)} · {Math.round(plan.durationSeconds / 60)} min ·{" "}
                  {plan.mode.toLowerCase()}
                </p>
                <ol className="space-y-2">
                  {plan.steps.map((step, i) => (
                    <li key={i} className="text-sm">
                      <span className="text-foreground">{step.instruction || step.mode}</span>
                      {step.line && (
                        <span className="block text-xs text-accent">
                          {step.vehicle ?? "Transit"} {step.line}
                          {step.headsign ? ` → ${step.headsign}` : ""}
                          {step.departureStop ? ` · from ${step.departureStop}` : ""}
                          {step.arrivalStop ? ` · to ${step.arrivalStop}` : ""}
                          {step.numStops ? ` · ${step.numStops} stops` : ""}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div className="wb-card space-y-2 p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crosshair className="h-4 w-4 text-primary" /> Tap a buddy to track them.
            </p>
            <div className="flex flex-wrap gap-2">
              {buddies.map((b) => {
                const d = position && b.location ? distanceMeters(position, b.location) : null;
                return (
                  <button
                    key={b.profile.id}
                    type="button"
                    onClick={() => setFocusId(b.profile.id)}
                    className="wb-btn wb-btn-outline text-xs"
                  >
                    {b.profile.display_name} · {d != null ? formatDistance(d) : "—"}
                  </button>
                );
              })}
              {buddies.length === 0 && (
                <p className="text-xs text-muted-foreground">No buddies yet — add some from the Buddies tab.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
