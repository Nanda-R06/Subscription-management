import { query } from '../db/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Authenticates request via JWT Access Token in Authorization header
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is required.');
    }

    const token = authHeader.split(' ')[1];
    const verification = verifyAccessToken(token);

    if (!verification.valid) {
      throw new UnauthorizedError(`Authentication failed: ${verification.message}`);
    }

    // Verify user exists and is active in database
    const userResult = await query(
      'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
      [verification.payload.id]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User account associated with this token does not exist.');
    }

    const user = userResult.rows[0];

    // Check active status (handles both boolean true/false and sqlite 1/0)
    if (!user.is_active || user.is_active === 0 || user.is_active === '0') {
      throw new ForbiddenError('This user account has been deactivated.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces Role-Based Access Control (RBAC)
 * e.g. requireRole('admin') or requireRole('admin', 'staff')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
