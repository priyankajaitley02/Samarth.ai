import cors from 'cors';

const allowedOrigins = [
  'https://samarth-web.vercel.app',
  'https://samarth-app.vercel.app',
  'http://localhost:5173'
];

export const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  optionsSuccessStatus: 204
});
