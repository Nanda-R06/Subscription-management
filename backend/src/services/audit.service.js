import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';

/**
 * Record an audit log entry for security and compliance
 */
export async function logAudit({
  userId = null,
  action,
  entityType,
  entityId = null,
  details = null,
  ipAddress = null,
}) {
  try {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const detailsJson = details ? JSON.stringify(details) : null;

    await query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, userId, action, entityType, entityId, detailsJson, ipAddress, createdAt]
    );
  } catch (err) {
    // Audit logging should not crash the primary transaction, but must log warning
    console.error('⚠️ Failed to write audit log:', err.message);
  }
}
