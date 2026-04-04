import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/token.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    let message = 'Invalid email or password';
    if (process.env.NODE_ENV !== 'production' && (await User.countDocuments()) === 0) {
      message =
        'No users in the database. Start the API (it creates demo accounts on first run), or run npm run seed in the server folder. Check DISABLE_AUTO_SEED is not set.';
    }
    return res.status(401).json({ message });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: 'Account disabled' });
  }
  const token = signToken(user._id);
  res.json({
    token,
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
    },
  });
});
