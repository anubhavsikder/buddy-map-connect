import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Route as RouteIcon, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useUser } from "@/hooks/useAuth";
import { fetchBuddies, type Buddy } from "@/lib/warbuddy";
import { buildTravelPlan } from "@/lib/travelplan.functions";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Travel Plan — WARBUDDY" },
      {
        name: "description",
        content: "Get a personalised bus and train plan to reach your destination or your buddy.",
      },
      { property: "og:title", content: "Travel Plan — WARBUDDY" },
      {
        property: "og:description",
        content: "Get a personalised bus and train plan to reach your destination or your buddy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanScreen,
});

function PlanScreen() {
  const { user } = useUser();
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [destination, setDestination] = useState("");
  const [startingPoint, setStartingPoint] = useState("");
  const [options, setOptions] = useState("");
  const [notes, setNotes] = useState("");
  const [buddyName, setBuddyName] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const makePlan = useServerFn(buildTravelPlan);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchBuddies(user.id)
      .then((rows) => active && setBuddies(rows))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (destination.trim().length < 2) {
      toast.error("Tell me where you're heading.");
      return;
    }
    setLoading(true);
    setPlan(null);
    try {
      const result = await makePlan({
        data: {
          destination: destination.trim(),
          startingPoint: startingPoint.trim(),
          options: options.trim(),
          notes: notes.trim(),
          buddyName,
        },
      });
      setPlan(result.plan);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't build a plan right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="px-4 pt-6">
        <p className="font-display text-sm tracking-[0.2em] text-primary">WARBUDDY</p>
        <h1 className="font-display text-2xl">Travel plan</h1>
        <p className="text-xs text-muted-foreground">
          Give your destination and the buses or trains you can take — you'll get a step-by-step plan.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4 px-4 pt-5">
        <div>
          <label className="wb-label" htmlFor="destination">
            Destination
          </label>
          <input
            id="destination"
            className="wb-input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Central Station, Sector 5"
          />
        </div>

        <div>
          <label className="wb-label" htmlFor="start">
            Starting point (optional)
          </label>
          <input
            id="start"
            className="wb-input"
            value={startingPoint}
            onChange={(e) => setStartingPoint(e.target.value)}
            placeholder="Home, Park Street"
          />
        </div>

        <div>
          <label className="wb-label" htmlFor="options">
            Bus / train options you have
          </label>
          <textarea
            id="options"
            rows={4}
            className="wb-input"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder={"Bus 21A every 15 min\nMetro blue line until 10pm\nLocal train to North Junction"}
          />
        </div>

        {buddies.length > 0 && (
          <div>
            <label className="wb-label" htmlFor="buddy">
              Meeting a buddy? (optional)
            </label>
            <select
              id="buddy"
              className="wb-input"
              value={buddyName}
              onChange={(e) => setBuddyName(e.target.value)}
            >
              <option value="">No one in particular</option>
              {buddies.map((b) => (
                <option key={b.profile.id} value={b.profile.display_name}>
                  {b.profile.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="wb-label" htmlFor="notes">
            Anything else (optional)
          </label>
          <input
            id="notes"
            className="wb-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Need to arrive before 7pm, carrying luggage"
          />
        </div>

        <button type="submit" disabled={loading} className="wb-btn wb-btn-primary w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working out the best way…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" /> Build my plan
            </>
          )}
        </button>
      </form>

      {plan && (
        <section className="px-4 pt-6">
          <div className="wb-card space-y-2 p-4">
            <p className="flex items-center gap-2 font-display text-sm text-primary">
              <RouteIcon className="h-4 w-4" /> Your plan
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{plan}</p>
          </div>
        </section>
      )}

      <BottomNav />
    </div>
  );
}
