"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/supabase/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

interface BrowserClientOptions {
  persistSession?: boolean;
}

export function createSupabaseBrowserClient(options?: BrowserClientOptions) {
  const persistSession = options?.persistSession ?? true;

  if (!persistSession) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
