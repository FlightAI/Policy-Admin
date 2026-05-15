# element³ Policy Admin

A single-page admin tool for managing `policy_section` metaobjects in the element³ Shopify store.
Hosted on Vercel (deployed via GitHub), using a serverless proxy to forward GraphQL requests to the
Shopify Admin API with a static access token.

Mirrors the Ingredient Admin and FAQ Admin architecture exactly — same auth flow, same proxy pattern,
same env var names.

---

## What it manages

One unified metaobject type:

| Type | Fields |
|---|---|
| `policy_section` | `policy_type`, `section_number`, `eyebrow_label`, `heading`, `body` (rich text) |

Four policy tabs in the admin, each filtered by `policy_type`:

| Tab | `policy_type` value |
|---|---|
| Privacy Policy | `privacy` |
| Terms & Conditions | `tc` |
| Returns Policy | `returns` |
| Subscription Terms | `subscription` |

---

## Architecture

```
Browser (public/index.html — single file)
  │
  │  POST /api/graphql  { query, variables }
  ▼
Vercel serverless function (api/graphql.js)
  │
  │  POST https://cf6huz-e6.myshopify.com/admin/api/2025-01/graphql.json
  │  Header: X-Shopify-Access-Token: <token from env var>
  ▼
Shopify Admin API
```

The token is injected server-side and never reaches the browser.

---

## File structure

```
policy-admin/
├── api/
│   ├── graphql.js              # GraphQL proxy — injects SHOPIFY_ACCESS_TOKEN
│   └── auth/
│       └── callback.js         # OAuth callback — only used when (re)generating tokens
├── public/
│   └── index.html              # Entire frontend — single file
├── .env.example                # Document required env vars (never commit .env.local)
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## Vercel environment variables

| Variable | Purpose |
|---|---|
| `SHOPIFY_ACCESS_TOKEN` | Admin API token with required scopes (see below) |
| `SHOPIFY_CLIENT_ID` | Partner app Client ID — only needed by `callback.js` |
| `SHOPIFY_CLIENT_SECRET` | Partner app Client Secret — only needed by `callback.js` |

You can reuse the same token as the Ingredient Admin / FAQ Admin **if it has the required scopes**.
Adding this project's scopes to the token does not affect the other admins.

---

## Required Shopify API scopes

```
read_metaobjects
write_metaobjects
read_metaobject_definitions
write_metaobject_definitions
read_content        ← needed if binding sections to pages in future
write_content       ← needed if binding sections to pages in future
read_files
write_files
```

Does **not** require `read_products` or `write_products` (policy sections are not bound to products).

---

## Deploy via GitHub → Vercel (first time)

1. **Create the GitHub repo** and push this directory.
2. **Connect to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import the GitHub repo
   - Root directory: leave as `/` (or set to `policy-admin/` if in a monorepo)
   - Framework preset: **Other**
   - Click **Deploy**
3. **Set environment variables** in Vercel → Project Settings → Environment Variables:
   - `SHOPIFY_ACCESS_TOKEN` → your token
   - `SHOPIFY_CLIENT_ID` → Partner app client ID
   - `SHOPIFY_CLIENT_SECRET` → Partner app client secret
4. **Redeploy** after setting env vars (Deployments → Redeploy latest).

From this point, every push to `main` auto-deploys to production.
Pull requests get preview deployments automatically.

---

## Local development

```bash
npm install
npx vercel env pull .env.local   # pulls env vars from your linked Vercel project
npx vercel dev                   # runs locally at http://localhost:3000
```

---

## How to verify the token works

Open the deployed app, open DevTools → Console, and run:

```js
// Test 1: basic connectivity
fetch('/api/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{shop{name}}'})}).then(r=>r.json()).then(d=>console.log(d))

// Test 2: metaobject access
fetch('/api/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{metaobjects(type:"policy_section",first:1){nodes{id handle}}}'})}).then(r=>r.json()).then(d=>console.log(d))

// Test 3: scope inspection
fetch('/api/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{app{installation{accessScopes{handle}}}}'})}).then(r=>r.json()).then(d=>console.log(d))
```

- Test 1 passes, Test 2 fails → token valid but missing metaobject scopes → regenerate
- Test 3 returns empty `accessScopes` → token has no scopes → regenerate
- 401 on any test → token invalid or revoked

---

## How to regenerate the access token

1. Confirm `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are set in Vercel.
2. Visit this URL in a browser while logged into the Shopify admin
   (replace `<CLIENT_ID>` and `<THIS-APP-URL>`):

```
https://cf6huz-e6.myshopify.com/admin/oauth/authorize
  ?client_id=<CLIENT_ID>
  &scope=read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_content,write_content,read_files,write_files
  &redirect_uri=https://<THIS-APP-URL>/api/auth/callback
```

3. Approve the access request.
4. Copy the token from the callback page.
5. Paste into Vercel → `SHOPIFY_ACCESS_TOKEN` → Save → Redeploy.

> ⚠️ The OAuth callback only works from the **production URL** (not preview URLs).
> Register the production URL in the Shopify Partner app's allowed redirect URIs.

---

## Known limitations / next steps

- **Rich text editing** — the `body` field is a Shopify `rich_text_field` stored as JSON.
  The current editor shows a raw JSON textarea. Replace with a WYSIWYG editor (e.g. Quill.js)
  wired to the Shopify rich text format before production use. The FAQ Admin implementation
  can serve as a reference.

- **Page binding** — policy sections are not yet bound to Shopify pages via metafields.
  If needed, add a `custom.policy_sections` list metafield to each policy page and a
  Pages tab in the admin (following the FAQ Admin's Pages tab pattern).

- **`policy_type` backfill** — existing `policy_section` entries created before this field
  was added will have a null `policy_type` and will not appear in any tab. Backfill them
  via the migration worksheet or a one-off script.

---

## API version

Currently `2025-01` in `api/graphql.js`. If bumped, update the constant in `public/index.html` too.
