# Hackathon Application Review Tool

This project is a standalone Next.js internal tool for reviewing hackathon applications one at a time.

## Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the repository root with:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

You can find these values in your Supabase project dashboard under **Project Settings → API**.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:3000/review`.

## Before you run

Verify these database assumptions in Supabase before using the app:

- Table name is `applications`.
- `application_created` stores the submission timestamp used for ordering oldest first.
- `application_data` stores the hacker form response payload as a JSON object.
- `status` exists and is writable by the anon role (`accepted`, `waitlisted`, `rejected` values are written).
- If any name differs, update constants in `lib/supabase.js`:
  - `TABLE_NAME`
  - `COL_CREATED`
  - `COL_DATA`
  - `COL_STATUS`

### RLS troubleshooting

If queries return empty data without a clear error, Row Level Security is likely blocking anon access. In Supabase, open the table and either disable RLS or add a permissive policy for the anon role.
