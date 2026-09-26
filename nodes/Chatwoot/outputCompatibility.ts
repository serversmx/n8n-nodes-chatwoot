import type { INodeProperties } from 'n8n-workflow';

// These operations returned the complete API envelope in v0.8.3. Keep that default
// on node version 1, including empty lists and metadata used by saved expressions.
export const outputCompatibilityFields: INodeProperties[] = Object.entries({
  helpCenter: ['listCategories', 'listPortals'],
  inbox: ['getMembers'],
  slaPolicy: ['getAll'],
  webhook: ['create', 'getAll', 'update'],
}).map(([resource, operations]) => ({
  displayName: 'Simplify Output',
  name: 'simplifyOutput',
  type: 'boolean',
  default: false,
  displayOptions: { show: { resource: [resource], operation: operations } },
  description:
    'Whether to unwrap the API response and return one item per record. Leave off to preserve the complete response, including payload and metadata, used by existing workflows.',
}));
