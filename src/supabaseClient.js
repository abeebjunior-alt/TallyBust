import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing Supabase env vars. Create a .env file from .env.example and restart the dev server."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// A second, isolated client used ONLY when the Admin creates or repairs a
// staff member's own login. It has its own storage key and never persists
// or auto-refreshes a session, so calling auth.signUp() on it to create a
// staff member's real (but invisible-to-them) account can never knock the
// Admin's own session out of the main `supabase` client above.
export const supabaseStaffAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "tallybust-staff-auth-scratch",
  },
});
