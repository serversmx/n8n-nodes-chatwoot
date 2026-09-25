import type { INodeProperties } from 'n8n-workflow';
import { articleFieldOptions } from './shared';

export const createArticleOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createArticle'],
      },
    },
    description: 'Slug of the portal to create article in',
  },
  {
    displayName: 'Title',
    name: 'title',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createArticle'],
      },
    },
    description: 'Title of the article',
  },
  {
    displayName: 'Content',
    name: 'content',
    type: 'string',
    typeOptions: {
      rows: 10,
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['createArticle'],
      },
    },
    description: 'Content of the article (Markdown/HTML)',
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
        operation: ['createArticle'],
      },
    },
    options: articleFieldOptions(false),
  },
];
