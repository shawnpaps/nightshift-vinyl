import { createCartComponents } from '@shopify/hydrogen/react';
import type { cartHandlers } from './shopify.server';
export const { CartProvider, useCart, useCartForm, useCartActions } = createCartComponents<typeof cartHandlers>();
export type InitialCartData = Awaited<ReturnType<typeof cartHandlers.get>>['data'];
