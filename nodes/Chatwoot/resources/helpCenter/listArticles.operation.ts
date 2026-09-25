import type { INodeProperties } from 'n8n-workflow';

export const listArticlesOperation: INodeProperties[] = [
  {
    displayName: 'Portal Slug',
    name: 'portalSlug',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['listArticles'],
      },
    },
    description: 'Slug of the portal (Chatwoot looks portals up by slug, not by ID)',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['listArticles'],
      },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['listArticles'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['helpCenter'],
        operation: ['listArticles'],
      },
    },
    options: [
      {
        displayName: 'Author Name or ID',
        name: 'author_id',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        default: '',
        description:
          'Only articles written by this agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Locale',
        name: 'locale',
        type: 'string',
        default: 'en',
        description: 'Filter articles by locale',
      },
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        default: '',
        description: 'Full-text search in title, description and content',
      },
      {
        displayName: 'Category Slug',
        name: 'category_slug',
        type: 'string',
        default: '',
        description: 'Filter articles by category slug',
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'All', value: '' },
          { name: 'Draft', value: 'draft' },
          { name: 'Published', value: 'published' },
          { name: 'Archived', value: 'archived' },
        ],
        default: '',
        description: 'Filter articles by status',
      },
    ],
  },
];
