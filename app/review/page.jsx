'use client';

import { useEffect, useState } from 'react';

const DECISIONS = [
  { label: 'Accept', value: 'accepted', className: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500' },
  { label: 'Waitlist', value: 'waitlisted', className: 'bg-amber-500 hover:bg-amber-400 focus-visible:ring-amber-500' },
  { label: 'Reject', value: 'rejected', className: 'bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500' },
];

function getErrorMessage(error) {
  if (!error) {
    return 'Unknown error.';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.details) {
    return error.details;
  }

  if (error.hint) {
    return error.hint;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function humanizeKey(key) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isHttpUrl(value) {
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

function renderFieldValue(value) {
  if (typeof value === 'string') {
    if (isHttpUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4 transition hover:text-slate-700 hover:decoration-slate-500"
        >
          {value}
        </a>
      );
    }

    if (value.length > 200) {
      return (
        <pre className="max-h-40 overflow-auto rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">
          {value}
        </pre>
      );
    }

    return <span className="text-slate-700">{value}</span>;
  }

  if (Array.isArray(value)) {
    return <span className="text-slate-700">{value.map((item) => String(item)).join(', ')}</span>;
  }

  if (value && typeof value === 'object') {
    return (
      <pre className="max-h-40 overflow-auto rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span className="text-slate-700">{String(value)}</span>;
}

export default function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [savingDecision, setSavingDecision] = useState(null);
  const [error, setError] = useState('');
  const [currentApplication, setCurrentApplication] = useState(null);
  const [initialUnreviewedCount, setInitialUnreviewedCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  async function loadNextApplication({ keepReviewedCount = false } = {}) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/review/next');
      const payload = await response.json();

      if (!response.ok) {
        throw payload.error || 'Failed to load application.';
      }

      const nextCount = payload.count ?? 0;
      const nextApplication = payload.application ?? null;

      setInitialUnreviewedCount((previousCount) => (keepReviewedCount ? previousCount : nextCount));

      if (nextCount === 0 || !nextApplication) {
        setCurrentApplication(null);
        setCompleted(true);
        setLoading(false);
        return;
      }

      setCurrentApplication(nextApplication);
      setCompleted(false);
      setLoading(false);
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
      setCurrentApplication(null);
      setLoading(false);
      setCompleted(false);
    }
  }

  useEffect(() => {
    void loadNextApplication();
  }, []);

  async function submitDecision(decision) {
    if (!currentApplication || savingDecision) {
      return;
    }

    setSavingDecision(decision);
    setError('');

    try {
      const response = await fetch('/api/review/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentApplication.id,
          decision,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw payload.error || 'Failed to save decision.';
      }

      setReviewedCount((currentCount) => currentCount + 1);
      await loadNextApplication({ keepReviewedCount: true });
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setSavingDecision(null);
    }
  }

  const applicationData = currentApplication?.application_data;
  const isApplicationObject = applicationData && typeof applicationData === 'object' && !Array.isArray(applicationData);

  if (loading && !currentApplication && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8">
        <div className="rounded-3xl border border-slate-200 bg-white/90 px-8 py-6 text-lg font-medium text-slate-700 shadow-xl shadow-slate-900/5 backdrop-blur">
          Loading applications…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8 py-12">
        <section className="w-full max-w-4xl rounded-[2rem] border border-rose-200 bg-white p-8 shadow-2xl shadow-rose-950/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Error</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Could not load applications</h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            The website could not reach the review API. Use the raw message below to diagnose the issue.
          </p>
          <pre className="mt-6 overflow-auto rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-rose-200 whitespace-pre-wrap break-words">
            {error}
          </pre>
          <button
            type="button"
            onClick={() => void loadNextApplication()}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8">
        <section className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-2xl shadow-slate-900/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Done</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">All applications reviewed.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {initialUnreviewedCount > 0
              ? `You reviewed ${reviewedCount} application${reviewedCount === 1 ? '' : 's'} in total.`
              : 'There were no unreviewed applications to begin with.'}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl items-stretch gap-8">
        <section className="flex-1 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-900/5">
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Application card</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Review application</h1>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
              <div className="text-sm font-medium text-slate-500">Submitted</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatDateTime(currentApplication?.created_at)}</div>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-600">
              Loading next application…
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Progress</span>
            <span className="text-base font-semibold text-slate-900">
              Application {reviewedCount + 1} of {initialUnreviewedCount} unreviewed.
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {isApplicationObject ? (
              Object.entries(applicationData).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
                  <dt className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{humanizeKey(key)}</dt>
                  <dd className="mt-3 text-base leading-7 text-slate-800">{renderFieldValue(value)}</dd>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base leading-7 text-amber-900">
                <p className="font-semibold">Could not parse application data.</p>
                <pre className="mt-3 overflow-auto rounded-xl bg-white/80 p-4 text-sm leading-6 text-amber-950 whitespace-pre-wrap break-words">
                  {String(applicationData)}
                </pre>
              </div>
            )}
          </div>
        </section>

        <aside className="w-[340px] rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-900/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Decision panel</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Choose a decision</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Select the outcome for this application. The button text changes to Saving… while the update is in progress.
          </p>

          <div className="mt-8 space-y-4">
            {DECISIONS.map((decision) => {
              const isSaving = Boolean(savingDecision);

              return (
                <button
                  key={decision.value}
                  type="button"
                  onClick={() => void submitDecision(decision.value)}
                  disabled={Boolean(savingDecision)}
                  className={`flex w-full items-center justify-center rounded-2xl px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-slate-900/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${decision.className}`}
                >
                  {isSaving ? 'Saving…' : decision.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-900">Troubleshooting</p>
            <p className="mt-2">
              If the API route fails, the raw error will appear above. The browser never talks to Supabase directly.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
