import type { INodeProperties } from 'n8n-workflow';

export const getMessageTemplatesOperation: INodeProperties[] = [
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
        operation: ['getMessageTemplates'],
      },
    },
    description:
      'Select the WhatsApp inbox. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Template Name',
    name: 'templateName',
    type: 'string',
    default: '',
    placeholder: 'order_confirmation',
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['getMessageTemplates'],
      },
    },
    description:
      'Only return templates with exactly this name (the friendly name for Twilio WhatsApp inboxes). Leave empty to return all templates.',
  },
];
