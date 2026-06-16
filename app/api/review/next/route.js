import { NextResponse } from 'next/server';
import { COL_CREATED, TABLE_NAME, createSupabaseAdminClient } from '../../../../lib/supabase';

export async function GET() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 }
    );
  }

  // REMOVED .is(COL_STATUS, null) from both queries below
  const [{ count, error: countError }, { data, error: applicationError }] = await Promise.all([
    supabase.from(TABLE_NAME).select('*', { count: 'exact', head: true }),
    supabase
      .from(TABLE_NAME)
      .select('*')
      .order(COL_CREATED, { ascending: true })
      .limit(1)
      .single(),
  ]);

  if (countError) {
    console.error("=== SERVER-SIDE COUNT ERROR ===", countError);
    return NextResponse.json({ error: countError.message || 'Failed to count applications.' }, { status: 500 });
  }

  if (applicationError && applicationError.code !== 'PGRST116') {
    return NextResponse.json(
      { error: applicationError.message || 'Failed to load the next application.' },
      { status: 500 }
    );
  }

  const nextApplication = data ?? null;
  const nextCount = count ?? 0;

  return NextResponse.json({
    count: nextCount,
    application: nextApplication,
  });
}