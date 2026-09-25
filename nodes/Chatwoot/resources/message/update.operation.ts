import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName:
      'Chatwoot does not allow editing message content. This operation updates the delivery status of a message in an API inbox (e.g. to mirror WhatsApp delivery or read receipts from Evolution); other inboxes answer 403.',
    name: 'updateNotice',
    type: 'notice',
    default: '',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['update'],
      },
    },
  },
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['update'],
      },
    },
    description: 'ID of the conversation containing the message',
  },
  {
    displayName: 'Message ID',
    name: 'messageId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['update'],
      },
    },
    description: 'ID of the message to update',
  },
  {
    displayName: 'Status',
    name: 'deliveryStatus',
    type: 'options',
    options: [
      { name: 'Sent', value: 'sent' },
      { name: 'Delivered', value: 'delivered' },
      { name: 'Read', value: 'read' },
      { name: 'Failed', value: 'failed' },
    ],
    // No preselected status: workflows saved when this operation sent "Content" (which Chatwoot always
    // ignored) must fail with an explanation instead of silently marking their messages as delivered.
    // Not `required`, because n8n refuses to run a whole workflow with an empty required parameter.
    // eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options
    default: '',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['update'],
      },
    },
    description:
      'New delivery status (must be selected). Recent Chatwoot versions only move forward (sent → delivered → read); a backward change is ignored and the unchanged message is returned. Changes to or from Failed are always applied.',
  },
  {
    displayName: 'External Error',
    name: 'externalError',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['update'],
        deliveryStatus: ['failed'],
      },
    },
    description: 'Reason shown to agents for the failed delivery (e.g. the error returned by WhatsApp)',
  },
];
