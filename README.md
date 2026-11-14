# Task Tracker

A simple, local-first student task tracker. Courses, assignments, labs, quizzes and deadlines in one place, with imports from Brightspace calendars, PDFs and spreadsheets.

- Works offline and installs as an app (PWA) on Android and desktop Chrome
- All data stays in your browser (IndexedDB). No account, no server, nothing sent anywhere
- Light / dark mode

## Features

| Page | What it does |
|---|---|
| **Dashboard** | Due today, next 7 days, overdue and completed counts; today's and upcoming tasks; progress per course |
| **Tasks** | Grouped (Overdue / Today / This week / Later / Postponed) or flat list; search; filter by course, status, priority, type; sort |
| **Calendar** | Month view with course-coloured tasks; tap a day to see or add tasks |
| **Courses** | Add / edit / delete courses; each course page shows upcoming, overdue and completed work |
| **Completed** | History of finished tasks; search, filter, reopen, delete |
| **Import** | Calendar (.ics), PDF and spreadsheet (.xlsx / .csv), all through an editable review screen |
| **Settings** | Theme, date format, week start, JSON backup / restore, CSV export |

### Statuses

There are only two statuses you set yourself: **Completed** and **Postponed**. **Overdue** is worked out automatically: the due date/time has passed and the task isn't completed or postponed.

### Imports

Every import shows a review screen first. You can edit any row, untick what you don't want, skip whole courses, and add rows by hand. Nothing is saved until you click **Import selected**. Likely duplicates (same calendar ID, same course + title, or same title + date) are unticked automatically.

- **Calendar (.ics):** the most accurate option. Gives exact dates and times, and course codes are read from Brightspace names like `26F_CST8914_010 Accessible by Design`.
- **PDF:** works with text PDFs only.
  - *Calendar lists*, e.g. a Brightspace calendar printed with Chrome's **Save as PDF**.
  - *Course outlines* with a weekly schedule. Only items with a weight like `Lab 3 (4%)` are picked up. Week numbers become dates using the Week 1 start date, which is suggested from the outline when it has one. Undated items default to Saturday 11:59 pm. Dates worked out this way are marked **est.**
  - Image-only PDFs (scanned, or made with "Microsoft Print to PDF") have no text to read. The app says so instead of guessing.
- **Spreadsheet:** finds the header row, suggests the column mapping, and lets you change it.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

## Deploy (free, GitHub Pages)

The workflow in `.github/workflows/deploy.yml` builds and publishes the app on every push to `main`.

1. In the repo, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`, or re-run the workflow from the **Actions** tab.

The app is then live at `https://<username>.github.io/<repo-name>/`.

## Install on Android

1. Open the app link in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install** (some versions say **Install app**).
3. It opens full-screen from its icon and works offline.

On desktop Chrome, click the install icon at the right of the address bar.

## Back up and move your data

Data lives in each browser separately, so your phone and laptop don't share tasks automatically.

- **Back up:** Settings → **Export backup (JSON)**. Do this regularly.
- **Move to another device:** export the backup on one device, then open it on the other with Settings → **Restore backup** → **Merge**.
  - *Merge* adds what isn't there yet.
  - *Replace all* wipes the current data first, and asks you to confirm.
- **CSV:** Settings → **Export tasks (CSV)** gives a spreadsheet-friendly copy.

Clearing your browser's site data for this app deletes your tasks, so keep a backup.

## Known limitations

- No sync between devices yet. Use backup/restore.
- No reminders or notifications.
- Calendar has a month view only.
- PDF import needs text PDFs. Outline parsing relies on weights like `(4%)`, so unusual layouts may miss items; add those by hand in the review screen.
- Dates calculated from week numbers are estimates (marked **est.**) until you confirm or edit them.

## Project structure

```
src/
  types.ts            data types (Course, Task, Draft)
  db.ts               IndexedDB setup (Dexie)
  lib/
    tasks.ts          read/write helpers + overdue/grouping logic
    dates.ts          date helpers (dates stored as YYYY-MM-DD text)
    settings.ts       preferences in localStorage
    backup.ts         JSON backup/restore, CSV export
    parse/            importers: ics.ts, pdf.ts + pdfParse.ts, sheet.ts, common.ts
  components/         Layout, TaskRow, TaskEditor (form), ImportReview, modal/toasts
  pages/              Dashboard, Tasks, Calendar, Courses, Completed, Import, Settings
```
