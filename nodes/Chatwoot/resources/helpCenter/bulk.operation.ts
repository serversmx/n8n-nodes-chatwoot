import type { INodeProperties } from 'n8n-workflow';

const BULK_OPERATIONS = [
  'bulkDeleteArticles',
  'bulkUpdateArticleCategory',
  'bulkUpdateArticleStatus',
];

export const bulkOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['helpCenter'], operation: BULK_OPERATIONS } },
    description: 'Slug of the portal that contains the articles',
  },
  {
    displayName: 'Article IDs',
    name: 'articleIds',
    type: 'string',
    required: true,
    default: '',
    placeholder: '12, 13, 14',
    displayOptions: { show: { resource: ['helpCenter'], operation: BULK_OPERATIONS } },
    description:
      'Comma-separated IDs of the articles (Chatwoot answers 422 when none of them exists in the portal)',
  },
  {
    displayName: 'Status',
    name: 'bulkStatus',
    type: 'options',
    required: true,
    options: [
      { name: 'Archived', value: 'archived' },
      { name: 'Draft', value: 'draft' },
      { name: 'Published', value: 'published' },
    ],
    default: 'published',
    displayOptions: { show: { resource: ['helpCenter'], operation: ['bulkUpdateArticleStatus'] } },
    description: 'New status for all the articles',
  },
  {
    displayName: 'Category Name or ID',
    name: 'bulkCategoryId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getCategories',
      loadOptionsDependsOn: ['portalSlug'],
    },
    required: true,
    default: '',
    displayOptions: {
      show: { resource: ['helpCenter'], operation: ['bulkUpdateArticleCategory'] },
    },
    description:
      'Category to move the articles to (must belong to the same portal). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
