import { NextResponse } from 'next/server';
import { TABLE_NAME, createSupabaseAdminClient } from '../../../../lib/supabase';

export async function GET(request) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 }
    );
  }

  let reviewerId = request.cookies.get('reviewer_session_id')?.value;
  let isNewSession = false;

  if (!reviewerId) {
    reviewerId = 'rev_' + crypto.randomUUID();
    isNewSession = true;
  }

  try {
    // 1. Run the RPC claim function first to lock the next row safely
    const { data, error: applicationError } = await supabase
      .rpc('get_and_claim_next_application', {
        reviewer_id: reviewerId,
        lock_timeout_minutes: 15
      });

    if (applicationError) {
      console.error("=== SERVER-SIDE APPLICATION RPC ERROR ===", applicationError);
      return NextResponse.json({ error: applicationError.message }, { status: 500 });
    }

    // 2. FIXED: Run a completely clean, un-bundled standalone count query.
    // This replicates exactly how the directory fetches rows, avoiding RPC transaction side-effects.
    const { count, error: countError } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      console.error("=== SERVER-SIDE COUNT ERROR ===", countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const nextApplication = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    const nextCount = count ?? 0;

    const response = NextResponse.json({
      count: nextCount,
      application: nextApplication,
    });

    if (isNewSession) {
      response.cookies.set('reviewer_session_id', reviewerId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
    }

    return response;

  } catch (err) {
    console.error("CRITICAL API FAILURE:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
