import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Source ID',
    name: 'sourceId',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['create'],
      },
    },
    description:
      "The contact's identifier in the inbox channel (contact inbox source ID, e.g. phone number or email). Required unless Contact ID is set. With a Contact ID and no Source ID, Chatwoot derives it from the contact's phone number (WhatsApp, SMS) or email (email inboxes), or generates a random one for API (e.g. Evolution) and website inboxes; other channel types need a Source ID.",
  },
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
        resource: ['conversation'],
        operation: ['create'],
      },
    },
    description: 'Inbox to create the conversation in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Additional Attributes (JSON)',
        name: 'additional_attributes',
        type: 'json',
        default: '{}',
        description: 'Conversation additional attributes as a JSON object (e.g. {"mail_subject": "Order 123"})',
      },
      {
        displayName: 'Assignee ID',
        name: 'assignee_id',
        type: 'number',
        default: 0,
        description: 'Agent ID to assign the conversation to',
      },
      {
        displayName: 'Contact ID',
        name: 'contact_id',
        type: 'number',
        default: 0,
        description: 'ID of an existing contact to associate with the conversation',
      },
      {
        displayName: 'Custom Attributes (JSON)',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description: 'Custom attributes as JSON object',
      },
      {
        displayName: 'Initial Message',
        name: 'message_content',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        default: '',
        description: 'Outgoing message created together with the conversation (in the same transaction)',
      },
      {
        displayName: 'Initial Message Template Params (JSON)',
        name: 'message_template_params',
        type: 'json',
        default: '{}',
        description:
          'WhatsApp template for the initial message (WhatsApp Cloud/360dialog inboxes; Evolution inboxes send only the text). Example: {"name": "order_update", "category": "UTILITY", "language": "en", "processed_params": {"body": {"1": "121212"}}}.',
      },
      {
        displayName: 'Snoozed Until',
        name: 'snoozed_until',
        type: 'dateTime',
        default: '',
        description: 'When a Snoozed conversation reopens. Only meaningful with Status = Snoozed.',
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'Open', value: 'open' },
          { name: 'Pending', value: 'pending' },
          { name: 'Resolved', value: 'resolved' },
          { name: 'Snoozed', value: 'snoozed' },
        ],
        default: 'open',
        description: 'Initial status of the conversation',
      },
      {
        displayName: 'Team ID',
        name: 'team_id',
        type: 'number',
        default: 0,
        description: 'Team ID to assign the conversation to',
      },
    ],
  },
];
