import type { INodeProperties } from 'n8n-workflow';
import { categoryFieldOptions } from './shared';

export const categoryOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['deleteCategory', 'getCategory', 'updateCategory'],
      },
    },
    description: 'Slug of the portal that contains the category',
  },
  {
    displayName: 'Category Name or ID',
    name: 'categoryId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getCategories',
      loadOptionsDependsOn: ['portalSlug'],
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['deleteCategory', 'getCategory', 'updateCategory'],
      },
    },
    description:
      'The category. Requires Portal Slug to be filled first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
        operation: ['updateCategory'],
      },
    },
    options: [
      ...categoryFieldOptions,
      {
        displayName: 'Locale',
        name: 'locale',
        type: 'string',
        default: '',
        description: 'Locale code of the category (e.g. "en", "es")',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the category',
      },
      {
        displayName: 'Slug',
        name: 'slug',
        type: 'string',
        default: '',
        description: 'Slug of the category',
      },
    ],
  },
];
