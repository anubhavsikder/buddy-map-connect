import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to WARBUDDY — live friend tracking" },
      {
        name: "description",
        content:
          "Create your WARBUDDY account with email or Google to share live location with friends and get transit directions to them.",
      },
      { property: "og:title", content: "Sign in to WARBUDDY" },
      {
        property: "og:description",
        content: "Join your squad, share live location and find each other fast.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/map", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void navigate({ to: "/map", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your inbox to verify your email.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in didn't work. Try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/map", replace: true });
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <Mail className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Open it,
          then come back and sign in.
        </p>
        <button
          className="wb-btn wb-btn-ghost"
          onClick={() => {
            setSent(false);
            setMode("signin");
          }}
        >
          Back to sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div>
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-primary">
          WARBUDDY
        </Link>
        <h1 className="mt-3 text-3xl font-bold">
          {mode === "signup" ? "Create your squad account" : "Welcome back, buddy"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verified accounts only — so you always know who is on your map.
        </p>
      </div>

      <button onClick={handleGoogle} disabled={busy} className="wb-btn wb-btn-outline w-full">
        <ShieldCheck className="h-4 w-4 text-accent" /> Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or use email{" "}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div>
            <label className="wb-label" htmlFor="name">
              Call sign
            </label>
            <input
              id="name"
              className="wb-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How friends see you"
            />
          </div>
        )}
        <div>
          <label className="wb-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="wb-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="wb-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="wb-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <button type="submit" disabled={busy} className="wb-btn wb-btn-primary w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        className="text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
      >
        {mode === "signup" ? "I already have an account" : "I need an account"}
      </button>
    </main>
  );
}
