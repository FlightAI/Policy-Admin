/**
 * api/auth/callback.js
 * OAuth callback — exchanges the authorisation code for a permanent access token.
 *
 * This endpoint is ONLY used when generating or regenerating the access token.
 * Normal app operation (GraphQL proxying) does not touch this file.
 *
 * To trigger the OAuth flow, visit:
 *   https://cf6huz-e6.myshopify.com/admin/oauth/authorize
 *     ?client_id=<SHOPIFY_CLIENT_ID>
 *     &scope=read_metaobjects,write_metaobjects,read_metaobject_definitions,
 *            write_metaobject_definitions,read_content,write_content,read_files,write_files
 *     &redirect_uri=https://<THIS-APP-URL>/api/auth/callback
 *
 * NOTE: The redirect_uri must be registered in the Shopify Partner app.
 *       Use the *production* Vercel URL — preview URLs are not pre-registered.
 */

export default async function handler(req, res) {
  const { code, shop } = req.query;

  if (!code || !shop) {
    return res.status(400).send('Missing code or shop parameter.');
  }

  const clientId     = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send(
      'SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET not set in environment variables.'
    );
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const { access_token, error_description } = await tokenRes.json();

    if (!access_token) {
      return res.status(400).send(`Token exchange failed: ${error_description || 'unknown error'}`);
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Token generated — element³ Policy Admin</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                 max-width: 640px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
          h2   { margin-bottom: 12px; }
          p    { color: #555; margin-bottom: 16px; line-height: 1.6; }
          code { display: block; background: #f4f4f4; border: 1px solid #e0e0e0;
                 border-radius: 6px; padding: 16px; word-break: break-all;
                 font-size: 13px; line-height: 1.5; }
          .steps { background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px;
                   padding: 16px; margin-top: 24px; font-size: 14px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <h2>✅ Token generated successfully</h2>
        <p>Copy the token below and paste it into Vercel → Project Settings →
           Environment Variables → <strong>SHOPIFY_ACCESS_TOKEN</strong>, then redeploy.</p>
        <code>${access_token}</code>
        <div class="steps">
          <strong>Next steps:</strong><br>
          1. Copy the token above.<br>
          2. Go to your Vercel project → Settings → Environment Variables.<br>
          3. Update <code>SHOPIFY_ACCESS_TOKEN</code> → Save.<br>
          4. Redeploy (Deployments → Redeploy latest).
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
