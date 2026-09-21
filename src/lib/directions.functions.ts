import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const inputSchema = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  mode: z.enum(["TRANSIT", "WALK", "DRIVE", "BICYCLE"]).default("TRANSIT"),
});

export type RouteStep = {
  mode: string;
  instruction: string;
  distanceMeters: number;
  line?: string | undefined;
  vehicle?: string | undefined;
  headsign?: string | undefined;
  departureStop?: string | undefined;
  arrivalStop?: string | undefined;
  departureTime?: string | undefined;
  arrivalTime?: string | undefined;
  numStops?: number | undefined;
};

export type RoutePlan = {
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  mode: string;
};

type GoogleStep = {
  travelMode?: string;
  distanceMeters?: number;
  navigationInstruction?: { instructions?: string };
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string };
      arrivalStop?: { name?: string };
      departureTime?: string;
      arrivalTime?: string;
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      vehicle?: { type?: string; name?: { text?: string } };
    };
  };
};

export const planRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<RoutePlan> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) {
      throw new Error("Maps service is not configured yet.");
    }

    const body: Record<string, unknown> = {
      origin: {
        location: {
          latLng: { latitude: data.origin.lat, longitude: data.origin.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: data.destination.lat, longitude: data.destination.lng },
        },
      },
      travelMode: data.mode,
      languageCode: "en",
      units: "METRIC",
    };
    if (data.mode === "DRIVE") body["routingPreference"] = "TRAFFIC_AWARE";

    const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.legs.steps.travelMode",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.navigationInstruction",
          "routes.legs.steps.transitDetails",
        ].join(","),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Routes request failed [${response.status}]: ${errorBody}`);
      throw new Error(`Route lookup failed [${response.status}]: ${errorBody}`);
    }

    const json = (await response.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        legs?: Array<{ steps?: GoogleStep[] }>;
      }>;
    };

    const route = json.routes?.[0];
    if (!route) {
      throw new Error("No route available between these two points.");
    }

    const steps: RouteStep[] = (route.legs ?? []).flatMap((leg) =>
      (leg.steps ?? []).map((step) => {
        const transit = step.transitDetails;
        const line = transit?.transitLine;
        return {
          mode: step.travelMode ?? "WALK",
          instruction:
            step.navigationInstruction?.instructions ??
            (line ? `Take ${line.nameShort ?? line.name}` : "Continue"),
          distanceMeters: step.distanceMeters ?? 0,
          line: line?.nameShort ?? line?.name,
          vehicle: line?.vehicle?.name?.text ?? line?.vehicle?.type,
          headsign: transit?.headsign,
          departureStop: transit?.stopDetails?.departureStop?.name,
          arrivalStop: transit?.stopDetails?.arrivalStop?.name,
          departureTime: transit?.stopDetails?.departureTime,
          arrivalTime: transit?.stopDetails?.arrivalTime,
          numStops: transit?.stopCount,
        };
      }),
    );

    return {
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: Number(String(route.duration ?? "0s").replace("s", "")) || 0,
      steps,
      mode: data.mode,
    };
  });
