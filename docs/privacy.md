# Milestone 1 privacy

Milestone 1 runs locally without an account. It has no telemetry, advertising,
analytics, AI provider, remote content, update checker, cloud service or application
network request code. Production loads its renderer from local files, denies
remote session requests, and denies all permission requests and downloads.

Development (`npm run dev`) uses electron-vite's configured loopback HTTP server
and WebSocket for local development. That is the only network-origin exception;
it is not a cloud connection. Dependency installation on a fresh checkout is a
separate developer action and normally needs network access. No install or
dependency download was performed for this implementation.

## What it reads

- Cursor screen position for gaze, hit-test refresh and dragging, at 20 Hz or 60 Hz during capture.
- System idle duration every 30 seconds while visible and unpaused, for sleep/wake behaviour.
- Display work areas and primary display for placement, taskbar ground and recovery.
- The system reduced-motion preference for accessibility.
- Its own settings file and application version.

These are not application-awareness features. Ducky does not inspect the
foreground app, window titles, browser history, screen contents, screenshots,
keyboard input, clipboard, microphone, camera, files outside its settings path,
or personal documents. No awareness service or capture pipeline is present.

## What it stores or changes

`app.getPath('userData')/settings.json` (normally `%APPDATA%/Ducky/settings.json`)
contains basic settings, a first-launch greeting flag and the bottom-centre
screen position in DIP. The file is plain JSON, **not encrypted**. Writes are
debounced and replace the file using a temporary file and rename. Invalid fields
fall back to defaults; valid fields in a partial file survive.

Cursor samples, click counts, recent dialogue selections, current bubbles and
idle state are transient memory. They are not written as histories. Main logs
state transitions, recovery coordinates, release velocity and errors to the
console with `[ducky]`. The application does not deliberately save a log file;
a developer can capture console output separately.

Choosing Launch at startup calls Electron's Windows login-item API. The checkbox
does not grant other system access. Ducky moves its own window and creates its
own settings window and tray menu; it does not manipulate another application's
windows. Closing Settings leaves the tray application running. Quit stops the
timers, destroys windows/tray and flushes settings.

To reset stored information, quit Ducky and remove its `settings.json`. The next
launch uses defaults and repeats the greeting. If startup was enabled, turn the
checkbox off first; deleting JSON alone does not remove the Windows startup entry.
Electron can maintain normal runtime/cache files within its application data
directory; this build does not claim that its entire runtime writes only one file.

## Verification limits

The source contains no application network client. Request blocking, sandboxing,
IPC validation and local-file loading are implemented. No packet capture,
independent security audit, real desktop permission test or long-duration privacy
audit was performed here. This document describes the implemented behaviour,
not an assurance that Electron or the operating system can never make a connection.
