import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Label',
    name: 'labelId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getLabels',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['label'],
        operation: ['update'],
      },
    },
    description:
      'Label to update. Choose from the list, or specify the label ID or its exact title using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['label'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        description: 'Title of the label',
      },
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
