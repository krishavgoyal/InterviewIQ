# InterviewIQ.AI

InterviewIQ is an AI-powered mock-interview platform for practising role-specific interviews, receiving answer-level feedback, and reviewing a detailed performance report.

## Highlights

- Firebase email/password and Google authentication
- Resume-led interview preparation with an optional job description
- AI-generated technical and HR questions with configurable topic allocation
- Voice transcription, typed answers, code editor, and scribble-pad support
- AI feedback after each response and a downloadable end-of-interview report
- Interview history, credit tracking, and a clearly labelled simulated checkout

## Technology

- **Client:** React, Vite, Redux Toolkit, Tailwind CSS, Firebase Web SDK
- **Server:** Node.js, Express, MongoDB/Mongoose, Firebase Admin SDK
- **AI:** OpenRouter

## Local setup

1. Copy `server/.env.example` to `server/.env` and set the server-only values.
2. Copy `client/.env.example` to `client/.env` and set the Firebase web configuration and `VITE_SERVER_URL=http://localhost:8000`.
3. Start the API:

   ```bash
   cd server
   npm install
   npm run dev
   ```

4. Start the client in another terminal:

   ```bash
   cd client
   npm install
   npm run dev
   ```

## Demo credits

The checkout in this repository is a **simulation only**. It does not contact Razorpay, charge money, or collect real payment information. It exists to demonstrate the credit-purchase user experience.

For production environment variables and hosting setup, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Security

Never commit `.env` files, MongoDB URLs, Firebase service-account keys, OpenRouter keys, or JWT secrets. Use the encrypted environment-variable settings provided by the deployment host.
