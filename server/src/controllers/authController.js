import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/token.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/authCookies.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

function lockRemainingMinutes(lockUntil) {
  return Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +refreshTokenHash +failedLoginAttempts +lockUntil'
  );

  if (!user) {
    if (process.env.NODE_ENV !== 'production' && (await User.countDocuments()) === 0) {
      throw ApiError.unauthorized(
        'No users in the database. Start the API (it creates demo accounts on first run), or run npm run seed in the server folder.'
      );
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw ApiError.locked(
      `Account locked. Try again in ${lockRemainingMinutes(user.lockUntil)} minute(s).`
    );
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= env.maxLoginAttempts) {
      user.lockUntil = new Date(Date.now() + env.lockMinutes * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account disabled');
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    token: accessToken,
    expiresIn: env.accessTokenExpires,
    user: publicUser(user),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw =
    req.cookies?.[env.refreshCookieName] || req.body?.refreshToken;
  if (!raw) {
    throw ApiError.unauthorized('Refresh token required');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(raw);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || !user.isActive || !user.refreshTokenHash) {
    throw ApiError.unauthorized('Session expired');
  }

  if (user.refreshTokenHash !== hashToken(raw)) {
    user.refreshTokenHash = null;
    await user.save();
    throw ApiError.unauthorized('Session revoked');
  }

  const accessToken = signAccessToken(user._id);
  const newRefresh = signRefreshToken(user._id);
  user.refreshTokenHash = hashToken(newRefresh);
  await user.save();

  setRefreshCookie(res, newRefresh);

  res.json({
    success: true,
    token: accessToken,
    expiresIn: env.accessTokenExpires,
    user: publicUser(user),
  });
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[env.refreshCookieName];
  if (raw) {
    try {
      const decoded = verifyRefreshToken(raw);
      await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null });
    } catch {
      /* cookie invalid — still clear client session */
    }
  } else if (req.user?._id) {
    await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});
