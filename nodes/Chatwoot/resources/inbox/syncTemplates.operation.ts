import type { INodeProperties } from 'n8n-workflow';

export const syncTemplatesOperation: INodeProperties[] = [
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
        operation: ['syncTemplates'],
      },
    },
    description:
      'Select the WhatsApp inbox whose message templates should be synced. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
