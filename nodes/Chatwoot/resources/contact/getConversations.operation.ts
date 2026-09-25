import type { INodeProperties } from 'n8n-workflow';

export const getConversationsOperation: INodeProperties[] = [
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getConversations'],
      },
    },
    description:
      "ID of the contact. Returns the contact's recent conversations (one item each), sorted by last activity, newest first. Chatwoot caps this list without pagination: 20 most recently active conversations up to 4.17, 25 most recently created from 4.18.0. For a complete history use Conversation > Filter with the contact_id key (Chatwoot 4.14.2+).",
  },
];
