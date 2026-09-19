# PlayVerse: setup and deployment (forms)

Time needed: about 30 minutes. Everything below is free-tier.

## Part A: Supabase (database and receipt storage)

1. Go to supabase.com and sign in. Click **New project**. Name it `playverse`, set a database password (save it somewhere), choose the region closest to Pakistan, and click **Create**. Wait about 2 minutes.
2. Open **SQL Editor > New query**. Paste the entire contents of `supabase/schema.sql` and click **Run**. You should see "Success. No rows returned".
3. Check it worked: **Table Editor** shows `games` with 5 rows, and **Storage** shows a private bucket called `receipts`.
4. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key. Never use the `service_role` key anywhere in this project.
5. Set the entry fees (until the CRM has its Games & fees page). In the SQL Editor run, with your real amounts:

```sql
update public.games set fee = 500 where slug = 'pubg';   -- per team
update public.games set fee = 300 where slug = 'tekken';
update public.games set fee = 300 where slug = 'fifa';
update public.games set fee = 300 where slug = 'mini-militia';
update public.games set fee = 300 where slug = 'mafia-wars';
```

The numbers above are placeholders. Until a fee is set, forms show "Fee to be announced".

## Part B: Connect the forms

Open `assets/config.js` and replace the two `PASTE_...` values with your Project URL and anon key. Optional: paste the event rules link into `RULES_URL`. Save the file.

## Part C: Deploy on Vercel

1. Create a free account at github.com. Click **New repository**, name it `playverse`, then **uploading an existing file**. Drag in the contents of the `playverse` folder (index.html, vercel.json, and the assets, register and supabase folders). Click **Commit changes**.
2. Go to vercel.com, sign in with GitHub, click **Add New > Project**, and import the `playverse` repository.
3. Set **Framework Preset** to **Other**. Leave Build Command and Output Directory empty. Click **Deploy**.
4. When it finishes, Vercel gives you a link like `playverse.vercel.app`. Your forms are at:
   - `/register/pubg`, `/register/tekken`, `/register/fifa`, `/register/mini-militia`, `/register/mafia-wars`

Any change you commit to GitHub redeploys automatically in about a minute.

## Part D: Test before sharing

1. Open each of the 5 form links on your phone and submit one test registration per game (use a fake roll number and a small JPG receipt).
2. In Supabase **Table Editor**, confirm rows appear in `registrations` and `participants`, and the file appears in **Storage > receipts**.
3. Submit the same roll number again to see the duplicate warning.
4. Clean up test data in the SQL Editor:

```sql
delete from public.registrations;
update public.reg_counters set last_value = 0;
```

Then delete the test files in **Storage > receipts** by hand. Real registrations will start at PV-...-0001.

## Part E: Before the event

- Optional custom domain: Vercel project > **Settings > Domains**.
- Free Supabase projects pause after 7 days without activity. Open the dashboard once before launch.
- The free plan has no scheduled backups. Export the data (CSV) daily during registration.
- The anon key is public by design. Data is protected by the database rules in `schema.sql`, so the public can submit but never read registrations.
