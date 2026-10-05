import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const env = getEnv();
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

export function getSupabaseClient(accessToken?: string): SupabaseClient {
  const env = getEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
  return client;
}

export async function callRpc<T>(functionName: string, params: Record<string, unknown>, accessToken?: string): Promise<T> {
  const client = getSupabaseClient(accessToken);
  const { data, error } = await client.rpc(functionName, params);
  if (error) throw new Error(error.message);
  return data as T;
}
