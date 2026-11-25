# Development

Use Windows 10/11 and Node.js 24. This workspace already contains dependencies;
do not reinstall them to run the prototype. On a fresh connected checkout, setup
is `npm install`. Package versions remain pinned as supplied.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | electron-vite development build and local renderer server |
| `npm run typecheck` | Strict TypeScript check, including tests |
| `npm test` | Pure/core and local store tests, no Electron app |
| `npm run build` | CommonJS main/preload and local renderer assets under `out/` |
| `npm start` | electron-vite preview |
| `npm run start:debug` | Launch existing build using `electron . --debug-hitbox` |
| `npm run pack:win` | Build, then offline Windows directory packaging |

For a production-style run use `npm run build && npm start` in PowerShell 7 or cmd;
run each command separately in Windows PowerShell 5.1. For the debug overlay, build
then use `npm run start:debug`. The generated application can also be started as:

```powershell
& .\release\win-unpacked\Ducky.exe --debug-hitbox
```

The app's single-instance lock applies to all copies using the same identity.
Quit an existing instance before expecting a new debug flag to take effect.
The second instance tells the first to show Ducky, and focuses Settings if open.

## Source changes

Keep pure behaviour/physics/dialogue policy in `src/core`, independent of Electron.
Keep settings and incoming IPC validation in `src/shared/schemas`; adding a channel
also requires a narrow preload method, an authorized main handler and tests.
Do not expose raw `ipcRenderer`, paths, shell execution, or arbitrary channel names.

Only the animation adapter may access its SVG DOM. The companion renderer owns
HTML speech and pointer capture; it calls the adapter for geometry and artwork.
See the animation contract before changing poses or planning Rive.

Use screen DIP throughout. The physics position is a **bottom-centre**, not a
BrowserWindow top-left coordinate. The renderer receives main's window origin,
avoiding physical-pixel conversions. Position persistence happens after meaningful
motion transitions, not each frame. Display restoration is conservative.

React settings use `createElement` in the existing `.ts` entry to preserve the
supplied build configuration and CSP without requiring an inline refresh preamble.
There are no CDN resources or external fonts. Main/preload are CommonJS; do not
introduce unsandboxed preload imports or split preload chunks requiring Node APIs.

## Debugging and lifecycle

`--debug-hitbox` faintly outlines painted duck hit shapes and the visible bubble.
Transparent padding has no outline and must pass clicks through. Main logs startup,
animation transitions, clicks, drag release, landing/settle, display recovery,
settings changes, visibility/pause and shutdown with `[ducky]`.
Cursor movement is not logged continuously.

Hide and Pause both stop motion/cursor/behaviour/idle timers. Hide also makes the
window invisible; Pause leaves a static idle. Native settings/tray commands still
work. Position and settings survive graceful Quit; transient pause/visibility do
not persist. `before-quit` clears timers/listeners/handlers, flushes JSON, destroys
the tray and windows, then allows Electron to exit normally.

Settings errors are caught and logged; invalid settings recover with defaults.
To exercise first launch, quit first, back up `settings.json`, then remove it or
set `firstLaunchDone` to false. Restore the backup after testing if desired.
Do not hand-edit the file while Ducky is running because its next write replaces it.

## Packaging offline

The build config uses app ID `com.ente.ducky`, product name `Ducky`, directory
target, `electronDist: node_modules/electron/dist`, `npmRebuild: false`, and
`signAndEditExecutable: false`. There are no native npm addons in this milestone.
This reuses installed binaries and avoids downloads for Electron or signing tools.
`release/` and `out/` are ignored build outputs. The unpacked directory includes
`Ducky.exe`, its runtime files, and `resources/app.asar`; keep them together.

No installer/signature was created. Offline directory packaging passed here; the
packaged application's desktop behaviour still needs the manual checklist.
No git commit was made as part of this job.
