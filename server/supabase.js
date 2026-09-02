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

function keyStatus(error) {
  if (!error) return { valid: true };
  if (error.message?.toLowerCase().includes("invalid api key")) {
    return { valid: false, message: "Invalid API key" };
  }
  return { valid: true };
}

export async function checkSupabaseKeys() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      anonKeyValid: false,
      serviceRoleKeyValid: false
    };
  }

  const auth = getSupabaseAuthClient();
  const admin = getSupabaseAdminClient();

  const [{ error: anonError }, { error: serviceError }] = await Promise.all([
    auth.auth.signInWithPassword({
      email: "supabase-key-check@example.com",
      password: "not-a-real-password"
    }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  ]);

  const anon = keyStatus(anonError);
  const serviceRole = keyStatus(serviceError);

  return {
    configured: true,
    projectRef: new URL(process.env.SUPABASE_URL).hostname.split(".")[0],
    anonKeyValid: anon.valid,
    serviceRoleKeyValid: serviceRole.valid,
    anonMessage: anon.message,
    serviceRoleMessage: serviceRole.message
  };
}
