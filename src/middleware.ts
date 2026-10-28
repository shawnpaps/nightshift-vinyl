import { defineMiddleware } from 'astro:middleware';
import { createShopifyRequestContext, createStorefrontClient, handleShopifyRoutes, handleShopifyRedirects } from '@shopify/hydrogen';
import { shopifyConfig, cartHandlers, accountHandlers, predictiveSearchHandlers } from './lib/shopify.server';
import { createSessionManager } from './lib/session.server';
import { routeTemplates } from './lib/routes';

export const onRequest = defineMiddleware(async (context, next) => {
  const requestContext = createShopifyRequestContext({ request: context.request, i18n: { country: 'US', language: 'EN' }, buyerIp: context.clientAddress });
  const storefront = shopifyConfig.privateToken ? createStorefrontClient({
    type: 'private', requestContext,
    config: { storeDomain: shopifyConfig.storeDomain, privateStorefrontToken: shopifyConfig.privateToken },
  }) : createStorefrontClient({
    type: 'public', requestContext,
    config: { storeDomain: shopifyConfig.storeDomain, publicStorefrontToken: shopifyConfig.publicToken },
  });
  const sessionManager = await createSessionManager(context.request, shopifyConfig.sessionSecret);
  Object.assign(context.locals, { storefront, requestContext, sessionManager });

  if (!accountHandlers && /^\/account\/(login|authorize|refresh|logout)\/?$/.test(context.url.pathname)) {
    return new Response('Customer accounts require a real Shopify store and Customer Account configuration.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const shopifyRoute = handleShopifyRoutes({
    request: context.request, requestContext, storefrontClient: storefront, sessionManager, routeTemplates,
    handlers: accountHandlers ? [cartHandlers, predictiveSearchHandlers, accountHandlers] : [cartHandlers, predictiveSearchHandlers],
  });
  if (shopifyRoute) return shopifyRoute;
  const response = await next();
  if (response.status === 404) {
    const redirect = await handleShopifyRedirects({ request: context.request, storefrontClient: storefront, routeTemplates });
    if (redirect) return redirect;
  }
  const sessionHeaders = new Headers((await sessionManager.commit?.()) || undefined);
  for (const cookie of sessionHeaders.getSetCookie()) response.headers.append('Set-Cookie', cookie);
  if (sessionHeaders.has('Cache-Control')) response.headers.set('Cache-Control', sessionHeaders.get('Cache-Control')!);
  // These pages embed shopper-specific cart or account data in their SSR HTML.
  if (/^\/(cart|account|products)(\/|$)/.test(context.url.pathname)) response.headers.set('Cache-Control', 'private, no-store');
  requestContext.applyResponseHeaders(response.headers);
  return response;
});
