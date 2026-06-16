'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const DECISIONS = [
  { label: 'Accept', value: 'accepted', className: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500' },
  { label: 'Waitlist', value: 'waitlisted', className: 'bg-amber-500 hover:bg-amber-400 focus-visible:ring-amber-500' },
  { label: 'Reject', value: 'rejected', className: 'bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500' },
];

function getErrorMessage(error) {
  if (!error) return 'Unknown error.';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
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
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
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

function ReviewContent() {
  const searchParams = useSearchParams();
  const targetEmail = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [savingDecision, setSavingDecision] = useState(null);
  const [error, setError] = useState('');
  const [currentApplication, setCurrentApplication] = useState(null);
  const [initialUnreviewedCount, setInitialUnreviewedCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  const [history, setHistory] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // FIXED: Syncs counter by hitting the exact same endpoint data source as your directory page
  async function syncTrueQueueCount() {
    try {
      const res = await fetch('/api/review/search?query=');
      const data = await res.json();
      if (res.ok && Array.isArray(data.applications)) {
        // Filter out records exactly how the directory page handles them
        const pendingTotal = data.applications.filter((app) => {
          const s = app.status || 'pending';
          return s === 'pending' || s === 'in_review';
        }).length;
        setInitialUnreviewedCount(pendingTotal);
      }
    } catch (e) {
      console.error("Background counter sync failed:", e);
    }
  }

  function sanitizeApplicationObject(app) {
    if (!app) return null;
    let parsedData = app.application_data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {
        parsedData = {};
      }
    }
    return {
      ...app,
      application_data: parsedData || {}
    };
  }

  async function loadNextApplication({ keepReviewedCount = false, bypassHistoryPush = false } = {}) {
    setLoading(true);
    setError('');

    try {
      if (!bypassHistoryPush && currentApplication) {
        setHistory((prev) => [...prev, currentApplication]);
      }

      const response = await fetch('/api/review/next');
      const payload = await response.json();

      if (!response.ok) {
        throw payload.error || 'Failed to load application.';
      }

      let nextApplication = payload.application ?? null;

      if (!nextApplication) {
        setCurrentApplication(null);
        setCompleted(true);
        setLoading(false);
        // Sync total counts even on blank queues
        void syncTrueQueueCount();
        return;
      }

      setCurrentApplication(sanitizeApplicationObject(nextApplication));
      setCompleted(false);
      setLoading(false);
      
      // Override standard count assignment with unified directory tracker
      void syncTrueQueueCount();
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
      setCurrentApplication(null);
      setLoading(false);
      setCompleted(false);
    }
  }

  async function loadTargetApplicant(email) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/review/search?query=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch targeted applicant.');

      const found = data.applications?.find(app => app.applicant_email === email);

      if (!found) {
        throw new Error(`Could not find an applicant with email: ${email}`);
      }

      setCurrentApplication(sanitizeApplicationObject(found));
      setCompleted(false);
      
      void syncTrueQueueCount();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handlePrevious() {
    if (history.length === 0) return;

    const updatedHistory = [...history];
    const previousApp = updatedHistory.pop();

    setCurrentApplication(previousApp);
    setHistory(updatedHistory);
    setCompleted(false);
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/review/search?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.applications || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500); 

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  function handleSelectSearchResult(selectedApp) {
    if (currentApplication) {
      setHistory((prev) => [...prev, currentApplication]);
    }
    setCurrentApplication(sanitizeApplicationObject(selectedApp));
    setSearchQuery('');
    setSearchResults([]);
    setCompleted(false);
    void syncTrueQueueCount();
  }

  useEffect(() => {
    if (targetEmail) {
      void loadTargetApplicant(targetEmail);
    } else {
      void loadNextApplication({ keepReviewedCount: false, bypassHistoryPush: true });
    }
  }, [targetEmail]);

  async function submitDecision(decision) {
    if (!currentApplication || savingDecision) return;

    setSavingDecision(decision);
    setError('');

    try {
      const response = await fetch('/api/review/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentApplication.id, decision }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw payload.error || 'Failed to save decision.';
      }

      const updatedCurrentApp = {
        ...currentApplication,
        status: decision,
        _previous_session_decision: decision
      };

      setReviewedCount((currentCount) => currentCount + 1);
      setHistory((prev) => [...prev, updatedCurrentApp]); 
      setCurrentApplication(updatedCurrentApp);

      setTimeout(async () => {
        if (targetEmail) {
          // Instantly optimize client value calculation so it visually drops on click
          setInitialUnreviewedCount(prev => Math.max(0, prev - 1));
          setLoading(false);
        } else {
          await loadNextApplication({ keepReviewedCount: true, bypassHistoryPush: true });
        }
      }, 2000);

    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setSavingDecision(null);
    }
  }

  function getApplicantDisplayName(app) {
    if (!app) return 'Loading...';
    const metadata = app.application_data || {};
    
    const first = metadata.firstNameLegal || '';
    const last = metadata.lastNameLegal || '';
    const mergedName = `${first} ${last}`.trim();
    
    return mergedName || app.applicant_email || 'Anonymous Applicant';
  }

  const applicationData = currentApplication?.application_data;
  const isApplicationObject = applicationData && typeof applicationData === 'object' && !Array.isArray(applicationData);

  const rawStatus = 
    currentApplication?._previous_session_decision || 
    currentApplication?.status || 
    currentApplication?.application_data?.status || 
    'pending';

  const activeStatus = (rawStatus === 'in_review' || !rawStatus) ? 'pending' : rawStatus;
  const displayName = getApplicantDisplayName(currentApplication);

  if (loading && !currentApplication && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8">
        <div className="rounded-3xl border border-slate-200 bg-white/90 px-8 py-6 text-lg font-medium text-slate-700 shadow-xl shadow-slate-900/5 backdrop-blur">
          Loading application context details…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8 py-12">
        <section className="w-full max-w-4xl rounded-[2rem] border border-rose-200 bg-white p-8 shadow-2xl shadow-rose-950/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Error</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Could not load applicant lookup profile</h1>
          <pre className="mt-6 overflow-auto rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-rose-200 whitespace-pre-wrap break-words">
            {error}
          </pre>
          <Link
            href="/review/all"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Return to Directory List
          </Link>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <DashboardShell
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        searchResults={searchResults}
        handleSelectSearchResult={handleSelectSearchResult}
        initialUnreviewedCount={initialUnreviewedCount}
      >
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-2xl shadow-slate-900/5 flex flex-col items-center justify-center flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Done</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">All applications reviewed.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600 max-w-md">
            All primary entries sorted. Return to your directory list to view historical items.
          </p>
          <Link
            href="/review/all"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            ← Open Master Applicant Directory
          </Link>
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      isSearching={isSearching}
      searchResults={searchResults}
      handleSelectSearchResult={handleSelectSearchResult}
      initialUnreviewedCount={initialUnreviewedCount}
    >
      <div className="flex flex-1 items-stretch gap-8 w-full">
        <section className="flex-1 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-900/5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Applicant context</p>
                <div className="flex items-center gap-3 mt-3">
                  <h2 className="text-4xl font-semibold tracking-tight text-slate-900 capitalize">
                    {displayName}
                  </h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border transition shadow-sm ${
                    activeStatus === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    activeStatus === 'waitlisted' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    activeStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    Current Status: {activeStatus}
                  </span>
                </div>
                {displayName !== currentApplication?.applicant_email && (
                  <p className="text-xs font-medium text-slate-400 mt-1">{currentApplication?.applicant_email}</p>
                )}
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                <div className="text-sm font-medium text-slate-500">Submitted</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{formatDateTime(currentApplication?.created_at)}</div>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-600">
                Updating view state safely...
              </div>
            ) : null}

            <div className="mt-6 space-y-6">
              {isApplicationObject ? (
                Object.entries(applicationData).map(([key, value]) => {
                  if (key === 'status' || key === '_previous_session_decision') return null;
                  return (
                    <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
                      <dt className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{humanizeKey(key)}</dt>
                      <dd className="mt-3 text-base leading-7 text-slate-800">{renderFieldValue(value)}</dd>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base leading-7 text-amber-900">
                  <p className="font-semibold">Could not parse application data fields.</p>
                  <pre className="mt-3 overflow-auto rounded-xl bg-white/80 p-4 text-sm leading-6 text-amber-950 whitespace-pre-wrap break-words">
                    {String(applicationData)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex w-full items-center justify-between border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={history.length === 0}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous Application
            </button>

            <button
              type="button"
              onClick={() => void loadNextApplication({ keepReviewedCount: true, bypassHistoryPush: false })}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Next without action →
            </button>
          </div>
        </section>

        <aside className="w-[340px] rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-900/5 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Decision panel</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Choose a decision</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Select the outcome for this application. Making an evaluation auto-advances the stream queue.
              </p>
            </div>

            <div className="space-y-4">
              {DECISIONS.map((decision) => {
                const isSaving = savingDecision === decision.value;

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

            <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-900">Queue Operations Hint</p>
              <p className="mt-2">
                Searching manually or clicking "Next without action" lets you peek ahead without clearing the row out of the primary pool.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

function DashboardShell({ 
  children, 
  searchQuery, 
  setSearchQuery, 
  isSearching, 
  searchResults, 
  handleSelectSearchResult, 
  initialUnreviewedCount 
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col gap-6">
        
        <header className="flex w-full items-center justify-between gap-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-900/5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Application Review</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Pending applicants in queue: <strong className="text-slate-800">{initialUnreviewedCount}</strong>
              {" — "}
              <Link href="/review/all" className="text-blue-600 underline hover:text-blue-500 transition font-semibold">
                View All Applicants Directory →
              </Link>
            </p>
          </div>

          <div className="relative w-80">
            <input
              type="text"
              placeholder="Search name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition"
            />
            {isSearching && (
              <div className="absolute right-4 top-3.5 flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                Searching...
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-full max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
                {searchResults.map((app) => {
                  let data = app.application_data;
                  if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch { data = {}; }
                  }
                  const name = data?.firstNameLegal || data?.name || 'Applicant';
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectSearchResult(app)}
                      className="flex w-full flex-col rounded-xl px-4 py-2.5 text-left hover:bg-slate-50 transition"
                    >
                      <span className="text-sm font-semibold text-slate-900">{name}</span>
                      <span className="text-xs font-medium text-slate-500">{app.applicant_email}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">Initializing review channels...</div>
      </main>
    }>
      <ReviewContent />
    </Suspense>
  );
}