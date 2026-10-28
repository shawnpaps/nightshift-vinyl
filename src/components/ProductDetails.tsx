import { useEffect, useState } from 'react';
import { buildProductSelectionSearchParams, canAddToCart, type SelectedOption } from '@shopify/hydrogen';
import { CartProvider, type InitialCartData } from '../lib/cart';
import { ProductProvider, useProductForm } from '../lib/product';
import type { ProductData } from '../lib/product.server';
import { formatPrice, shopifyImageUrl } from '../lib/presentation';

function variantUrl(product: ProductData, selectedOptions: SelectedOption[], handle: string, search: string) {
  const params = buildProductSelectionSearchParams({ selectedOptions, optionNames: product.options.map((o) => o.name), base: new URLSearchParams(search) });
  return `/products/${handle}${params.size ? `?${params}` : ''}`;
}
function PurchasePanel({ product, search }: { product: ProductData; search: string }) {
  const { options, selectedVariant, formProps, register, errors } = useProductForm();
  const addable = canAddToCart(product, options);
  const image = selectedVariant?.image ?? product.media.nodes.find((media) => media.__typename === 'MediaImage')?.image;
  return <div className="grid gap-10 md:grid-cols-2">
    <div>{image && <img className="aspect-square w-full rounded bg-coal object-cover" src={shopifyImageUrl(image.url,1000)} width="1000" height="1000" alt={image.altText ?? product.title} />}</div>
    <div><p className="mb-3 text-sm text-amber">{product.vendor}</p><h1 className="mb-5 text-4xl font-bold">{product.title}</h1><p className="mb-6 text-2xl text-amber">{formatPrice(selectedVariant?.price ?? product.priceRange.minVariantPrice)}</p><p className="mb-8 whitespace-pre-line">{product.description}</p>
      {options.map((option) => <fieldset className="mb-6" key={option.name}><legend className="mb-2 font-semibold">{option.name}</legend><div className="flex flex-wrap gap-2">{option.values.map((value) => {
        const registered = register('optionValue',{ optionName: option.name, value: value.name });
        const href = variantUrl(product, value.selectedOptions, value.handle ?? product.handle, search);
        const styles = `rounded border px-4 py-2 ${value.selected ? 'border-amber bg-amber text-ink' : 'border-smoke'} ${!value.available ? 'line-through' : ''}`;
        return !value.exists ? <button className={`${styles} opacity-40`} type="button" disabled key={value.name}>{value.name}</button> : <a key={value.name} className={styles} href={href} data-option-name={option.name} data-option-value={value.name} aria-current={value.selected ? 'true' : undefined} onClick={(event) => {
          if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || (event.currentTarget.target && event.currentTarget.target !== '_self')) return;
          if (value.handle && value.handle !== product.handle) {
            sessionStorage.setItem('nightshift-option-focus',JSON.stringify({name:option.name,value:value.name,scrollY:window.scrollY})); return;
          }
          event.preventDefault(); registered.onClick();
        }}>{value.name}{!value.available && <span className="sr-only"> (Sold out)</span>}</a>;
      })}</div></fieldset>)}
      <form {...formProps({ beforeSubmit: () => { document.querySelector<HTMLAnchorElement>('[data-cart-trigger]')?.click(); } })} className="mt-8 flex gap-3">
        <input type="hidden" {...register('merchandiseId',{})} />
        <input className="w-20 rounded border border-smoke bg-coal p-3" aria-label="Quantity" type="number" min="1" {...register('quantity',{ defaultValue: 1 })} />
        <button className="flex-1 bg-amber px-6 py-3 font-semibold text-ink disabled:opacity-40" {...register('addToCart',{})} disabled={!addable}>{addable ? 'Add to cart' : product.requiresSellingPlan ? 'Subscription required' : selectedVariant ? 'Sold out' : 'Select options'}</button>
      </form>
      {[...errors.userErrors,...errors.warnings,...errors.networkErrors].length > 0 && <ul className="mt-4" role="alert">{[...errors.userErrors,...errors.warnings,...errors.networkErrors].map((error,i) => <li key={i}>{error.message}</li>)}</ul>}
    </div>
  </div>;
}
export default function ProductDetails({ product, initialData, search }: { product: ProductData; initialData: InitialCartData; search: string }) {
  const [currentSearch,setCurrentSearch] = useState(search);
  useEffect(() => {
    const raw = sessionStorage.getItem('nightshift-option-focus');
    if (raw) {
      sessionStorage.removeItem('nightshift-option-focus');
      try { const target = JSON.parse(raw); const link = [...document.querySelectorAll<HTMLElement>('[data-option-name]')].find((el) => el.dataset.optionName === target.name && el.dataset.optionValue === target.value); link?.focus({preventScroll:true}); window.scrollTo(0,target.scrollY); } catch { /* Ignore stale focus hints. */ }
    }
    const pop = () => location.reload(); addEventListener('popstate',pop); return () => removeEventListener('popstate',pop);
  },[]);
  return <CartProvider initialData={initialData}><ProductProvider product={product} onSelect={(result) => {
    const url = variantUrl(product,result.selectedOptions,result.selectedVariant?.product?.handle ?? product.handle,location.search);
    if (result.status === 'unresolved') { location.replace(url); return; }
    history.replaceState(null,'',url); setCurrentSearch(new URL(url,location.origin).search);
  }}><PurchasePanel product={product} search={currentSearch} /></ProductProvider></CartProvider>;
}
