import { gql, parseCollectionParams, type StorefrontClient, type StorefrontApi } from '@shopify/hydrogen';
import { PRODUCT_CARD } from './catalog.server';

const COLLECTION = gql(`query Collection($handle: String!, $filters: [ProductFilter!], $sortKey: ProductCollectionSortKeys, $reverse: Boolean, $after: String, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
  localization { country { currency { isoCode } } }
  collection(handle: $handle) { id title description products(first: 12, after: $after, filters: $filters, sortKey: $sortKey, reverse: $reverse) {
    nodes { ...ProductCard } pageInfo { hasNextPage endCursor }
    filters { id label type values { id label count input } }
  } }
}`, [PRODUCT_CARD]);
const SEARCH = gql(`query Search($query: String!, $filters: [ProductFilter!], $sortKey: SearchSortKeys, $reverse: Boolean, $after: String, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
  localization { country { currency { isoCode } } }
  search(query: $query, types: [PRODUCT], first: 12, after: $after, productFilters: $filters, sortKey: $sortKey, reverse: $reverse) {
    nodes { __typename ... on Product { ...ProductCard } }
    pageInfo { hasNextPage endCursor } productFilters { id label type values { id label count input } }
  }
}`, [PRODUCT_CARD]);

export async function loadBrowse(client: StorefrontClient, url: URL, handle?: string) {
  const params = parseCollectionParams(url.searchParams);
  const variables = { filters: params.filters as StorefrontApi.VariablesOf<typeof COLLECTION>['filters'], reverse: params.reverse, after: url.searchParams.get('after') };
  if (handle) {
    const { data, errors } = await client.graphql(COLLECTION, { variables: { ...variables, handle, sortKey: params.sortKey } });
    if (errors || !data) throw new Error('Unable to load collection.');
    if (!data.collection) return null;
    return { collectionId: data.collection.id, title: data.collection.title, description: data.collection.description, handle, dataSearch: url.search, products: data.collection.products.nodes, availableFilters: data.collection.products.filters, pageInfo: data.collection.products.pageInfo, currencyCode: data.localization.country.currency.isoCode };
  }
  const term = url.searchParams.get('q')?.trim() || '';
  if (!term) return { collectionId: undefined, title: 'Search', description: '', handle: 'search:', dataSearch: url.search, products: [], availableFilters: [], pageInfo: { hasNextPage: false, endCursor: null }, currencyCode: 'USD' as const };
  const { data, errors } = await client.graphql(SEARCH, { variables: { ...variables, query: term, sortKey: params.sortKey === 'PRICE' ? 'PRICE' : 'RELEVANCE', reverse: params.sortKey === 'PRICE' ? params.reverse : false } });
  if (errors || !data) throw new Error('Unable to search catalog.');
  return { collectionId: undefined, title: `Search: ${term}`, description: '', handle: `search:${term}`, dataSearch: url.search, products: data.search.nodes.filter((node) => node.__typename === 'Product'), availableFilters: data.search.productFilters, pageInfo: data.search.pageInfo, currencyCode: data.localization.country.currency.isoCode };
}
export type BrowseData = NonNullable<Awaited<ReturnType<typeof loadBrowse>>>;
