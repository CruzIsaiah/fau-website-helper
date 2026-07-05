import { createClient } from "@supabase/supabase-js";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function shouldUseSupabase() {
  return process.env.NODE_ENV !== "test" && isSupabaseConfigured();
}

function missingSupabaseError() {
  const error = new Error("Supabase is not configured. Add Supabase environment variables to enable persistent auth and saved links.");
  error.status = 503;
  error.code = "missing_supabase_config";
  return error;
}

export function getSupabaseAuthClient() {
  if (!isSupabaseConfigured()) throw missingSupabaseError();
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseAdminClient() {
  if (!isSupabaseConfigured()) throw missingSupabaseError();
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
