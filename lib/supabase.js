import { createClient } from '@supabase/supabase-js';

export const TABLE_NAME = 'applications'; // update if different
export const COL_CREATED = 'application_created'; // update if different
export const COL_DATA = 'application_data'; // update if different
export const COL_STATUS = 'status'; // update if different

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example-anon-key';
export const hasSupabaseEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
