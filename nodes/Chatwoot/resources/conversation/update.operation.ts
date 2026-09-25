import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['update'],
      },
    },
    description: 'ID of the conversation to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['update'],
      },
    },
    description:
      'Chatwoot only lets you update the priority and the SLA policy of a conversation. Use Assign, Add Labels, Update Status or Update Custom Attributes for anything else.',
    options: [
      {
        displayName: 'Priority',
        name: 'priority',
        type: 'options',
        options: [
          { name: 'Urgent', value: 'urgent' },
          { name: 'High', value: 'high' },
          { name: 'Medium', value: 'medium' },
          { name: 'Low', value: 'low' },
          { name: 'None', value: 'none' },
        ],
        default: 'none',
        description: 'Priority level of the conversation. None clears the priority.',
      },
      {
        displayName: 'SLA Policy ID',
        name: 'sla_policy_id',
        type: 'number',
        default: 0,
        description:
          'Apply this SLA policy to the conversation. Requires Chatwoot Enterprise with the SLA feature enabled; ignored otherwise.',
      },
      {
        displayName: 'Snoozed Until',
        name: 'snoozed_until',
        type: 'dateTime',
        default: '',
        description:
          'Snooze the conversation until this time. The node sets the status to Snoozed through the Toggle Status endpoint (same as Update Status).',
      },
    ],
  },
];
