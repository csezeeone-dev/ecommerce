# Shop: simple e-commerce app

React (Vite) frontend, Node.js + Express backend, PostgreSQL database.

## Run locally
1. Create the database and tables:
   `createdb shop && psql shop -f backend/schema.sql`
2. Backend: `cd backend && cp .env.example .env` (edit values), then `npm install && npm run dev`
3. Frontend (new terminal): `cd frontend && npm install && npm run dev`
4. Open http://localhost:5173

## Included
Signup and login (JWT), product list and search, cart, checkout with stock check, order history.

## Not included yet
Real payment (a marked placeholder is in `backend/server.js`), admin panel, inventory and email services.
