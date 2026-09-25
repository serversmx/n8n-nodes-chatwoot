import type { INodeProperties } from 'n8n-workflow';
import { categoryFieldOptions } from './shared';

export const createCategoryOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createCategory'],
      },
    },
    description: 'Slug of the portal to create category in',
  },
  {
    displayName: 'Category Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createCategory'],
      },
    },
    description: 'Name of the category',
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
        operation: ['createCategory'],
      },
    },
    description: 'Unique slug for the category',
  },
  {
    displayName: 'Locale',
    name: 'locale',
    type: 'string',
    required: true,
    default: 'en',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createCategory'],
      },
    },
    description: 'Locale code for the category (e.g., "en", "es")',
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
        operation: ['createCategory'],
      },
    },
    options: categoryFieldOptions,
  },
];
