# Nightshift Vinyl

Astro 7 storefront with Shopify Hydrogen 2026.10 and React islands, configured for server rendering on Vercel. Existing Tailwind colors are shared across the catalog, product page, cart page, and cart drawer.

## Local development

```sh
npm install
cp .env.example .env
npm run dev -- --background
```

Manage the background server with `npm run astro -- dev status`, `npm run astro -- dev logs`, and `npm run astro -- dev stop`. The default URL is http://localhost:4321.

Without configuration, the app uses Shopify’s tokenless music merchandise demo catalog at `apparel-band-merch.mock.shop`. These are sample merchandise products, not a vinyl record catalog. Demo carts work; real checkout, customer accounts, and real-store analytics require a connected Shopify store. The demo catalog currently returns no filter metadata, so its filter sidebar shows sorting only; merchant-configured filters render from the API when available. The app uses US English/USD market context; multi-market routing is not implemented.

## Connect Shopify

Edit `.env` locally and add the same values in your Vercel project’s environment settings for the environments you use. Never commit credentials.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_STORE_DOMAIN` | Permanent store hostname, e.g. `your-store.myshopify.com`, without a URL scheme or path |
| `PUBLIC_STOREFRONT_API_TOKEN` | Public Storefront API token; leave unset for the demo |
| `PRIVATE_STOREFRONT_API_TOKEN` | Optional server-only token; when present, middleware uses trusted Astro/Vercel buyer IP context |
| `PUBLIC_STOREFRONT_ID` | Hydrogen storefront ID, or `0` for a Headless storefront |
| `SHOP_ID` | Numeric Shopify shop ID; runtime scripts can also resolve the shop GID from the API |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID` | Customer Account OAuth client ID |
| `CUSTOMER_ACCOUNT_SESSION_SECRET` | Private random secret, at least 32 characters, for encrypted customer cookies |
| `PUBLIC_CHECKOUT_DOMAIN` | Optional reference value for future CSP configuration; checkout URLs come from the cart |

Use a token-backed client for the real store and publish products/collections to its storefront channel. Configure storefront filters in Shopify Search & Discovery. Customer account routes activate only when shop ID, client ID, and session secret are supplied. Until then, `/account` shows a configuration message and OAuth endpoints return an explicit 503.

For Customer Account OAuth, register the public HTTPS storefront origin, `/account/authorize` callback URL, and logout URL in Shopify. Plain HTTP localhost cannot complete login; use a registered HTTPS development origin. Login/logout stay native document navigations. Access, refresh, and ID tokens stay in authenticated encrypted Secure/HttpOnly cookies, chunked to fit cookie limits. Production deployments can replace this adapter with an opaque session backed by shared server storage; no database or session service is provisioned here. Rotating the secret invalidates existing sessions.

Shopify’s default privacy banner gates analytics delivery. Review the store’s Customer Privacy configuration for the deployed origin. Demo analytics delivery and real-store OAuth/checkout have not been verified. Hydrogen currently ships different development core/account module brands, so cart buyer-identity sync is enabled in production and omitted in development; login handlers remain registered in both when configured.

## Vercel

Import the repository into Vercel, select the Astro preset, and use `npm run build`. The adapter generates `.vercel/output`; no manual SPA rewrite is required. The current build targets Node.js 24. Add the Shopify environment variables before deploying, and register the final HTTPS domain with Shopify for customer login. This integration does not create or deploy a Vercel project.

Cart, product, and account HTML use `private, no-store` because they may contain shopper-specific data. Keep these responses out of shared caches. Only public serialized shop and catalog data crosses into React islands; all environment reads remain in server boundaries. The app owns SEO, image sizing, and session storage rather than relying on nonexistent Hydrogen components.

## Checks

```sh
npm run typecheck    # Astro/TypeScript and Hydrogen GraphQL validation
npm run build       # Vercel production output
npm test            # Session encryption, tampering, origin binding, and logout
npm run test:smoke  # HTTP checks against the running dev server
```

The smoke script discovers product/collection links from rendered HTML, exercises the API proxy, validates status codes and script uniqueness, and submits the rendered native add/quantity/remove forms. Cart mutations run only when the demo banner is present. It does not replace browser tests for hydration, rapid actions, dialog focus, consent, or variant navigation.

To check the generated production handler locally:

```sh
npm run preview:vercel
BASE_URL=http://localhost:4322 npm run test:smoke
```

This preview harness exercises the generated Vercel fetch handler and static assets; deployment-specific behavior still needs a Vercel preview deployment. No deployment is performed by these commands.

Hydrogen skills live in `.agents/skills` and `.claude/skills`. After a Hydrogen upgrade run `npx hydrogen skills sync`, then `npx hydrogen skills check`. Dev startup warns about stale copies. Dependency overrides pin patched, compatible versions of Vercel’s `path-to-regexp` and `zod` transitive dependencies.
