import type { AnalyticsCart, CartData } from '@shopify/hydrogen';

export function toAnalyticsCart(cart: CartData): AnalyticsCart | null {
  if (!cart.id || !cart.updatedAt) return null;
  return { id: cart.id, updatedAt: cart.updatedAt, cost: cart.cost, lines: { nodes: cart.lines.nodes.flatMap((line) => {
    const m = line.merchandise;
    if (!m?.product || !m.id || !line.cost?.amountPerQuantity || typeof m.product.id !== 'string') return [];
    return [{ id:line.id,quantity:line.quantity,merchandise:{id:m.id,title:m.title ?? m.product.title,price:line.cost.amountPerQuantity,sku:typeof m.sku === 'string' ? m.sku : null,product:{id:m.product.id,title:m.product.title,vendor:typeof m.product.vendor === 'string' ? m.product.vendor : ''}} }];
  }) } };
}
