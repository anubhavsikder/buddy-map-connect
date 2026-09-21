/* Browser-only Google Maps JavaScript API loader. */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    initWarbuddyMaps?: () => void;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaderPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Maps need a browser"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
    | string
    | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
    | string
    | undefined;

  if (!key) return Promise.reject(new Error("Map key missing"));

  loaderPromise = new Promise((resolve, reject) => {
    window.initWarbuddyMaps = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=initWarbuddyMaps` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    script.async = true;
    script.onerror = () => reject(new Error("Could not load the map"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export const NIGHT_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1b2030" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141821" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8d97ad" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2a3346" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#28303f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a4459" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#101521" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#39415a" }] },
];
