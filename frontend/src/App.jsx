import { useEffect, useState } from 'react';
import './styles.css';

const money = (c) => '$' + (c / 100).toFixed(2);

export default function App() {
  const [view, setView] = useState('shop');
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [signup, setSignup] = useState(false);
  const [msg, setMsg] = useState('');

  const api = async (path, method = 'GET', body) => {
    const r = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
      body: body && JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Something went wrong');
    return d;
  };
  const run = (fn) => fn().catch((e) => setMsg(e.message));

  useEffect(() => { run(async () => setProducts(await api('/products?q=' + encodeURIComponent(q)))); }, [q]);

  const items = Object.values(cart);
  const total = items.reduce((s, i) => s + i.p.price_cents * i.qty, 0);
  const add = (p) => setCart((c) => ({ ...c, [p.id]: { p, qty: (c[p.id]?.qty || 0) + 1 } }));
  const remove = (id) => setCart(({ [id]: _, ...rest }) => rest);
  const loadOrders = () => run(async () => setOrders(await api('/orders')));

  const submitAuth = () => run(async () => {
    const d = await api(signup ? '/auth/signup' : '/auth/login', 'POST', form);
    localStorage.setItem('token', d.token);
    setToken(d.token);
    setMsg('Welcome, ' + d.user.name);
    setView('shop');
  });

  const checkout = () => run(async () => {
    if (!token) { setView('login'); return setMsg('Log in to place your order'); }
    const d = await api('/orders', 'POST', { items: items.map((i) => ({ productId: i.p.id, qty: i.qty })) });
    setCart({});
    setMsg('Order #' + d.orderId + ' placed. Total ' + money(d.total));
    setView('orders');
    loadOrders();
  });

  const logout = () => { localStorage.removeItem('token'); setToken(''); setOrders([]); setView('shop'); };

  return (
    <>
      <nav>
        <h1>Shop</h1>
        <button onClick={() => setView('shop')}>Products</button>
        <button onClick={() => setView('cart')}>Cart ({items.reduce((s, i) => s + i.qty, 0)})</button>
        {token ? (
          <>
            <button onClick={() => { setView('orders'); loadOrders(); }}>My orders</button>
            <button onClick={logout}>Log out</button>
          </>
        ) : (
          <button className="primary" onClick={() => setView('login')}>Log in</button>
        )}
      </nav>
      <main>
        {msg && <div className="msg" role="status">{msg}</div>}

        {view === 'shop' && (
          <>
            <input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="grid">
              {products.map((p) => (
                <div className="card" key={p.id}>
                  <strong>{p.name}</strong>
                  <p>{p.description}</p>
                  <span>{money(p.price_cents)} · {p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</span>
                  <button className="primary" disabled={p.stock < 1} onClick={() => add(p)}>Add to cart</button>
                </div>
              ))}
              {!products.length && <p>No products match your search.</p>}
            </div>
          </>
        )}

        {view === 'cart' && (
          <>
            <h2>Your cart</h2>
            {!items.length && <p>Your cart is empty. Add a product to get started.</p>}
            {items.map(({ p, qty }) => (
              <div className="row" key={p.id}>
                <span>{p.name} × {qty}</span>
                <span>{money(p.price_cents * qty)} <button onClick={() => remove(p.id)}>Remove</button></span>
              </div>
            ))}
            {!!items.length && (
              <>
                <p><strong>Total: {money(total)}</strong></p>
                <button className="primary" onClick={checkout}>Place order</button>
              </>
            )}
          </>
        )}

        {view === 'login' && (
          <div className="small">
            <h2>{signup ? 'Create account' : 'Log in'}</h2>
            {signup && <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button className="primary" onClick={submitAuth}>{signup ? 'Create account' : 'Log in'}</button>{' '}
            <button onClick={() => setSignup(!signup)}>{signup ? 'I have an account' : 'Create an account'}</button>
          </div>
        )}

        {view === 'orders' && (
          <>
            <h2>My orders</h2>
            {!orders.length && <p>No orders yet.</p>}
            {orders.map((o) => (
              <div className="row" key={o.id}>
                <span>Order #{o.id} · {new Date(o.created_at).toLocaleDateString()}</span>
                <span>{money(o.total_cents)} · {o.status}</span>
              </div>
            ))}
          </>
        )}
      </main>
    </>
  );
}
