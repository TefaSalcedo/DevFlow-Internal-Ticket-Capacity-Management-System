export interface SupabaseEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function getSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON (or NEXT_PUBLIC_SUPABASE_ANON_KEY for legacy compatibility)"
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}
