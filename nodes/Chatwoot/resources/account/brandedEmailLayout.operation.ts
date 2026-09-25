import type { INodeProperties } from 'n8n-workflow';

export const brandedEmailLayoutOperation: INodeProperties[] = [
  {
    displayName: 'Branded Email Layout',
    name: 'brandedEmailLayout',
    type: 'string',
    typeOptions: {
      rows: 8,
    },
    default: '',
    placeholder: '<html><body>{{ content_for_layout }}</body></html>',
    displayOptions: {
      show: {
        resource: ['account'],
        operation: ['updateBrandedEmailLayout'],
      },
    },
    description:
      'Liquid HTML layout wrapped around outgoing email replies. Must contain {{ content_for_layout }} (max 262,144 characters). Leave empty to remove the account layout.',
  },
];
