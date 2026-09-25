import type { INodeProperties } from 'n8n-workflow';
import { portalFieldOptions } from './shared';

export const createPortalOperation: INodeProperties[] = [
  {
    displayName: 'Portal Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createPortal'],
      },
    },
    description: 'Name of the portal',
  },
  {
    displayName: 'Slug',
    name: 'slug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createPortal'],
      },
    },
    description: 'Unique slug for the portal URL (e.g., "my-help-center")',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createPortal'],
      },
    },
    options: portalFieldOptions,
  },
];
