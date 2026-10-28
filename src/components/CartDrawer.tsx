import { useEffect, useState } from 'react';
import { useCartAnalytics } from '@shopify/hydrogen/react';
import { AnalyticsEvent } from '@shopify/hydrogen';
import { toAnalyticsCart } from '../lib/analytics';
import { CartProvider, useCart } from '../lib/cart';
import { CartContents } from './Cart';

export function openCartDrawer() {
  const dialog = document.getElementById('cart-drawer');
  if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
}
function Analytics() { useCartAnalytics(); return null; }
function Drawer({ demo }: { demo: boolean }) {
  const [ready,setReady] = useState(false);
  const cart = useCart((s) => s.data);
  useEffect(() => {
    const setup = () => {
      window.Shopify?.actions?.openCart?.configure({ handler: async () => openCartDrawer() });
      setReady(!!window.Shopify?.analytics);
    };
    setup(); addEventListener('nightshift:shopify-ready',setup); document.addEventListener('DOMContentLoaded',setup,{once:true});
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((event.target as HTMLElement).closest('[data-cart-trigger]')) { event.preventDefault(); openCartDrawer(); }
    };
    document.addEventListener('click',click);
    return () => { removeEventListener('nightshift:shopify-ready',setup); document.removeEventListener('DOMContentLoaded',setup); document.removeEventListener('click',click); };
  },[]);
  return <>{ready && <Analytics />}<dialog id="cart-drawer" aria-labelledby="cart-drawer-title" closedby="any" onToggle={(event) => {
    if (event.currentTarget.open) window.Shopify?.analytics?.publish(AnalyticsEvent.CART_VIEWED,{ cart: toAnalyticsCart(cart) });
  }}>
    <div className="flex h-full flex-col"><header className="flex shrink-0 justify-between border-b border-smoke p-6"><h2 id="cart-drawer-title" className="text-xl font-bold">Your cart</h2><button type="button" aria-label="Close cart" onClick={() => (document.getElementById('cart-drawer') as HTMLDialogElement).close()}>Close ×</button></header><CartContents demo={demo} drawer /></div>
  </dialog></>;
}
export default function CartDrawer({demo}:{demo:boolean}) { return <CartProvider><Drawer demo={demo} /></CartProvider>; }
