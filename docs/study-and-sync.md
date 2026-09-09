# Study, research, and continuity

Open **Study & research** from the dashboard's Study schedule or the Notes tools
menu. The three sections are Workspaces, Active recall, and Backups & sync.

## Workspaces

Create a course or research project, then link notes, imported deadlines, and
existing focus sessions. Reading-list entries accept HTTP(S) links and have a
completion checkbox. Linking does not move or duplicate the underlying note.
Deleting a workspace removes its reading list and plan; notes, deadlines,
sessions, and flashcards remain, with cards becoming unassigned.

A study plan works backwards from a linked deadline, with total effort and a
daily maximum in minutes. It excludes the due day, respects the supplied start
date and local timezone, and rejects insufficient time instead of silently
overloading days. Existing plans are not overwritten. Deadline changes display a
warning; remove the old steps before regenerating. Complete blocks independently
of recording focus time.

## Active recall

Select note text and choose **Create recall card**, or create one from a glossary
definition. Edit the question and answer; no external AI service is involved.
Cards retain source-note links and can be grouped by workspace. The review queue
hides answers until revealed. Again schedules a 10-minute retry; Hard, Good, and
Easy schedule increasing day intervals. This is a simple SM-2-inspired scheduler,
not FSRS or a prediction of exam performance. It records review history and
rejects stale revisions to prevent duplicate reviews from concurrent windows.
See [the original SM-2 description](https://www.super-memory.com/english/ol/sm2.htm).

## GitHub setup

1. Create a **dedicated private repository**, initialized with a README.
2. Create a fine-grained GitHub token restricted to that repository with
   **Contents: read and write**.
3. In Backups & sync, enter the owner, repository, token, and a passphrase of at
   least 12 characters. Keep the passphrase somewhere you can recover it.
4. Save settings and choose **Sync now**. On another device, use the same
   repository and passphrase and select the GitHub copy on the first conflict.

The app writes only `focusflow/workspace.enc.json` on the repository's default
branch. GitHub's existing-file SHA check prevents silently replacing a concurrently
changed file. The encrypted payload is compressed JSON protected by AES-256-GCM
with a fresh nonce and a scrypt-derived key. GitHub sees file sizes and commit
times but not the workspace contents. See [GitHub's Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

Automatic sync checks every 15 minutes while the backend runs. It uploads local
changes when safe; remote changes require opening the app and syncing manually.
If both local and remote diverged from their last common snapshot, the app shows
a conflict. Resolution selects a **whole snapshot**, not a per-note merge:
keeping local archives the remote copy locally before upload, and using remote
archives the current local copy before restore. A stale conflict preview is
rejected. Failures leave the previous successful sync state available.

## Backups and restore drills

Local backups run daily while the backend is running, including without GitHub.
The latest 30 automatic snapshots are retained. Manual backups and recovery
copies are retained until removed outside the app. They live beside the database
in `<database>.backups/`, encrypted using `<database>.integrations.key`.
Back up that key as well if moving local snapshots; portable export is preferable
when transferring a backup to another device.

Use **Preview restore** for a restore drill: the backup is decrypted, schema
checked, and loaded into a temporary in-memory database to verify constraints and
references. Preview changes no live data. Restore verifies that the local
workspace still matches the preview, creates a recovery copy, and replaces data
in a transaction. Portable export/import provides the same content in a file
encrypted with a passphrase you choose. Encrypted files are limited to 32 MB;
decompressed snapshots are limited to 128 MB.

Snapshots include all domain tables: notes and versions, folders, links,
annotations, drawings, tasks/categories, reminders, focus history, deadlines,
glossary, workspaces and links, readings, study steps, cards, and review history.
They exclude API credentials, local connection settings, browser appearance
preferences, and unsaved/offline drafts. Save drafts and close other editing
windows before restoring; the active app reloads after a restore. Linked external
files/URLs are references, not downloaded attachments. Use the same app version
on devices because incompatible snapshot schemas are rejected.

## Calendar continuity

Canvas and Google connections now offer a 15-minute automatic-sync checkbox.
For Google, supply your own OAuth client and an offline refresh token in
**Automatic Google token refresh**. In OAuth Playground, use your own OAuth
credentials before authorizing the read-only Calendar scope. Access is refreshed
before calendar requests. Revoked tokens, school policy, or OAuth testing-mode
expiry may still require authorization again. Tokens stay encrypted on the local
device and are not synced to GitHub. See [Google's offline-access guidance](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

## Validation

Backend tests use temporary databases and simulated providers for planning,
reviews, encrypted round-trips, restore safety, and two-device conflicts. No
personal repository or account is contacted by tests. Use the connection UI to
verify your real credentials. Packaged Electron includes all new backend modules.
