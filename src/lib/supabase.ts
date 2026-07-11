import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// In a real production app for admin tasks (like inserting data bypassing RLS), 
// we would use a service_role key. Since this is an MVP, the anon key is fine 
// as long as RLS is either disabled for the tables or configured to allow inserts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
