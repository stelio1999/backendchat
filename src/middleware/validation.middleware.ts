import { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'

export const validate = (method: string) => {
  switch (method) {
    case 'register': {
      return [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
        body('phone').notEmpty(),
        body('birthDate').isISO8601(),
        body('nationality').notEmpty(),
      ]
    }
    case 'login': {
      return [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty(),
      ]
    }
    case 'updateProfile': {
      return [
        body('name').optional().trim().isLength({ min: 2, max: 100 }),
        body('status').optional().trim().isLength({ max: 100 }),
      ]
    }
    case 'createGroup': {
      return [
        body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
        body('description').optional().trim(),
        body('participants').optional().isArray(),
      ]
    }
    default: {
      return []
    }
  }
}

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() })
    return
  }
  next()
}