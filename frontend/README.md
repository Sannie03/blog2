# React + Vite

## Sharing previews on Vercel

Vercel serves the React app to readers. The `/story/:slug` and `/post/:slug`
rewrites send recognized sharing/search bots to the public Render backend,
which returns article-specific Open Graph and Twitter tags in the initial HTML.
Keep these rules before the static `/index.html` rewrites. When moving the
backend, update both external destinations in `vercel.json`.

Deploy the frontend to Vercel and the backend to Render after changing preview
routes. Set Render's `PUBLIC_SITE_URL` to the canonical website URL, currently
`https://www.nextstorypart.site`. Set Vercel's Production `VITE_API_URL` to
`https://blog2-2o8q.onrender.com` and `VITE_PUBLIC_SITE_URL` to the website URL.
Sharing platforms may cache old previews; refresh the URL in their debugger
after deployment. A sleeping or unavailable Render service can delay previews.

Preview routing regression check: run `node --test test/share-preview.test.js`
from `backend`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
