import type { INodeProperties } from 'n8n-workflow';
import { articleFieldOptions } from './shared';

export const articleOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['deleteArticle', 'getArticle', 'updateArticle'],
      },
    },
    description: 'Slug of the portal that contains the article',
  },
  {
    displayName: 'Article ID',
    name: 'articleId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['deleteArticle', 'getArticle', 'updateArticle'],
      },
    },
    description: 'The ID of the article',
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
        operation: ['updateArticle'],
      },
    },
    description:
      'Only Draft Title/Draft Content: staged edit that keeps the published version. Meta fields are merged into the current meta.',
    options: articleFieldOptions(true),
  },
];
