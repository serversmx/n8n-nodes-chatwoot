import type { INodeProperties } from 'n8n-workflow';

export const rotateHmacTokenOperation: INodeProperties[] = [
  {
    displayName: 'Inbox',
    name: 'inboxId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getInboxes',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['rotateHmacToken'],
      },
    },
    description:
      'Select the Website or API inbox whose identity verification (HMAC) token should be rotated. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
