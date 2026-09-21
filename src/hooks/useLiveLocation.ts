import { useCallback, useEffect, useRef, useState } from "react";
import { pushMyLocation } from "@/lib/warbuddy";
import type { LatLng } from "@/lib/geo";

type Options = { userId: string | null; sharing: boolean };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useLiveLocation({ userId, sharing }: Options) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPush = useRef(0);
  const battery = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);

  useEffect(() => {
    const nav = navigator as any;
    if (nav.getBattery) {
      nav
        .getBattery()
        .then((b: any) => {
          battery.current = Math.round(b.level * 100);
        })
        .catch(() => undefined);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as any;
      if (nav.wakeLock && !wakeLock.current) {
        wakeLock.current = await nav.wakeLock.request("screen");
      }
    } catch {
      /* wake lock is a nice-to-have */
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!("geolocation" in navigator)) {
      setError("This device can't share location.");
      return;
    }

    void requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        setAccuracy(pos.coords.accuracy ?? null);
        const now = Date.now();
        if (now - lastPush.current > 8000) {
          lastPush.current = now;
          void pushMyLocation(userId, {
            ...next,
            accuracy: pos.coords.accuracy ?? null,
            speed: pos.coords.speed ?? null,
            battery: battery.current,
            sharing,
          }).catch(() => undefined);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisible);
      if (wakeLock.current) {
        void wakeLock.current.release?.();
        wakeLock.current = null;
      }
    };
  }, [userId, sharing, requestWakeLock]);

  return { position, accuracy, error };
}
