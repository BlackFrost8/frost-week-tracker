import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUNTIME_CONFIG_KEY = 'frost-week-tracker:supabase-config';

export type SupabaseConfig = { url: string; anonKey: string };

/**
 * Config resolves from two places, in order:
 *
 *  1. Build-time env (`.env` locally, repo secrets in CI) — the normal path.
 *  2. A runtime config saved in localStorage via the in-app Connect dialog.
 *
 * (2) exists so a already-deployed build can be pointed at a Supabase project
 * without rebuilding — useful the first time you set this up, and on a device
 * where you'd rather not touch the deploy pipeline.
 */
function readRuntimeConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    if (typeof parsed.url === 'string' && typeof parsed.anonKey === 'string') {
      if (parsed.url.trim() && parsed.anonKey.trim()) {
        return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
      }
    }
  } catch {
    // Corrupt or unavailable storage — fall through to env config.
  }
  return null;
}

export function saveRuntimeConfig(config: SupabaseConfig): void {
  localStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(config));
}

export function clearRuntimeConfig(): void {
  localStorage.removeItem(RUNTIME_CONFIG_KEY);
}

function resolveConfig(): SupabaseConfig | null {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  // Ignore the placeholder values shipped in .env.example.
  const envLooksReal =
    envUrl.startsWith('http') && !envUrl.includes('your-project-ref') && envKey.length > 20;

  if (envLooksReal) return { url: envUrl, anonKey: envKey };
  return readRuntimeConfig();
}

const config = resolveConfig();

export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isCloudConfigured = supabase !== null;

/** Shown in the Connect dialog so you can tell which project you're pointed at. */
export const activeProjectUrl = config?.url ?? null;
