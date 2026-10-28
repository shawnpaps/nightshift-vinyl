import { gql, type StorefrontApi } from '@shopify/hydrogen';
export const PRODUCT_CARD = gql(`fragment ProductCard on Product {
  id handle title featuredImage { url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
}`);
export const HOME_QUERY = gql(`query Home($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
  shop { name id primaryDomain { url } }
  collections(first: 12) { nodes { id title handle image { url altText width height } } }
  products(first: 12) { nodes { ...ProductCard } }
}`, [PRODUCT_CARD]);
export type ProductCardData = StorefrontApi.ResultOf<typeof HOME_QUERY>['products']['nodes'][number];
