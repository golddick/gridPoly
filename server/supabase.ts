import { createClient } from "@supabase/supabase-js";

export const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Verifies a Supabase access token and returns the authenticated user, or null. */
export async function verifySupabaseToken(token: string) {
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
