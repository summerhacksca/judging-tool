# Hackathon Application Review

This is a small internal Next.js app for reviewing hackathon applications one at a time. The browser talks only to the Next.js server, and the server talks to Supabase using the service role key.

## Install

```bash
npm install
```

## Environment

Copy [.env.local.example](.env.local.example) to [.env.local](.env.local) and fill in the Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

You can find the URL and keys in the Supabase dashboard under Project Settings > API.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is no longer required for this setup because the browser does not talk to Supabase directly.

Only the server uses `SUPABASE_SERVICE_ROLE_KEY`. The browser never sees it.

## Run locally

```bash
npm run dev
```

## Before you run

### Database schema

Verify the database schema matches the assumptions in [lib/supabase.js](lib/supabase.js):

- The table name is `application_submissions`.
- The created-at column is `created_at` and can be ordered ascending.
- The application payload lives in `application_data` as a JSON object.
- The applicant email is in `applicant_email`.
- The review decision lives in `status` and must be writable by authenticated users.
- If any of those names differ, update the constants at the top of [lib/supabase.js](lib/supabase.js).

### Row Level Security (RLS)

RLS can stay enabled as a backstop, but the app does not depend on browser-side database access anymore. The server-side API uses the service role key, which bypasses RLS. That means:

- the browser cannot reach Supabase directly
- the database is only accessed through your Next.js API routes
- RLS remains useful if the table is ever accessed some other way later

If you want, you can keep the table locked down with RLS enabled and no public policies, because the app’s server route is the only path in.

To enable it in Supabase, run:

```sql
alter table public.application_submissions enable row level security;
```

### Status column

If the `status` column does not exist, create it:

```sql
alter table public.application_submissions
add column status text null;
```

## What this project is

This app is a minimal reviewing surface for hackathon organizers. It is intentionally simple: no logins, no direct browser-to-Supabase calls, and no public database access from the frontend.
