import type { INodeProperties } from 'n8n-workflow';

export const listCategoriesOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['listCategories'],
      },
    },
    description: 'Slug of the portal (Chatwoot looks portals up by slug, not by ID)',
  },
  {
    displayName: 'Locale',
    name: 'locale',
    type: 'string',
    default: 'en',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['listCategories'],
      },
    },
    description: 'Only categories of this locale (e.g. en, es). Leave empty for all locales.',
  },
];
