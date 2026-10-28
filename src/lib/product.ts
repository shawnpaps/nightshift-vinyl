import { createProductComponents } from '@shopify/hydrogen/react';
import type { ProductData } from './product.server';
export const { ProductProvider, useProductForm } = createProductComponents<ProductData>();
