import { createClient } from '@supabase/supabase-js';

export const TABLE_NAME = 'application_submissions'; // update if different
export const COL_ID = 'id'; // update if different
export const COL_EMAIL = 'applicant_email'; // update if different
export const COL_DATA = 'application_data'; // update if different
export const COL_CREATED = 'created_at'; // update if different

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
