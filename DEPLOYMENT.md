# InterviewIQ deployment checklist

## Local development

1. Copy `server/.env.example` to `server/.env` and set the server-only values.
2. Copy `client/.env.example` to `client/.env` and set `VITE_SERVER_URL=http://localhost:8000` plus the Firebase web configuration values.
3. Start the API with `cd server` then `npm run dev`.
4. Start the web app with `cd client` then `npm run dev`.

`PAYMENT_MODE=demo` is for local testing only. It displays the mock checkout and safely adds test credits. It must never be deployed to production.

## Required production configuration

Set these only in the hosting provider's encrypted environment-variable settings. Do not commit them or send them in chat.

### Server

```text
NODE_ENV=production
MONGODB_URL=
JWT_SECRET=
CLIENT_URLS=https://your-frontend-domain.example
OPENROUTER_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
PAYMENT_MODE=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` come from a Firebase service-account JSON file: Firebase Console → Project settings → Service accounts → Generate new private key. Copy the matching values into the server environment. Preserve newline escapes in `FIREBASE_PRIVATE_KEY` (`\n`), as shown in `.env.example`.

In Firebase Console → Authentication → Sign-in method, enable both **Google** and **Email/Password**. In Authentication → Settings → Authorised domains, ensure `localhost` is present for local use and add the deployed frontend domain before release.

### Client

```text
VITE_SERVER_URL=https://your-api-domain.example
VITE_FIREBASE_APIKEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_RAZORPAY_KEY_ID=rzp_live_...
```

The Firebase web API key and Razorpay key ID are intended for browser use. Never place `OPENROUTER_API_KEY`, `RAZORPAY_KEY_SECRET`, the Firebase private key, MongoDB URL, or JWT secret in a Vite variable.

## Before release

- Add the final frontend URL to `CLIENT_URLS` exactly, including `https://` and no trailing slash.
- In Firebase Authentication, add the deployed frontend hostname to **Authorized domains**.
- In Razorpay, replace test credentials with live credentials only when real payments are approved and tested.
- Confirm `/api/health` returns `{"status":"ok"}` from the deployed API.
- Run `npm audit --audit-level=high` in both `client` and `server` and `npm run build` in `client`.
