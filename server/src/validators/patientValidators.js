import { body, param } from 'express-validator';

export const createPatientValidation = [
  body('full_name').trim().isLength({ min: 2, max: 120 }).withMessage('Full name required'),
  body('phone').trim().isLength({ min: 5, max: 30 }).withMessage('Valid phone required'),
  body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
  body('dob').isISO8601().withMessage('Valid date of birth required'),
  body('address').optional().trim().isLength({ max: 300 }),
];

export const updatePatientValidation = [
  param('id').isMongoId().withMessage('Invalid patient id'),
  body('full_name').optional().trim().isLength({ min: 2, max: 120 }),
  body('phone').optional().trim().isLength({ min: 5, max: 30 }),
  body('gender').optional().isIn(['male', 'female']),
  body('dob').optional().isISO8601(),
  body('address').optional().trim().isLength({ max: 300 }),
];

export const mongoIdParam = [param('id').isMongoId().withMessage('Invalid id')];
