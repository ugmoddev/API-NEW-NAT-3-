# Proxy Switcher — Manifest V3

A local-only Chrome/Chromium extension for switching between proxy profiles with one global keyboard shortcut. It accepts `host:port` and `host:port:user:pass` entries, stores state in `chrome.storage.local`, and never sends proxy credentials to an external service.

## Features

- Import one or multiple `.txt` files at once, or paste multiple proxy profiles. Files are merged into one import batch and duplicate proxies are removed automatically.
- The **Paste proxies** button reads the clipboard and imports its contents directly; manual multiline editing remains available if clipboard access is unavailable.
- Supports HTTP, HTTPS, SOCKS4, and SOCKS5 profile labels. Chrome's proxy API uses `http` for both HTTP and HTTPS proxy endpoints; the UI preserves the selected profile type and clearly routes SOCKS4/SOCKS5 through their native schemes.
- Removes blank and duplicate entries.
- Global `Ctrl+Shift+X` (`MacCtrl+Shift+X` on macOS) command, avoiding the Windows print shortcut:
  - First press connects proxy #1.
  - Each next press clears the active Chrome proxy setting, advances the index, and connects the next profile.
  - After the last profile, the sequence wraps to proxy #1.
- Connect, disconnect, remove, and clear controls in the popup.
- Live `CONNECTED`, `DISCONNECTED`, and `ERROR` state persisted in the service worker's storage.
- Optional bounded auto-skip for profiles that fail to apply.
- Optional auto-connect of the last profile on Chrome startup.
- Optional **Auto Rotate after load + 1 second** mode. The extension waits for the active tab's `status: complete`, waits one additional second, disconnects the current profile, connects the next profile, and reloads the active tab. The next cycle starts only after that reload completes.
- A **Target tabs** selector lets you choose exactly which open tabs participate. Selected tabs are reloaded after switching and any selected tab finishing a load can trigger the next cycle. If no tab is checked, the currently active tab is used as the default.
- Proxy authentication through Manifest V3's `webRequestAuthProvider` flow.
- After a successful Connect or Switch action, the currently active tab is reloaded once, equivalent to pressing `F5`. Restricted `chrome://` and browser-internal pages are left unchanged.

## Install

1. Download or clone this project.
2. Open `chrome://extensions` in Chrome or Chromium.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the `proxy-switcher/` directory.
6. Open the extension popup and import a TXT file or paste proxy lines.
7. Confirm the command at `chrome://extensions/shortcuts`. If Chrome assigns a different shortcut or reports a conflict, click the shortcut field and set `Ctrl+Shift+X` manually.
8. Press `Ctrl+Shift+X` from any tab, including when the popup is closed or another site is active. After connection, the selected target tabs are automatically refreshed.

## Proxy format

```text
127.0.0.1:8080
192.168.1.10:3128:admin:123456
```

One entry per line. A line must contain either two fields (`host:port`) or four fields (`host:port:username:password`). Passwords are retained locally because Chrome must receive them for an authentication challenge; they are not logged or uploaded.

## Source layout

```text
proxy-switcher/
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
├── modules/
│   ├── proxy-manager.js
│   ├── proxy-parser.js
│   ├── storage.js
│   └── auth.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

The service worker is the only owner of proxy state and switching. The popup is a view/controller that sends messages to it, so closing the popup cannot reset state. A successful `chrome.proxy.settings.set` callback is required before the UI reports `CONNECTED`; failures are shown as `CONNECTION FAILED`, while authentication challenges are surfaced as `AUTHENTICATION FAILED` where Chrome exposes the proxy error.

## Permissions

The extension requests `proxy`, `storage`, `tabs`, `webRequest`, and `webRequestAuthProvider`, plus `<all_urls>` host access. The proxy permission is required to apply fixed-server settings, storage persists the local state, `tabs` observes/reloads the active tab, and the webRequest permissions handle proxy credentials and authentication errors. `<all_urls>` is required because authentication challenges can come from any site visited through the selected proxy.

If Chrome shows **Service worker registration failed**, replace the old unpacked folder with the latest `proxy-switcher/` folder, then use **Reload** on `chrome://extensions`. The updated manifest includes the host permission and corrected webRequest listener registration.
