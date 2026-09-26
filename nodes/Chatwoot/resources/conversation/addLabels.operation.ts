import type { INodeProperties } from 'n8n-workflow';

export const addLabelsOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['addLabels', 'appendLabels', 'removeLabels'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Labels',
    name: 'labels',
    type: 'multiOptions',
    typeOptions: {
      loadOptionsMethod: 'getLabels',
    },
    required: true,
    default: [],
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['addLabels', 'appendLabels', 'removeLabels'],
      },
    },
    description: 'Label titles (not IDs), as an array or comma-separated string. Set Labels replaces all labels (an empty list clears them); Add/Remove Labels keep the other labels and require a non-empty list. Choose from the list or use an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
