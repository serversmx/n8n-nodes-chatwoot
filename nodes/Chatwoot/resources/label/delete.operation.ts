import type { INodeProperties } from 'n8n-workflow';

export const deleteOperation: INodeProperties[] = [
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
        operation: ['delete'],
      },
    },
    description:
      'Label to delete. Choose from the list, or specify the label ID or its exact title using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
