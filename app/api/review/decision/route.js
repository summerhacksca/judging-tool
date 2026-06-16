import { NextResponse } from 'next/server';
import { COL_STATUS, TABLE_NAME, createSupabaseAdminClient } from '../../../../lib/supabase';

const VALID_DECISIONS = new Set(['accepted', 'waitlisted', 'rejected']);

export async function POST(request) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { id, decision } = body || {};

  if (!id || !VALID_DECISIONS.has(decision)) {
    return NextResponse.json({ error: 'Missing or invalid id/decision.' }, { status: 400 });
  }

  const { error } = await supabase.from(TABLE_NAME).update({ [COL_STATUS]: decision }).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to save decision.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
