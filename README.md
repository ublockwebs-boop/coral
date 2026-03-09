# Coral

Vite + React app for the Coral game library UI.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run dev server:
   ```bash
   npm run dev
   ```

## Build

- Standard build:
  ```bash
  npm run build
  ```
- GitHub Pages build (`/coral/` base path):
  ```bash
  npm run build:gh
  ```

## Deploy to GitHub Pages (recommended)

This repo includes `.github/workflows/deploy-pages.yml`, which:
- builds the app from `main`
- compiles `.tsx` with Vite
- publishes the `dist/` artifact to GitHub Pages

### Required one-time repo settings

1. Go to **Settings → Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.

After that, pushing to `main` deploys automatically.

## Why `main.tsx` 404 happened

If GitHub Pages serves raw repo files directly, the browser cannot execute `main.tsx`.
Use the Vite build output (`dist/`) or the provided Pages workflow so TSX is compiled to JS first.
