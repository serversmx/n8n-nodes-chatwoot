import type { INodeProperties } from 'n8n-workflow';

/**
 * Add Labels, Remove Labels and both Set Labels aliases share the same two fields. Chatwoot only offers
 * "replace all labels" (POST /contacts/:id/labels); Add and Remove read the current labels first.
 */
export const addLabelsOperation: INodeProperties[] = [
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['addLabels', 'appendLabels', 'removeLabels', 'setLabels'],
      },
    },
    description: 'ID of the contact whose labels are changed',
  },
  {
    displayName: 'Labels',
    name: 'labels',
    type: 'multiOptions',
    typeOptions: {
      loadOptionsMethod: 'getLabels',
    },
    default: [],
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['appendLabels'],
      },
    },
    description:
      'Labels to add. The contact keeps its current labels. Choose from the list, or pass label titles (an array or a comma-separated string) with an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Labels',
    name: 'labels',
    type: 'multiOptions',
    typeOptions: {
      loadOptionsMethod: 'getLabels',
    },
    default: [],
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['removeLabels'],
      },
    },
    description:
      'Labels to remove. Other labels of the contact are kept. Choose from the list, or pass label titles (an array or a comma-separated string) with an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Labels',
    name: 'labels',
    type: 'multiOptions',
    typeOptions: {
      loadOptionsMethod: 'getLabels',
    },
    default: [],
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['addLabels', 'setLabels'],
      },
    },
    description:
      'The complete new label list: labels not in it are removed, and an empty list clears all labels. Choose from the list, or pass label titles (an array or a comma-separated string) with an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
