import type { CommerceAdapter } from "../data/adapters";

/* =====================================================================
   Shopify Storefront client — ordering BioAro Labs tests in-app.

   bioarolabs.com runs on Shopify (Storefront API 2025-07). Once BioAro
   issues a public Storefront access token, set:
     NEXT_PUBLIC_SHOPIFY_DOMAIN=<store>.myshopify.com
     NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=<public storefront token>
   and "Order" creates a Shopify cart and opens BioAro's own checkout —
   payment happens on Shopify, never inside OVEREO. Until then, "Order"
   opens the test's page on bioarolabs.com.
   The Storefront token is public by design (read-only catalogue + cart).
   ===================================================================== */

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || "";
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN || "";
const VERSION = "2025-07";
const SITE = "https://bioarolabs.com";

export const shopifyEnabled = !!(DOMAIN && TOKEN);
export const productPage = (handle: string) => `${SITE}/product/${encodeURIComponent(handle)}`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${DOMAIN}/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Storefront-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}`);
  const j = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(`Shopify: ${j.errors[0].message}`);
  return j.data;
}

export interface Product {
  id: string;
  title: string;
  price: string;
  currency: string;
  image?: string;
  variantId: string;
  available: boolean;
}

const cache = new Map<string, Promise<Product | null>>();

export const shopify: CommerceAdapter & { productFull(handle: string): Promise<Product | null> } = {
  productFull(handle) {
    if (!shopifyEnabled) return Promise.resolve(null);
    if (!cache.has(handle))
      cache.set(
        handle,
        gql<{ product: null | { id: string; title: string; featuredImage?: { url: string }; variants: { nodes: { id: string; availableForSale: boolean; price: { amount: string; currencyCode: string } }[] } } }>(
          `query($h: String!) { product(handle: $h) { id title featuredImage { url } variants(first: 5) { nodes { id availableForSale price { amount currencyCode } } } } }`,
          { h: handle },
        )
          .then((d) => {
            const p = d.product;
            const v = p?.variants.nodes.find((x) => x.availableForSale) ?? p?.variants.nodes[0];
            return p && v ? { id: p.id, title: p.title, image: p.featuredImage?.url, variantId: v.id, price: v.price.amount, currency: v.price.currencyCode, available: v.availableForSale } : null;
          })
          .catch((e) => {
            cache.delete(handle);
            throw e;
          }),
      );
    return cache.get(handle)!;
  },
  async product(handle) {
    return shopify.productFull(handle);
  },
  async addToCart(variantId, quantity = 1) {
    const d = await gql<{ cartCreate: { cart: { checkoutUrl: string } | null; userErrors: { message: string }[] } }>(
      `mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } } }`,
      { lines: [{ merchandiseId: variantId, quantity }] },
    );
    if (!d.cartCreate.cart) throw new Error(d.cartCreate.userErrors[0]?.message ?? "Cart could not be created");
    return { checkoutUrl: d.cartCreate.cart.checkoutUrl };
  },
};

/** Only ever send her to BioAro's own checkout. */
const safeCheckout = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === DOMAIN || u.hostname.endsWith(".myshopify.com") || u.hostname === "bioarolabs.com" || u.hostname.endsWith(".bioarolabs.com")) ? u.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Order a BioAro Labs test. Opens BioAro's checkout (or the product page
 * when ordering isn't switched on). Returns what happened, in plain words.
 * The new tab is opened synchronously so pop-up blockers allow it.
 */
export async function orderTest(handle: string): Promise<{ ok: boolean; message: string; url: string }> {
  const fallback = productPage(handle);
  if (!shopifyEnabled) {
    window.open(fallback, "_blank", "noopener");
    return { ok: true, message: "Opened the test on bioarolabs.com", url: fallback };
  }
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const p = await shopify.productFull(handle);
    if (!p || !p.available) throw new Error("not available");
    const { checkoutUrl } = await shopify.addToCart(p.variantId, 1);
    const url = safeCheckout(checkoutUrl);
    if (!url) throw new Error("unexpected checkout address");
    if (tab) tab.location.href = url;
    else window.location.href = url;
    return { ok: true, message: `Opened BioAro checkout · ${p.title}`, url };
  } catch {
    if (tab) tab.location.href = fallback;
    else window.open(fallback, "_blank", "noopener");
    return { ok: false, message: "Couldn't start checkout — opened the test page instead", url: fallback };
  }
}
