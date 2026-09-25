import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['create'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Public Contact > Create)',
  },
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['create'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Content',
    name: 'content',
    type: 'string',
    typeOptions: {
      rows: 4,
    },
    default: '',
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['create'],
      },
    },
    description:
      'Text of the message, sent as an incoming message from the contact. Can be empty when attachments are sent.',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Attachment Binary Properties',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        placeholder: 'data, image',
        description:
          'Comma-separated names of the input binary properties to attach. The message is then sent as multipart/form-data with one attachments[] entry per file.',
      },
      {
        displayName: 'Echo ID',
        name: 'echo_id',
        type: 'string',
        default: '',
        description:
          'Your temporary ID for the message, returned in the realtime events to match it (deduplication)',
      },
    ],
  },
];
