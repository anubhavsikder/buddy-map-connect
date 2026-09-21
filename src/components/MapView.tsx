import { useEffect, useRef } from "react";
import { loadGoogleMaps, NIGHT_MAP_STYLE } from "@/lib/maps-loader";
import type { LatLng } from "@/lib/geo";

export type MapMarker = LatLng & {
  id: string;
  label: string;
  self?: boolean;
  stale?: boolean;
};

type Props = {
  me: LatLng | null;
  markers: MapMarker[];
  focusId?: string | null;
  onSelect?: (id: string) => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function MapView({ me, markers, focusId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());
  const didFit = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: me ?? { lat: 20.5937, lng: 78.9629 },
          zoom: me ? 15 : 4,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: NIGHT_MAP_STYLE,
        });
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [me]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    const seen = new Set<string>();
    for (const marker of markers) {
      seen.add(marker.id);
      const existing = markerRefs.current.get(marker.id);
      const icon = {
        path: maps.SymbolPath.CIRCLE,
        scale: marker.self ? 9 : 8,
        fillColor: marker.self ? "#f0b429" : marker.stale ? "#8d97ad" : "#a3e635",
        fillOpacity: 1,
        strokeColor: "#141821",
        strokeWeight: 3,
      };
      if (existing) {
        existing.setPosition({ lat: marker.lat, lng: marker.lng });
        existing.setIcon(icon);
      } else {
        const created = new maps.Marker({
          position: { lat: marker.lat, lng: marker.lng },
          map,
          icon,
          title: marker.label,
          label: {
            text: marker.label,
            color: "#f4f6fb",
            fontSize: "11px",
            fontWeight: "600",
            className: "",
          },
        });
        created.addListener("click", () => onSelect?.(marker.id));
        markerRefs.current.set(marker.id, created);
      }
    }

    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markerRefs.current.delete(id);
      }
    }

    if (!didFit.current && markers.length > 0) {
      didFit.current = true;
      if (markers.length === 1) {
        map.setCenter({ lat: markers[0]!.lat, lng: markers[0]!.lng });
        map.setZoom(15);
      } else {
        const bounds = new maps.LatLngBounds();
        markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
        map.fitBounds(bounds, 80);
      }
    }
  }, [markers, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const target = markers.find((m) => m.id === focusId);
    if (!target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(16);
  }, [focusId, markers]);

  return <div ref={containerRef} className="h-full w-full" />;
}
