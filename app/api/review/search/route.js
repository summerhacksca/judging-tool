import { NextResponse } from 'next/server';
import { TABLE_NAME, createSupabaseAdminClient } from '../../../../lib/supabase';

export async function GET(request) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase client.' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';

    let dbQuery = supabase.from(TABLE_NAME).select('*');

    if (query.trim() !== '') {
      // FIXED: Uses your true exact JSON schema camelCase string values
      dbQuery = dbQuery.or(
        `applicant_email.ilike.%${query}%,application_data->>firstNameLegal.ilike.%${query}%,application_data->>lastNameLegal.ilike.%${query}%`
      );
    } else {
      dbQuery = dbQuery.order('created_at', { ascending: false });
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Supabase Search Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applications: data || [] });
  } catch (err) {
    console.error('Search routing failure:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}