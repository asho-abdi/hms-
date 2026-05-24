import { body } from 'express-validator';

export const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6–128 characters'),
];
