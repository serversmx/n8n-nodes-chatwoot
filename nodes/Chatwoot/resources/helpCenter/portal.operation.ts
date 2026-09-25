import type { INodeProperties } from 'n8n-workflow';

export const portalOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['deletePortal'],
      },
    },
    description: 'Slug of the portal to delete (its categories and articles are deleted too)',
  },
];
