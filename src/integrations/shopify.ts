import type { CommerceAdapter } from "../data/adapters";

/* =====================================================================
   Shopify Storefront client — for ordering BioAro Labs tests in-app.

   bioarolabs.com runs on Shopify (storefront API 2025-07). Once BioAro
   issues a public Storefront access token, set:
     NEXT_PUBLIC_SHOPIFY_DOMAIN=<store>.myshopify.com
     NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=<public storefront token>
   and the Test showcase can show price + "Order" (cart → Shopify checkout).
   Until then, every test links to its page on bioarolabs.com.
   The Storefront token is public by design (read-only catalogue + cart).
   ===================================================================== */

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || "";
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN || "";
const VERSION = "2025-07";

export const shopifyEnabled = !!(DOMAIN && TOKEN);

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${DOMAIN}/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Storefront-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}`);
  const j = (await res.json()) as { data: T; errors?: unknown };
  if (j.errors) throw new Error("Shopify query error");
  return j.data;
}

export const shopify: CommerceAdapter = {
  async product(handle) {
    if (!shopifyEnabled) return null;
    const d = await gql<{ product: null | { id: string; title: string; featuredImage?: { url: string }; variants: { nodes: { id: string; price: { amount: string; currencyCode: string } }[] } } }>(
      `query($h: String!) { product(handle: $h) { id title featuredImage { url } variants(first: 1) { nodes { id price { amount currencyCode } } } } }`,
      { h: handle },
    );
    const p = d.product;
    const v = p?.variants.nodes[0];
    return p && v ? { id: p.id, title: p.title, image: p.featuredImage?.url, variantId: v.id, price: v.price.amount, currency: v.price.currencyCode } : null;
  },
  async addToCart(variantId, quantity = 1) {
    const d = await gql<{ cartCreate: { cart: { checkoutUrl: string } } }>(
      `mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { checkoutUrl } } }`,
      { lines: [{ merchandiseId: variantId, quantity }] },
    );
    return { checkoutUrl: d.cartCreate.cart.checkoutUrl };
  },
};
