import cors from 'cors';
import { env } from './env';

const allowedOrigin = env.FRONTEND_URL.replace(/\/$/, '');
const vercelPreview = /^https:\/\/[\w-]+\.vercel\.app$/;
// Em dev o Vite pode subir em outra porta (5174…) se a 5173 estiver ocupada
const localDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const isDev = env.NODE_ENV !== 'production';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      origin.replace(/\/$/, '') === allowedOrigin ||
      vercelPreview.test(origin) ||
      (isDev && localDev.test(origin))
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
});
