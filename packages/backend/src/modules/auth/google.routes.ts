import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { handleGoogleUser } from './google.service';

const router = Router();

// Only mount routes if Google credentials are configured
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
  const passport = require('passport');

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.BACKEND_URL.replace(/\/$/, '')}/api/v1/auth/google/callback`,
      },
      (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
        done(null, profile);
      },
    ),
  );

  passport.serializeUser((user: any, done: Function) => done(null, user));
  passport.deserializeUser((user: any, done: Function) => done(null, user));

  router.use(passport.initialize());

  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=google_failed` }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (req: any, res: Response, _next: NextFunction) => {
      try {
        const result = await handleGoogleUser(req.user as any);
        const params = new URLSearchParams({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isNew: String(result.isNew),
        });
        res.redirect(`${env.FRONTEND_URL}/auth/callback?${params.toString()}`);
      } catch {
        res.redirect(`${env.FRONTEND_URL}/login?error=google_failed`);
      }
    },
  );
}

export default router;
