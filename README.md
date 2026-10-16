# NoXcuse

**No excuse. Or fail.**

Pomodoro timer with task management. No fluff, just work.

## Features

- **LED dial timer**: focus sessions (default 25 min), then pick a short break, a long break or skip. Break mode turns blue.
- **Daily target**: the session strip fills toward your target (default 8). Sessions past it count as overtime and turn red.
- **Now + Up next**: the first open task is what you're working on. Every finished session is recorded against it.
- **Tasks**: subtasks, inline editing (double-click), drag to reorder, "Archive N done".
- **Backlog**: park tasks for later and send them to Today when you're ready.
- **Calendar**: per-day timeline of when each session ran (hover a block to see the time and task), monthly stats, streak and the last 14 days.
- **Archive**: completed tasks grouped by day, month or year, with search and restore.
- **Settings**: timer lengths, daily target, sound, auto-start break, browser notifications, theme (system/light/dark), timezone, export/import/reset.
- **Responsive**: desktop, tablet and mobile (bottom tab bar, touch drag).
- **Multi-tab safe**: timer, tasks and settings stay in sync across open tabs.
- **Local storage**: all data stays in your browser.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Start / pause |
| `R` | Reset timer |
| `S` | Stop (focus) · skip (break) |
| `1` `2` `3` | Short break · long break · skip (after a session) |
| `N` | New task |
| `T` `C` `A` | Timer · Calendar · Archive |
| `B` | Backlog |
| `,` | Settings |
| `?` | All shortcuts |
| `Esc` | Close panel |

## Usage

**Online:** https://noxcuse.nairpaa.me

**Run locally:** the app uses ES modules, so serve the folder over HTTP rather than opening `index.html` directly:

```bash
git clone https://github.com/nairpaa/noxcuse.git
cd noxcuse
python3 -m http.server 8000   # then open http://localhost:8000
```

**Rebuild CSS** after editing `css/input.css` (requires the [Tailwind CLI](https://tailwindcss.com/docs/installation/tailwind-cli)):

```bash
./tailwindcss -i css/input.css -o css/output.css --minify
```

## Project structure

```
index.html            app shell
css/input.css         styles and light/dark theme tokens (source)
css/output.css        built stylesheet
js/app.js             app state, timer engine, cross-tab sync
js/store.js           localStorage persistence and v1 → v2 migration
js/dates.js           timezone-aware date helpers
js/sound.js           session beeps and browser notifications
js/icons.js           Lucide icons
js/views/             desktop/tablet and mobile views
js/vendor/            Preact 10.24.3 and htm 3.1.1 (vendored, no build step)
```

## Data

Data from earlier versions (`noxcuse_*` keys) is migrated automatically on first load. The old keys are left untouched as a backup. Session counts recorded before the redesign show up in the calendar totals, but they have no time of day.

Use **Settings → Export** to back up your data as JSON, and **Import** to restore it on another browser or device.

## License

This project is open source and available under the [MIT License](LICENSE).

Feel free to use, modify, and distribute. Contributions are welcome!
