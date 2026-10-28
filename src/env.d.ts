import type { StorefrontClient, ShopifyRequestContext } from '@shopify/hydrogen';
import type { WritableCustomerSessionManager } from '@shopify/hydrogen/customer-account';

declare global {
  namespace App {
    interface Locals {
      storefront: StorefrontClient;
      requestContext: ShopifyRequestContext;
      sessionManager: WritableCustomerSessionManager;
    }
  }
}
export {};
