import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  destination: z.string().min(2).max(300),
  options: z.string().max(1500).default(""),
  startingPoint: z.string().max(300).default(""),
  buddyName: z.string().max(120).default(""),
  notes: z.string().max(600).default(""),
});

export type TravelPlanResult = { plan: string };

export const buildTravelPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<TravelPlanResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The travel planner is not configured yet.");

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const prompt = [
      `Destination: ${data.destination}`,
      data.startingPoint ? `Starting point: ${data.startingPoint}` : "Starting point: not given",
      data.buddyName ? `Meeting buddy: ${data.buddyName}` : "",
      `Available bus / train options the traveller listed: ${data.options || "none listed"}`,
      data.notes ? `Extra notes: ${data.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system:
        "You are WARBUDDY's travel guide. Using ONLY the transport options the traveller listed (plus short walks), " +
        "write a clear, friendly, personalised travel plan to the destination. " +
        "Structure it as: a one-line summary with rough total time, then numbered steps (which bus/train, where to board, " +
        "where to change, where to get off, approximate time per leg), then 2-3 short practical tips. " +
        "If the listed options cannot reasonably reach the destination, say so plainly and suggest what to check. " +
        "Keep it under 250 words, plain text, no markdown headings.",
      prompt,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const plan = (await result.text).trim();
    return { plan: plan || "Couldn't put a plan together from those options — try adding more detail." };
  });
