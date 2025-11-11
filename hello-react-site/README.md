# Hello React Site

This is a tiny Vite + React "Hello, world!" site created inside this repository.

Quick start:

```bash
cd hello-react-site
npm install
npm run dev
```

Then open http://localhost:5173

Cloudflare Pages (GitHub Actions)

This repository includes a GitHub Actions workflow to build and deploy the site to Cloudflare Pages: `.github/workflows/deploy-cloudflare-pages.yml`.

Required repository secrets (set these in your GitHub repository Settings → Secrets):

- `CLOUDFLARE_API_TOKEN` — a scoped API token with Pages Deploy and Account read permissions.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
- `CLOUDFLARE_PROJECT_NAME` — the Pages project name (the name Cloudflare uses for the Pages site).

The workflow runs on pushes to `main` and can be run manually via the Actions tab.
