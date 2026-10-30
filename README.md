# Foot Rehab

A small iPhone web app for a home foot-exercise program. It times every hold and rest, works one foot at a time, and keeps a history of the sessions you finish. History is stored on the phone only.

## Install on an iPhone

1. Open the site's address in Safari.
2. Tap **Share**, then **Add to Home Screen**. Leave **Open as Web App** on, then tap **Add**.
3. Open it from the new Home Screen icon. It runs full-screen and works offline after the first visit.

## Files

| File | What it holds |
| --- | --- |
| `exercises.js` | The program: stages, exercises, timings and instructions. Edit this file to add or change exercises. |
| `app.js` | Timer, screens, history and backup. No changes needed to add exercises. |
| `index.html` | Page shell and styles. |
| `sw.js` | Offline support. Loads the newest version when online and the saved copy when offline. |
| `manifest.webmanifest`, `icons/` | Home Screen name and icon. |

## Add or change an exercise

1. In `exercises.js`, copy an entry under `exercises` (for example `toe-spread`) and give it a new id. Set its name, sets, reps, hold time, instructions and the timed `rep` phases. The comment at the top of the file lists every field.
2. Add the id to a stage's `exercises` list. To make it an optional switch in Settings, add it to `extras` instead.
3. Commit and push. GitHub Pages republishes in about a minute, and the phone picks up the change the next time the app opens with a connection.

A misspelled id in a stage is skipped instead of breaking the app; the browser console shows a warning.

## History and backup

Sessions are saved in the app's own storage on the phone (`localStorage` keys `footrehab.history.v1` and `footrehab.settings.v1`). Each finished set is saved as you go, so an interrupted session still counts as partial. Nothing is uploaded.

Removing the app from the Home Screen can delete its storage. **History → Export backup** saves a JSON file; **Import backup** merges one back in without creating duplicates.

## Testing

Add `?speed=50` to the address to run every timer 50 times faster.
