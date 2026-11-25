# Ducky.exe

A local desktop companion by Ente. **Milestone 1 prototype: “Give Ducky a body.”**
A small animated SVG duck lives in a transparent Electron window, walks, follows
your cursor with his eyes, reacts to clicks, and can be dragged and dropped.
There is no AI, desktop awareness, sound, task manager, or network service in this milestone.

## Requirements and running

- Windows 10/11, Node.js 24, npm.
- The supplied project already has its dependencies installed. No install is needed in this workspace.
- For a fresh checkout, dependency setup is `npm install` (requires access to the package registry and Electron distribution).

```powershell
npm run dev
```

Development uses electron-vite's local loopback server. Production loads local files:

```powershell
npm run build && npm start
```

In Windows PowerShell 5.1, which does not support `&&`, run the two commands on separate lines.
For a built app with faint outlines of the actual interactive shapes:

```powershell
npm run build
npm run start:debug
```

`start:debug` runs `electron . --debug-hitbox`. The unpacked executable also accepts
`--debug-hitbox`. Main-process state changes are logged with `[ducky]`.

```powershell
npm test
npm run typecheck
npm run build
npm run pack:win
```

Packaging runs electron-builder with `--win --dir`, uses the already-installed
Electron distribution, and produces `release/win-unpacked/Ducky.exe`.
Offline directory packaging was verified. The executable is unsigned, uses the
default executable icon/metadata, and has **not been launched or desktop-tested here**.
Resource editing and signing are disabled to avoid downloading Windows signing tools.
There is no installer in M1.

## Controls

- Hover: suspicious eyes; move the cursor: eyes follow.
- Click: startled reaction and sometimes a short bubble. A 500 ms delay distinguishes a single click from a double-click.
- Repeated single clicks: escalating annoyance; five within four seconds makes Ducky angry. Space clicks about 600 ms apart to test this without double-clicking.
- Double-click: open Settings.
- Drag with the left button: pick up Ducky, then release to fall and bounce. Movement under 4 DIP counts as a click.
- Right-click the duck: native menu, with the same actions as the tray.
- Click a bubble: dismiss it. Bubbles otherwise disappear after at least three seconds.
- Left-click the tray icon: show/hide. Right-click it: Show, Hide, Pause/Resume, Mute/Unmute, Reset position, Settings, Quit.
- Idle for five minutes by default: sleep. Return: wake on the next idle poll (up to 30 seconds).

The companion window never intentionally takes keyboard focus. Opening Settings
is an explicit action and focuses its normal window. Transparent regions pass
clicks through; only the duck's painted shapes and a visible bubble interact.

Settings apply immediately. Desktop-only mode turns off always-on-top; it does not
attach Ducky to Explorer's wallpaper. Mute suppresses low-priority bubbles; direct
interaction replies and the first-launch greeting can still appear. Pause suppresses
all speech and freezes motion. Hide suspends the companion timers.

## Local files and quitting

Settings and the bottom-centre DIP position are stored in
`app.getPath('userData')/settings.json`, normally `%APPDATA%/Ducky/settings.json`
on Windows. This is plain, unencrypted JSON. Writes are debounced and use a temporary
file plus rename. Malformed or partial settings recover with validated defaults.

Choose **Quit** from the tray, the duck's context menu, or Settings to stop the
application and flush settings. Closing Settings leaves Ducky running in the tray.

See [status and limitations](docs/status.md), [architecture](docs/architecture.md),
[animation contract](docs/animation-contract.md), [privacy](docs/privacy.md),
[development](docs/development.md), and [desktop test checklist](docs/testing.md).
