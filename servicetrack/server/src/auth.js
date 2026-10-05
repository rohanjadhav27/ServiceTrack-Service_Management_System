import jwt from 'jsonwebtoken';
import { User } from './models.js';
import { config } from './config.js';
import { AppError } from './domain.js';
export async function authenticate(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.session || '', config.secret, { algorithms: ['HS256'] });
    req.user = await User.findById(payload.sub);
    if (!req.user) throw new Error('Unknown user');
    next();
  } catch {
    next(new AppError('Please sign in to continue.', 401));
  }
}
export function advisor(req, res, next) {
  if (req.user.role !== 'advisor') return next(new AppError('Advisor access required.', 403));
  next();
}
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
};
