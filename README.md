# Webwerk

Single-page site for **Webwerk** — a Luxembourg web studio (general; restaurants are the lead vertical). Static HTML/CSS/JS, no build step. Bilingual FR/EN (default FR). Indexable.

## Run locally
```
python -m http.server 8000
# open http://localhost:8000
```

## Deploy
GitHub Pages from `main` (repo root). Live (staging) at the repo's Pages URL until the domain is pointed.

## Go-live checklist (owner actions)
1. **Register `webwerk.lu`** via a registrar that supports `.lu` (EuroDNS, Gandi, OVH, Namecheap, or dns.lu directly — *not* GoDaddy, which doesn't sell `.lu`).
2. **Point the domain:** add a `CNAME` file to this repo containing `webwerk.lu`, then set DNS (A records to GitHub Pages IPs / CNAME to `canergelmis.github.io`). Enable "Enforce HTTPS" in repo Settings → Pages.
3. **Contact form:** create a form at [formspree.io](https://formspree.io) and replace `YOUR_FORM_ID` in `index.html` (`<form action=...>`) with the real form id. Until then the form posts nowhere — the `mailto:` fallback still works.
4. **Mailbox:** set up `hello@webwerk.lu` (e.g. Zoho/Google) so the contact email resolves; update the FB/IG handles in the contact + footer.
5. Submit `sitemap.xml` in Google Search Console once the domain is live.
