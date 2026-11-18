import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(cors(), express.json());

const sign = (u) => jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const auth = (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Log in to continue' });
  }
};

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Enter name, email and a password of 6+ characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows: [u] } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email.toLowerCase(), hash]);
    res.json({ token: sign(u), user: u });
  } catch {
    res.status(409).json({ error: 'This email is already registered' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email = '', password = '' } = req.body;
  const { rows: [u] } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email } });
});

app.get('/api/products', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE name ILIKE $1 ORDER BY id', ['%' + (req.query.q || '') + '%']);
  res.json(rows);
});

app.get('/api/products/:id', async (req, res) => {
  const { rows: [p] } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  p ? res.json(p) : res.status(404).json({ error: 'Product not found' });
});

app.post('/api/orders', auth, async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Your cart is empty' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0;
    const lines = [];
    for (const { productId, qty } of items) {
      if (!Number.isInteger(qty) || qty < 1) throw new Error('Invalid quantity');
      const { rows: [p] } = await client.query(
        'UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2 RETURNING price_cents',
        [productId, qty]);
      if (!p) throw new Error('An item is out of stock');
      total += p.price_cents * qty;
      lines.push([productId, qty, p.price_cents]);
    }
    // Payment step: replace with Razorpay/Stripe test-mode charge before marking paid.
    const { rows: [o] } = await client.query(
      "INSERT INTO orders (user_id, total_cents, status) VALUES ($1, $2, 'paid') RETURNING id",
      [req.user.id, total]);
    for (const [pid, qty, price] of lines)
      await client.query(
        'INSERT INTO order_items (order_id, product_id, qty, price_cents) VALUES ($1, $2, $3, $4)',
        [o.id, pid, qty, price]);
    await client.query('COMMIT');
    res.json({ orderId: o.id, total });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get('/api/orders', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, total_cents, status, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC',
    [req.user.id]);
  res.json(rows);
});

app.listen(process.env.PORT || 5000, () => console.log('API running on port ' + (process.env.PORT || 5000)));
