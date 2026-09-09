# End dates, Activity, and connections

Open **Dashboard → End dates → Connections**. Saving credentials does not contact
a provider; **Sync now** imports dates. An end-date row opens the matching Activity
day, including deadlines, source links, reminders, and actual focus-session time.
The grid has year navigation, so dates in the next academic year remain reachable.

## Canvas LMS

1. In Canvas, open **Account → Settings → Approved Integrations** and create a
   personal access token, if your school permits it.
2. Enter your school's HTTPS root URL, such as `https://school.instructure.com`,
   and the token in FocusFlow. Do not include `/courses/...` or `/api/v1`.
3. Save, then sync. The authenticated planner feed supplies assignments, quizzes,
   discussions with due dates, and calendar events across your courses. Items
   without a due/end date are skipped. Submitted assignments remain date entries;
   an end date is not a completion tracker.

The provider uses the student's planner date when supplied, preserving individual
assignment overrides. API policy or expired/revoked tokens can prevent imports.
See [Canvas token documentation](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth)
and the [planner API](https://developerdocs.instructure.com/services/canvas/resources/planner).

## Google Calendar

For a **private calendar**, choose OAuth access token and use `primary` or the
calendar's ID. Obtain a token with scope
`https://www.googleapis.com/auth/calendar.events.readonly`. For an initial manual
setup, Google's [OAuth Playground](https://developers.google.com/oauthplayground/)
lets you enter that scope, authorize your account, exchange the authorization
code, and copy the access token into FocusFlow. For automatic refresh, use your
own OAuth client in Playground and add its client ID, client secret, and offline
refresh token under **Automatic Google token refresh** in Connections. Access
tokens without a refresh token still need manual replacement. This does not add
a built-in Google sign-in flow; setup is described in the [study and sync guide](study-and-sync.md).

For a **public calendar**, enable Google Calendar API in your Google Cloud
project, choose API key, and enter that key and a calendar ID from Google Calendar
**Settings → Integrate calendar**. API keys cannot unlock private calendars, and
`primary` requires an authenticated user. Key restrictions must permit Calendar
API calls from the backend; browser-referrer restrictions are not suitable for
these server requests.

Recurring events expand into individual occurrences. Timed events display in the
device's local timezone. All-day events retain a date-only end on the final day
of the event, correcting Google's exclusive end date. See the
[events API](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).

## Sync and storage

- Sync reads the past 30 days through the next 365 days. Manual sync is always
  available; the optional automatic setting runs every 15 minutes while the backend runs.
- All pages must succeed before any saved dates change. Network, authorization,
  malformed response, or rate-limit failures keep the previous list intact.
- Provider IDs prevent duplicate imports and allow changed titles and dates to
  update. Missing or cancelled imports in the recent/future window are removed.
  Imported dates older than 30 days remain as Activity history. Manual dates
  are never removed by provider sync.
- Disconnect deletes credentials and keeps imported dates. Provider-side token
  revocation is separate. Reconnecting and syncing reconciles recent/future dates.
- Credentials are encrypted with AES-256-GCM in SQLite; the local encryption key
  is stored beside the database as `<database>.integrations.key`, with owner-only
  permissions where supported. The key is gitignored and must remain alongside
  the database for credentials to survive a backup restore. This is local storage
  encryption, not protection from someone with access to both files.
- API settings responses contain only configuration and timestamps. Tokens are
  never returned to the renderer, placed in browser storage, or added to provider
  request URLs. Connection endpoints require a local client and a permitted app
  origin. Optional `FOCUSFLOW_FRONTEND_ORIGIN` allows another exact local app origin.
- Canvas requests require public HTTPS hosts, reject private IPv4 resolutions,
  and do not follow redirects or pagination links to another origin.

## Backend endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/integrations/deadlines` | Redacted connection status |
| PUT | `/api/integrations/deadlines/:provider` | Save settings and a credential |
| POST | `/api/integrations/deadlines/:provider/sync` | Import and reconcile dates |
| DELETE | `/api/integrations/deadlines/:provider` | Remove saved credentials |

Provider is `canvas` or `google`. Canvas settings are `baseUrl` and `credential`;
Google settings are `calendarId`, `authMode` (`accessToken` or `apiKey`), and
`credential`. Omitting the credential preserves it only when connection details
are unchanged. Mutations require `Content-Type: application/json`.

Tests use synthetic provider responses and temporary databases; live account
authentication must be verified with your own credentials through Connections.
