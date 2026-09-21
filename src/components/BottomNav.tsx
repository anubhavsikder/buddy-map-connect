import { Link } from "@tanstack/react-router";
import { Map, Users, Radio } from "lucide-react";

const items = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/buddies", label: "Buddies", icon: Users },
  { to: "/signals", label: "Signals", icon: Radio },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
