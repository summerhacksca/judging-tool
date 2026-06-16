import { NextResponse } from 'next/server';
import { TABLE_NAME, createSupabaseAdminClient } from '../../../../lib/supabase';

export async function POST(request) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase configuration.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    
    // 1. CRITICAL GUARD: Extract the exact payload parameters sent by page.jsx
    const id = body?.id;
    const decision = body?.decision;

    // 2. DEFENSE: If either parameter is missing, stop it BEFORE it reaches Supabase
    if (!id || !decision) {
      console.error("=== INVALID DECISION PAYLOAD ===", body);
      return NextResponse.json(
        { error: `Missing parameters. Received id: ${id}, decision: ${decision}` },
        { status: 400 }
      );
    }

    // 3. Update the row status dynamically
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({ 
        status: decision // Updates 'status' column to 'accepted', 'waitlisted', or 'rejected'
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error("=== SUPABASE UPDATE ERROR ===", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: data });
  } catch (err) {
    console.error("=== CRITICAL ROUTE CRASH ===", err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}