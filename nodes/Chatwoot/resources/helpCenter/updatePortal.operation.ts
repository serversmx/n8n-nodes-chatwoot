import type { INodeProperties } from 'n8n-workflow';
import { portalFieldOptions } from './shared';

export const updatePortalOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['updatePortal'],
      },
    },
    description: 'Slug of the portal to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['updatePortal'],
      },
    },
    description:
      'Config fields are merged into the current portal config (the node reads the portal first), so unset locales and settings are kept',
    options: [
      ...portalFieldOptions,
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the portal',
      },
      {
        displayName: 'Slug',
        name: 'slug',
        type: 'string',
        default: '',
        description: 'New slug of the portal (changes its public URL)',
      },
    ],
  },
];
