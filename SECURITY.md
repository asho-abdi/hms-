# HMS Security Overview

Production deployment checklist for the Somali International University Hospital Management System.

## Backend (Render / Railway)

1. Set `NODE_ENV=production`, `JWT_SECRET` (32+ chars), `MONGODB_URI`, `CLIENT_ORIGIN`.
2. Set `TRUST_PROXY=true` and `DISABLE_AUTO_SEED=true`.
3. If frontend is on a different domain (Vercel), set `CROSS_SITE_COOKIES=true`.
4. Use MongoDB Atlas with IP allowlist and strong credentials.

## Frontend (Vercel)

1. Set `VITE_API_BASE_URL=https://your-api.onrender.com/api`.
2. Add the Vercel URL to backend `CLIENT_ORIGIN`.

## Implemented controls

- Helmet, CORS allowlist, HPP, MongoDB sanitization
- Rate limits (login, API, uploads)
- JWT access (short) + httpOnly refresh cookie with rotation
- Account lockout after failed logins
- Role-based route protection (server + React)
- Input validation (express-validator on auth/patients)
- Secure uploads (type, size, auth)
- Centralized errors (no stack traces in production)
- Idempotency on payment endpoint
