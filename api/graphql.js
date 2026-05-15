/**
 * api/graphql.js
 * GraphQL proxy — forwards requests to the Shopify Admin API.
 * The access token is injected server-side and never reaches the browser.
 *
 * Mirrors the Ingredient Admin and FAQ Admin proxy pattern exactly.
 */

const SHOPIFY_STORE   = 'cf6huz-e6.myshopify.com';
const SHOPIFY_API_VER = '2025-01';

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { query, variables } = req.body || {};

  if (!query) return res.status(400).json({ error: 'Missing query' });

  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'SHOPIFY_ACCESS_TOKEN not configured' });

  try {
    const upstream = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VER}/graphql.json`,
      {
        method:  'POST',
        headers: {
          'Content-Type':           'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables: variables || {} }),
      }
    );

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
