import { createCartServerHandlers, createPredictiveSearchServerHandlers } from '@shopify/hydrogen';
import { createCustomerSession, createCustomerAccountServerHandlers } from '@shopify/hydrogen/customer-account';
import { getSecret } from 'astro:env/server';

// Environment access stays on the server, including public values passed to browser UI.
export const shopifyConfig = {
  storeDomain: getSecret('PUBLIC_STORE_DOMAIN') || 'apparel-band-merch.mock.shop',
  publicToken: getSecret('PUBLIC_STOREFRONT_API_TOKEN') || undefined,
  privateToken: getSecret('PRIVATE_STOREFRONT_API_TOKEN') || undefined,
  shopId: getSecret('SHOP_ID'),
  storefrontId: getSecret('PUBLIC_STOREFRONT_ID') || '0',
  accountClientId: getSecret('PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID'),
  sessionSecret: getSecret('CUSTOMER_ACCOUNT_SESSION_SECRET'),
};

export const isDemoStore = shopifyConfig.storeDomain === 'mock.shop' || shopifyConfig.storeDomain.endsWith('.mock.shop');
export const customerSession = !isDemoStore && shopifyConfig.shopId && shopifyConfig.accountClientId && shopifyConfig.sessionSecret
  ? createCustomerSession({ shopId: shopifyConfig.shopId, customerAccountApiClientId: shopifyConfig.accountClientId })
  : undefined;

// Hydrogen 2026.10.2 has separate development core/customer-account module brands.
// Production enables buyer identity sync; development keeps both groups independent.
const syncedCartHandlers = customerSession && !import.meta.env.DEV ? createCartServerHandlers({ customerSession }) : undefined;
export const cartHandlers = syncedCartHandlers ?? createCartServerHandlers();
export const accountHandlers = customerSession
  ? createCustomerAccountServerHandlers({
      customerSession,
      ...(syncedCartHandlers ? { cartServerHandlers: syncedCartHandlers } : {}),
    })
  : undefined;
export const predictiveSearchHandlers = createPredictiveSearchServerHandlers();
