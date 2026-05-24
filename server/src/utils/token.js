import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function secret() {
  return process.env.JWT_SECRET;
}

export function signAccessToken(userId) {
  return jwt.sign({ userId, type: 'access' }, secret(), {
    expiresIn: env.accessTokenExpires,
  });
}

export function signRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, secret(), {
    expiresIn: env.refreshTokenExpires,
  });
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, secret());
  if (decoded.type != null && decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, secret());
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
