'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function formatDateTime(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function AllApplicantsPage() {
  const router = useRouter();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'name-asc', 'name-desc'

  useEffect(() => {
    async function fetchAllApplicants() {
      try {
        setLoading(true);
        const res = await fetch('/api/review/search?query=');
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch applicants.');
        
        setApplicants(data.applications || []);
      } catch (err) {
        setError(err.message || 'Something went wrong while loading the list.');
      } finally {
        setLoading(false);
      }
    }
    void fetchAllApplicants();
  }, []);

  // UTILITY: Parses data safely to extract properties uniformly for layout operations
  function getParsedData(app) {
    let data = app?.application_data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = {};
      }
    }
    return data || {};
  }

  function extractApplicantName(app) {
    const data = getParsedData(app);
    
    if (data.firstNameLegal || data.lastNameLegal) {
      return `${data.firstNameLegal || ''} ${data.lastNameLegal || ''}`.trim();
    }
    if (data.name) return data.name;

    if (app?.applicant_email) {
      return app.applicant_email.split('@')[0];
    }
    return 'Anonymous';
  }

  function extractLastName(app) {
    const data = getParsedData(app);
    const lastName = data.lastNameLegal || '';
    if (lastName.trim()) return lastName.trim().toLowerCase();

    const fullName = data.name || '';
    if (fullName.trim()) {
      const parts = fullName.trim().split(' ');
      return parts[parts.length - 1].toLowerCase();
    }
    return 'anonymous';
  }

  // FIXED: Core clean category filter using the absolute root database column status
  const filteredApplicants = applicants.filter((app) => {
    const rawStatus = app.status || 'pending';
    const status = (rawStatus === 'in_review' || !rawStatus) ? 'pending' : rawStatus;
    
    if (filter === 'all') return true;
    return status === filter;
  });

  // Strict inline value evaluation guarantees row position updates reactively
  const sortedApplicants = [...filteredApplicants].sort((a, b) => {
    if (sortBy === 'date-desc') {
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      return timeB - timeA;
    }
    if (sortBy === 'date-asc') {
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      return timeA - timeB;
    }
    if (sortBy === 'name-asc') {
      const nameA = extractLastName(a);
      const nameB = extractLastName(b);
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'name-desc') {
      const nameA = extractLastName(a);
      const nameB = extractLastName(b);
      return nameB.localeCompare(nameA);
    }
    return 0;
  });

  function handleRowClick(applicant) {
    router.push(`/review?email=${encodeURIComponent(applicant.applicant_email)}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8">
        <div className="rounded-3xl border border-slate-200 bg-white/90 px-8 py-6 text-lg font-medium text-slate-700 shadow-xl shadow-slate-900/5 backdrop-blur">
          Loading live master applicant directory from Supabase...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8">
        <div className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl shadow-rose-950/5">
          <p className="text-sm font-semibold uppercase tracking-wider text-rose-600">Database Connection Error</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{error}</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-8 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        
        {/* HEADER AREA */}
        <header className="flex w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-900/5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Applicant Directory</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Total live database rows synchronized: <strong className="text-slate-800">{applicants.length}</strong>
            </p>
          </div>
          
          <Link
            href="/review"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2"
          >
            ← Back to Stream Review Queue
          </Link>
        </header>

        {/* CONTROLS, FILTERS & SORTING MENU */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {/* FIXED: All pill options now strictly evaluate counters against root row status attributes */}
            {['all', 'pending', 'accepted', 'waitlisted', 'rejected'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition border ${
                  filter === type
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {type} ({type === 'all' ? applicants.length : applicants.filter(a => {
                  const s = a.status || 'pending';
                  return ((s === 'in_review' || !s) ? 'pending' : s) === type;
                }).length})
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto">
            <label htmlFor="sort-select" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sort By:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-900/5 cursor-pointer"
            >
              <option value="date-desc">Submission Date (Newest First)</option>
              <option value="date-asc">Submission Date (Oldest First)</option>
              <option value="name-asc">Last Name (A → Z)</option>
              <option value="name-desc">Last Name (Z → A)</option>
            </select>
          </div>
        </div>

        {/* MAIN DATA TABLE PANEL */}
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/5">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">Applicant Name</th>
                  <th scope="col" className="px-6 py-4">Email Address</th>
                  <th scope="col" className="px-6 py-4">Submission Date</th>
                  <th scope="col" className="px-6 py-4 text-right">Review Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {sortedApplicants.length > 0 ? (
                  sortedApplicants.map((app) => {
                    const name = extractApplicantName(app);
                    const rawStatus = app.status || 'pending';
                    const status = (rawStatus === 'in_review' || !rawStatus) ? 'pending' : rawStatus;

                    return (
                      <tr 
                        key={app.id} 
                        onClick={() => handleRowClick(app)}
                        className="hover:bg-slate-50/70 transition cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-blue-600 group-hover:underline capitalize">
                          {name}
                        </td>
                        <td className="px-6 py-4 text-slate-500">{app.applicant_email}</td>
                        <td className="px-6 py-4 text-slate-500">{formatDateTime(app.created_at)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${
                            status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            status === 'waitlisted' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-base font-medium text-slate-400 bg-slate-50/30">
                      No matching database rows found for this category filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}