# ProxyFlow

ProxyFlow is a Firefox-only desktop application for legitimate proxy connectivity, browser-session, and infrastructure QA testing. It does not automate clicks, impressions, advertising interactions, reward farming, CAPTCHA bypasses, rate-limit bypasses, or fingerprint evasion.

## Install

1. Install Python 3.12+.
2. Create an environment: `python -m venv .venv` and activate it.
3. Install dependencies: `pip install -r requirements.txt`.
4. Install Firefox for Playwright: `playwright install firefox`.
5. Copy `.env.example` to `.env` and set only approved test configuration.
6. Start: `python main.py`.

API keys are stored through the OS credential manager (with a protected local fallback); they are never placed in `.env`, SQLite plaintext columns, logs, or browser storage. Browser sessions launch Playwright Firefox with a fresh isolated context per proxy and never attach to a personal Firefox profile.

## CLI

`python main.py stats`, `fetch`, `test`, `run`, and `clean` are available for diagnostics. The GUI provides dashboard, proxy import, logs, API-key, session, and settings views.

## Tests

Run `pytest`. External APIs and real credentials are not required.
