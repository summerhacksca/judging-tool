'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COL_CREATED,
  COL_DATA,
  COL_STATUS,
  TABLE_NAME,
  hasSupabaseEnv,
  supabase,
} from '../../lib/supabase';

const DECISIONS = [
  { label: 'Accept', value: 'accepted', className: 'bg-green-600 hover:bg-green-700' },
  { label: 'Waitlist', value: 'waitlisted', className: 'bg-amber-500 hover:bg-amber-600' },
  { label: 'Reject', value: 'rejected', className: 'bg-red-600 hover:bg-red-700' },
];

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

function isUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'string' && isUrl(value)) {
    return (
      <a className="text-blue-600 underline break-all" href={value} rel="noreferrer" target="_blank">
        {value}
      </a>
    );
  }

  if (typeof value === 'string' && value.length > 200) {
    return <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-100 p-3">{value}</pre>;
  }

  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatError(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return JSON.stringify(error);
}

export default function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [currentApplication, setCurrentApplication] = useState(null);
  const [totalUnreviewed, setTotalUnreviewed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const loadNextApplication = useCallback(async ({ resetProgress }) => {
    setLoading(true);
    setError(null);

    const countResponse = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .is(COL_STATUS, null);

    if (countResponse.error) {
      setError(countResponse.error);
      setLoading(false);
      return;
    }

    const remaining = countResponse.count ?? 0;

    if (resetProgress) {
      setTotalUnreviewed(remaining);
    }

    if (remaining === 0) {
      setCurrentApplication(null);
      setCurrentIndex(0);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .is(COL_STATUS, null)
      .order(COL_CREATED, { ascending: true })
      .limit(1)
      .single();

    if (queryError) {
      setError(queryError);
      setLoading(false);
      return;
    }

    if (!data) {
      // If data is empty with no explicit error, RLS is likely blocking anon reads.
      // Fix in Supabase dashboard by disabling RLS or adding a permissive anon policy.
      setError({ message: 'No application row returned. Check RLS policies for anon access.' });
      setLoading(false);
      return;
    }

    setCurrentApplication(data);

    if (resetProgress) {
      setCurrentIndex(1);
    } else {
      setCurrentIndex((totalUnreviewed || remaining) - remaining + 1);
    }

    setLoading(false);
  }, [totalUnreviewed]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setError({
        message:
          'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add both values to .env.local.',
      });
      setLoading(false);
      return;
    }

    loadNextApplication({ resetProgress: true });
  }, [loadNextApplication]);

  const applicationData = useMemo(() => {
    return currentApplication?.[COL_DATA];
  }, [currentApplication]);

  const createdAt = useMemo(() => {
    const raw = currentApplication?.[COL_CREATED];

    if (!raw) {
      return 'Unknown date';
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? String(raw) : parsed.toLocaleString();
  }, [currentApplication]);

  const handleDecision = useCallback(async (decision) => {
    if (!currentApplication?.id) {
      setError({ message: 'Current application is missing required id.' });
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      // IMPORTANT: this writes to COL_STATUS. Ensure the status column exists and is writable for anon role.
      .update({ [COL_STATUS]: decision })
      .eq('id', currentApplication.id);

    if (updateError) {
      setError(updateError);
      setSaving(false);
      return;
    }

    await loadNextApplication({ resetProgress: false });
    setSaving(false);
  }, [currentApplication, loadNextApplication]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-8">
        <p className="text-lg text-slate-700">Loading applications…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-8">
        <div className="w-full rounded-xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-red-700">Failed to load review data</h1>
          <p className="mt-3 text-sm text-slate-600">Raw Supabase error message:</p>
          <pre className="mt-2 overflow-auto rounded bg-slate-100 p-4 text-sm text-slate-900">{formatError(error)}</pre>
          <button
            className="mt-6 rounded bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={() => loadNextApplication({ resetProgress: true })}
            type="button"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!currentApplication) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-8">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">All applications reviewed.</h1>
        </div>
      </main>
    );
  }

  const canRenderDataObject =
    applicationData !== null && typeof applicationData === 'object' && !Array.isArray(applicationData);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl gap-8 p-8">
      <section className="w-2/3 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Submitted: {createdAt}</p>
        <p className="mt-2 text-lg font-medium text-slate-900">
          Application {currentIndex} of {totalUnreviewed} unreviewed.
        </p>

        {canRenderDataObject ? (
          <dl className="mt-8 space-y-5">
            {Object.entries(applicationData).map(([key, value]) => (
              <div key={key} className="rounded border border-slate-200 bg-slate-50 p-4">
                <dt className="text-sm font-semibold uppercase tracking-wide text-slate-600">{formatLabel(key)}</dt>
                <dd className="mt-2 text-base text-slate-900">{renderValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">Could not parse application data.</p>
            <pre className="mt-3 overflow-auto rounded bg-white p-3 text-sm text-slate-900">{String(applicationData)}</pre>
          </div>
        )}
      </section>

      <section className="flex w-1/3 flex-col rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Decision</h2>
        <p className="mt-2 text-sm text-slate-600">Choose one option to review this application.</p>
        <div className="mt-8 flex flex-col gap-4">
          {DECISIONS.map((decision) => (
            <button
              key={decision.value}
              className={`w-full rounded-lg px-6 py-4 text-lg font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${decision.className}`}
              disabled={saving}
              onClick={() => handleDecision(decision.value)}
              type="button"
            >
              {saving ? 'Saving…' : decision.label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
