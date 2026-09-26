import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Title',
    name: 'title',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['label'],
        operation: ['create'],
      },
    },
    description:
      'Title of the label (e.g., "urgent", "vip", "bug"). Chatwoot stores it in lowercase; letters, numbers, "-" and "_" only.',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['label'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        description: 'Description of the label',
      },
      {
        displayName: 'Color',
        name: 'color',
        type: 'color',
        default: '#1F93FF',
        description: 'Color of the label (hex format)',
      },
      {
        displayName: 'Show on Sidebar',
        name: 'show_on_sidebar',
        type: 'boolean',
        default: true,
        description: 'Whether to display this label in the conversation sidebar',
      },
    ],
  },
];
