# Tickwell — Counter Studio

A premium, local-first counter app. Count anything: reps, laps, goals, scores, countdowns, inventory.
Dark mode by default, light mode, installable, and it works offline.

**Live site:** https://imaogforniteplayer.github.io/counter-studio/ (see *Deployment* below for status)

## Features

- **Seven counter modes:** Normal, Countdown, Goal, Score (players), Tally (groups of five), Interval (automatic counting) and Multi (several sub-counters).
- **Counting:** big tap targets, hold to repeat, quick-add amounts, undo and redo per counter, full-screen mode, keep-screen-awake while counting full screen.
- **Organise:** multiple counters, folders, pinning, search, grid or list, drag to reorder, trash with restore.
- **Templates:** built-in ready-made counters, plus save your own.
- **Statistics:** time range and per-counter views, charts (activity over time, weekday, hour of day), streaks, goals reached, sessions, comparisons with the previous period.
- **History:** every change logged, searchable and filterable, revert a single change, export to CSV.
- **Tools:** stopwatch with laps, timer, dice, coin flip, random number, name picker/shuffle, tap tempo, pace calculator.
- **Data:** JSON backup export and import (merge or replace), CSV export, automatic daily restore points kept in the browser, and restore or reset.
- **Sharing:** share a counter as a link or QR code. The counter's settings are inside the link itself.
- **Customise:** accent colours (including custom), background styles or your own picture, number fonts, button shapes, card styles, compact mode, sounds, vibration, reduced motion.
- **Accessible:** keyboard shortcuts (press `?`), focus management in dialogs, screen-reader announcements, reduced-motion support.
- **PWA:** installable and available offline after the first visit.

## Honest limitations

- **No cloud sync and no accounts.** All data is stored in your browser (IndexedDB). It does not sync between devices. To move data, export a JSON backup and import it on the other device.
- Clearing site data in your browser deletes your counters and the in-browser restore points. Export a backup file if the data matters.
- **Share links contain the counter's data** (name, type, settings and current value) in the URL fragment. Anyone with the link can read it. They never include history or other counters. Very large counters can make long links and QR codes.
- **Interval counters only count while the page is open.** When you come back they do not backfill the time you were away.
- Vibration is not available in iOS browsers. Screen wake lock depends on browser support.

## Keyboard shortcuts

`Space`/`↑`/`+` add · `↓`/`-` subtract · `Z` undo · `Shift+Z`/`Y` redo · `R` reset · `F` full screen · `E` edit · `A` toggle auto-count · `[` `]` previous or next counter · `N` new counter · `Alt+1…7` pages · `?` help.

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm test
npm run build      # type check + production build
npm run preview
```

Stack: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, `qrcode`, `vite-plugin-pwa`, Vitest.

The router is hash-based (`#/counters`), so it works on GitHub Pages without server rewrites. The build base path is `/counter-studio/` and can be overridden with `VITE_BASE`.

## Deployment

`.github/workflows/deploy.yml` type-checks, runs the tests, builds, and deploys `dist/` to GitHub Pages on every push to `main`.
In the repository settings, **Pages → Build and deployment → Source** must be **GitHub Actions**.

## Licence

MIT
