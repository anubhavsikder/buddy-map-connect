import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Users, Bus, BellRing } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WARBUDDY — find your friends, live on the map" },
      {
        name: "description",
        content:
          "WARBUDDY shows where your friends are in real time, how far away they are, and the exact bus or train route to reach them.",
      },
      { property: "og:title", content: "WARBUDDY — find your friends, live" },
      {
        property: "og:description",
        content:
          "Live friend map, distance tracking, transit directions and a ring-my-phone alert when someone is lost.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: MapPin, title: "Live map", text: "Everyone's position, updating as they move." },
  { icon: Users, title: "Your squad", text: "Add friends, accept requests, share on your terms." },
  { icon: Bus, title: "How to reach them", text: "Bus and train steps, stop by stop." },
  { icon: BellRing, title: "Ring their phone", text: "Alert a lost buddy with a loud signal." },
];

function Landing() {
  return (
    <main className="relative mx-auto min-h-screen max-w-lg overflow-hidden px-6 pb-16 pt-14">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative">
        <span className="text-xs uppercase tracking-[0.35em] text-primary">WARBUDDY</span>
        <h1 className="mt-4 text-[2.7rem] font-bold leading-[1.05]">
          Never lose your
          <br />
          people again.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          A live map of your friends, how far each one is, and the exact way to get to them — bus,
          train or on foot.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/auth" className="wb-btn wb-btn-primary w-full">
            Get started
          </Link>
          <Link to="/auth" className="wb-btn wb-btn-outline w-full">
            I already have an account
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="wb-card p-4">
              <Icon className="h-5 w-5 text-accent" />
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Location is only shared with friends you accept, and you can switch it off anytime.
        </p>
      </div>
    </main>
  );
}
