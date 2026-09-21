import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
};

export type BuddyLocation = {
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  battery: number | null;
  sharing: boolean;
  updated_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
};

export type Buddy = {
  profile: Profile;
  friendshipId: string;
  location: BuddyLocation | null;
};

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, phone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Friendship[];
}

export async function fetchProfiles(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, phone")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchLocations(ids: string[]): Promise<BuddyLocation[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("locations")
    .select("user_id, lat, lng, accuracy, speed, battery, sharing, updated_at")
    .in("user_id", ids);
  if (error) throw error;
  return (data ?? []) as BuddyLocation[];
}

export async function fetchBuddies(userId: string): Promise<Buddy[]> {
  const friendships = await fetchFriendships(userId);
  const accepted = friendships.filter((f) => f.status === "accepted");
  const ids = accepted.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
  const [profiles, locations] = await Promise.all([fetchProfiles(ids), fetchLocations(ids)]);
  return accepted
    .map((f) => {
      const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
      const profile = profiles.find((p) => p.id === otherId);
      if (!profile) return null;
      return {
        profile,
        friendshipId: f.id,
        location: locations.find((l) => l.user_id === otherId) ?? null,
      } satisfies Buddy;
    })
    .filter((b): b is Buddy => b !== null);
}

export async function searchPeople(query: string, userId: string): Promise<Profile[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, phone")
    .or(`display_name.ilike.%${term}%,email.ilike.%${term}%`)
    .neq("id", userId)
    .limit(15);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function sendFriendRequest(userId: string, targetId: string) {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
  if (error) throw error;
}

export async function respondToRequest(friendshipId: string, accept: boolean) {
  if (accept) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
  }
}

export async function pushMyLocation(userId: string, payload: Partial<BuddyLocation>) {
  const { error } = await supabase.from("locations").upsert(
    {
      user_id: userId,
      lat: payload.lat ?? 0,
      lng: payload.lng ?? 0,
      accuracy: payload.accuracy ?? null,
      speed: payload.speed ?? null,
      battery: payload.battery ?? null,
      sharing: payload.sharing ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function setSharing(userId: string, sharing: boolean) {
  const { error } = await supabase.from("locations").update({ sharing }).eq("user_id", userId);
  if (error) throw error;
}

export async function sendPing(
  fromUser: string,
  toUser: string,
  kind: "find" | "ring" | "meet",
  message?: string,
) {
  const { error } = await supabase
    .from("pings")
    .insert({ from_user: fromUser, to_user: toUser, kind, message: message ?? null });
  if (error) throw error;
}
