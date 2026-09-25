import type { INodeProperties } from 'n8n-workflow';

export const getAttachmentsOperation: INodeProperties[] = [
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getAttachments'],
      },
    },
    description:
      "ID of the contact. Returns the files shared in the contact's conversations that the token owner can access, newest first (one item per file with data_url, file_type, message_id and conversation_id). Requires Chatwoot 4.14+.",
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getAttachments'],
      },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: {
      minValue: 1,
    },
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getAttachments'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return. Chatwoot returns 100 attachments per page.',
  },
];
