# Security policy

This project is a static website with no backend, no database, no user accounts,
and no collection of personal data. The attack surface is small, but reports are
still welcome and appreciated.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for a
suspected vulnerability.

1. **Preferred:** use GitHub's private vulnerability reporting for this
   repository (the **Security → Report a vulnerability** tab). This keeps the
   report confidential until a fix is ready.
2. **Alternative:** email the maintainer at **errerlabs@gmail.com** with the
   subject line `SECURITY` so it can be triaged quickly.

When reporting, please include:

- a description of the issue and its potential impact,
- steps to reproduce (a URL or minimal example is ideal), and
- any relevant browser/OS details.

You can expect an acknowledgment within a few days. Please allow a reasonable
period to investigate and address the issue before any public disclosure.

## Scope

In scope:

- the published pages (`index.html`, `read.html`) and site configuration
  (`netlify.toml`), including response headers and Content-Security-Policy.

Out of scope:

- vulnerabilities in third-party hosting/infrastructure (e.g. Netlify) — report
  those to the provider directly;
- issues that require a compromised device or a heavily outdated browser.
