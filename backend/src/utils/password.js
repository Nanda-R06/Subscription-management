import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

/**
 * Validates password rules according to Brightloop specification:
 * - More than 8 characters (minimum 9 characters)
 * - At least one uppercase character
 * - At least one lowercase character
 * - At least one special character
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required and must be a string.'],
    };
  }

  if (password.length <= 8) {
    errors.push('Password must be more than 8 characters (at least 9 characters long).');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z).');
  }

  if (!SPECIAL_CHARS_REGEX.test(password)) {
    errors.push('Password must contain at least one special character (e.g. !@#$%^&*).');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates email format
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plain password against bcrypt hash
 */
export async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}
