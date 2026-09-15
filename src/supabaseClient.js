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

// NOTE: the isolated `supabaseStaffAuth` client (used for calling
// auth.signUp() directly from the browser to create staff accounts) has
// been removed. Staff account creation now goes through the
// create-staff-account Edge Function, which uses the service-role key —
// never exposed to the client — and authenticates the caller as the
// business Owner before creating anything. See SECURITY-REVIEW.md.
