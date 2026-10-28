import { formatMoney, type MoneyV2 } from '@shopify/hydrogen';
export const formatPrice = (money: MoneyV2) => formatMoney(money, { locale: 'en-US' }).toString();
export function shopifyImageUrl(source: string, width: number) {
  const url = new URL(source);
  if (['cdn.shopify.com', 'mock.shop'].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) url.searchParams.set('width', String(width));
  return url.toString();
}
