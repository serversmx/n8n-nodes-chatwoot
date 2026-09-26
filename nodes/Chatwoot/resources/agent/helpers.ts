import type { IDataObject } from 'n8n-workflow';

// The pre-0.9.0 "Availability Status" field used the read-only availability_status values
const LEGACY_AVAILABILITY: Record<string, string> = {
  available: 'online',
  busy: 'busy',
  offline: 'offline',
};

/**
 * Map the agent option fields to the AgentsController params: `availability` (online/busy/
 * offline; the legacy availability_status value is converted), `auto_offline` and, on Enterprise,
 * `custom_role_id` (0 clears it on update and is omitted on create).
 */
export function buildAgentBody(fields: IDataObject, operation: 'create' | 'update'): IDataObject {
  const body: IDataObject = {};
  if (fields.name) body.name = fields.name;
  if (fields.role) body.role = fields.role;

  const availability =
    fields.availability ??
    (fields.availability_status !== undefined
      ? LEGACY_AVAILABILITY[fields.availability_status as string]
      : undefined);
  if (availability) body.availability = availability;

  if (fields.auto_offline !== undefined) body.auto_offline = fields.auto_offline;

  if (fields.custom_role_id !== undefined) {
    const roleId = Number(fields.custom_role_id);
    if (roleId > 0) body.custom_role_id = roleId;
    else if (operation === 'update') body.custom_role_id = null;
  }
  return body;
}
