import type { INodeProperties } from 'n8n-workflow';

export const getRecipientsOperation: INodeProperties[] = [
  {
    displayName: 'Campaign ID',
    name: 'campaignId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['campaign'], operation: ['getRecipients'] } },
    description: 'The ID of a one-off WhatsApp campaign (the "id" returned by Get Many)',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['campaign'], operation: ['getRecipients'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: { resource: ['campaign'], operation: ['getRecipients'], returnAll: [false] },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: { resource: ['campaign'], operation: ['getRecipients'] } },
    options: [
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'Delivered', value: 'delivered', description: 'Delivered but not read yet' },
          {
            name: 'Failed',
            value: 'failed',
            description: 'WhatsApp rejected the message (see error_code/error_message)',
          },
          { name: 'Queued', value: 'queued', description: 'Waiting to be sent' },
          { name: 'Read', value: 'read' },
          {
            name: 'Sent',
            value: 'sent',
            description: 'Accepted by WhatsApp, no delivery receipt yet',
          },
          {
            name: 'Skipped',
            value: 'skipped',
            description: 'Not sent (e.g. no phone number or template variables resolved to blank)',
          },
        ],
        default: 'failed',
        description: 'Only return recipients in this delivery status',
      },
    ],
  },
];
