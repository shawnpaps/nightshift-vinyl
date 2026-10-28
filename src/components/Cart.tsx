import { useId, useState } from 'react';
import type { CartLine, CartErrorGroup } from '@shopify/hydrogen';
import { CartProvider, useCart, useCartForm } from '../lib/cart';
import type { InitialCartData } from '../lib/cart';
import { formatPrice, shopifyImageUrl } from '../lib/presentation';

function Errors({ group }: { group?: CartErrorGroup }) {
  const messages = [...(group?.userErrors ?? []), ...(group?.warnings ?? [])];
  return messages.length ? <ul role="alert">{messages.map((error,i) => <li key={i}>{error.message}</li>)}</ul> : null;
}
function LineItem({ line }: { line: CartLine }) {
  const { formProps, register } = useCartForm();
  const pending = useCart((state) => state.pending.lines.has(line.id));
  const errors = useCart((state) => state.errors.lines.get(line.id));
  const errorId = useId();
  const merchandise = line.merchandise;
  return <li className="border-b border-smoke py-6">
    <div className="flex gap-4">
      {merchandise?.image && <img className="h-20 w-20 rounded object-cover" width="80" height="80" src={shopifyImageUrl(merchandise.image.url,160)} alt={merchandise.image.altText ?? ''} />}
      <div className="min-w-0 flex-1"><a href={`/products/${merchandise?.product.handle ?? ''}`}>{merchandise?.product.title ?? merchandise?.title ?? 'Product'}</a>
        <p className="text-sm">{merchandise?.selectedOptions?.filter((o) => o.value !== 'Default Title').map((o) => `${o.name}: ${o.value}`).join(' / ')}</p>
        {line.attributes?.filter((a) => !a.key.startsWith('_')).map((a) => <p key={a.key} className="text-sm">{a.key}: {a.value}</p>)}
        <form {...formProps()} className="mt-3 flex flex-wrap items-center gap-3" aria-describedby={errorId}>
          <button {...register('set')} /><input type="hidden" {...register('lineId',{ value: line.id })} />
          <button aria-label={`Decrease quantity of ${merchandise?.product.title ?? 'product'}`} {...register('decrease')}>−</button>
          <input className={`w-16 rounded border border-smoke bg-coal p-1 text-center ${pending ? 'opacity-40' : ''}`} aria-label={`Quantity of ${merchandise?.product.title ?? 'product'}`} aria-invalid={!!errors?.userErrors.length} {...register('quantity',{ value: line.quantity, interactive: true })} />
          <button aria-label={`Increase quantity of ${merchandise?.product.title ?? 'product'}`} {...register('increase')}>+</button>
          <button className="text-sm underline" {...register('remove')}>Remove</button>
        </form><div id={errorId}><Errors group={errors} /></div>
      </div>
      <p className={pending ? 'opacity-40' : ''}>{line.cost?.totalAmount ? formatPrice(line.cost.totalAmount) : 'Updating…'}</p>
    </div>
  </li>;
}
function DiscountForm() {
  const { formProps, register } = useCartForm();
  const codes = useCart((s) => s.data.discountCodes);
  const pending = useCart((s) => s.pending.discountCodes);
  const errors = useCart((s) => s.errors.discountCodes);
  return <section className="mt-6"><h3 className="mb-2 font-semibold">Discount code</h3>
    <form {...formProps()} className="flex gap-2"><input className="min-w-0 flex-1 border border-smoke bg-coal p-2" aria-label="Discount code" {...register('discountCode',{ defaultValue: '' })} /><button className="border border-smoke px-3" {...register('discount-apply')}>Apply</button></form>
    {codes.map((code) => <div key={code.code} className={pending.has(code.code) ? 'opacity-40' : ''}><form {...formProps()} className="mt-2 flex gap-3"><input type="hidden" {...register('discountCode',{value:code.code})} /><span>{code.code} · {code.applicable ? 'Applied' : 'Not applicable'}</span><button {...register('discount-remove')}>Remove</button></form><Errors group={errors.get(code.code)} /></div>)}
    {[...errors].filter(([code]) => !codes.some((c) => c.code === code)).map(([code,group]) => <Errors key={code} group={group} />)}
  </section>;
}
export function CartContents({ demo = false, drawer = false }: { demo?: boolean; drawer?: boolean }) {
  const data = useCart((s) => s.data);
  const loading = useCart((s) => s.loading);
  const totalsPending = useCart((s) => s.pending.cost || s.revalidating);
  const errors = useCart((s) => s.errors);
  const [dismissedAt,setDismissedAt] = useState(0);
  const messages = [...errors.network.map((e) => e.message), ...errors.cart.userErrors.map((e) => e.message), ...errors.cart.warnings.map((e) => e.message), ...[...errors.lines].filter(([id]) => !data.lines.nodes.some((line) => line.id === id)).flatMap(([,group]) => [...group.userErrors,...group.warnings].map((e) => e.message))];
  return <div className={drawer ? 'flex min-h-0 flex-1 flex-col px-6' : ''}>
    {messages.length > 0 && errors.lastUpdatedAt > dismissedAt && <div role="alert" className="my-4 border border-rust p-4">{messages.map((message,i) => <p key={i}>{message}</p>)}<button className="underline" onClick={() => setDismissedAt(errors.lastUpdatedAt)}>Dismiss</button></div>}
    {loading ? <p role="status">Loading cart…</p> : !data.lines.nodes.length ? <p className="py-8">Your cart is empty. <a className="text-amber underline" href="/collections">Explore the collections</a></p> : <>
      <ul className={drawer ? 'min-h-0 flex-1 overflow-y-auto' : ''}>{data.lines.nodes.map((line) => <LineItem key={line.id} line={line} />)}</ul><div className={drawer ? 'shrink-0 pb-6' : ''}><DiscountForm />
      <div className={`my-6 flex justify-between text-lg ${totalsPending ? 'opacity-40' : ''}`}><span>Subtotal</span><span>{formatPrice(data.cost.subtotalAmount)}</span></div>
      <p className="mb-4 text-sm">Shipping and taxes calculated at checkout.</p>
      {demo ? <p className="border border-smoke p-3 text-sm">Demo cart. Connect your Shopify store to enable checkout.</p> : data.checkoutUrl && <a className="block bg-amber px-6 py-3 text-center font-semibold text-ink" href={data.checkoutUrl}>Checkout</a>}</div>
    </>}
  </div>;
}
export default function Cart({ initialData, demo }: { initialData: InitialCartData; demo: boolean }) {
  return <CartProvider initialData={initialData}><CartContents demo={demo} /></CartProvider>;
}
