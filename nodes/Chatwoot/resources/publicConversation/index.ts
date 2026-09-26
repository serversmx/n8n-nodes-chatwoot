import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { csatSurveyOperation } from './csatSurvey.operation';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { resolveOperation } from './resolve.operation';
import { toggleTypingOperation } from './toggleTyping.operation';
import { updateLastSeenOperation } from './updateLastSeen.operation';

// Conversation IDs here are the conversation display IDs. Unless the contact was verified with an
// identifier hash, Chatwoot only exposes the conversations created with the same source_id (contact inbox).
export const publicConversationOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['publicConversation'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Start a new conversation for a contact of the API inbox, as the customer. Returns the conversation with its ID and UUID.',
      action: 'Create public conversation',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get a conversation of the contact with its messages. Unless the contact is verified with an identifier hash, only conversations created with the same source_id are found.',
      action: 'Get public conversation',
    },
    {
      name: 'Get CSAT Survey',
      value: 'getCsatSurvey',
      description:
        'Get the CSAT survey of a conversation by its UUID: survey text and the rating already given, if any',
      action: 'Get public CSAT survey',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'List the conversations of a contact, each with its messages. Unless the contact is verified with an identifier hash, only conversations created with the same source_id are returned.',
      action: 'Get public conversations',
    },
    {
      name: 'Resolve',
      value: 'resolve',
      description:
        'Mark the conversation as resolved on behalf of the contact. Does nothing if it is already resolved (it never reopens a conversation).',
      action: 'Resolve public conversation',
    },
    {
      name: 'Submit CSAT Survey',
      value: 'submitCsatSurvey',
      description:
        'Submit the CSAT rating (1-5) and optional feedback of a conversation by its UUID. Fails after 14 days.',
      action: 'Submit public CSAT survey',
    },
    {
      name: 'Toggle Typing',
      value: 'toggleTyping',
      description: 'Show or hide the "contact is typing" indicator for the agents',
      action: 'Toggle typing indicator',
    },
    {
      name: 'Update Last Seen',
      value: 'updateLastSeen',
      description:
        "Mark the conversation as seen by the contact: updates the contact's last seen time and marks the agent messages as read (read receipts)",
      action: 'Update last seen',
    },
  ],
  default: 'getAll',
};

export const publicConversationFields: INodeProperties[] = [
  ...createOperation,
  ...getOperation,
  ...getAllOperation,
  ...resolveOperation,
  ...toggleTypingOperation,
  ...updateLastSeenOperation,
  ...csatSurveyOperation,
];
