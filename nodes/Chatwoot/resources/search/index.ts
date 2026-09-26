import type { INodeProperties } from 'n8n-workflow';
import { searchAllOperation } from './searchAll.operation';
import { searchConversationsOperation } from './searchConversations.operation';
import { searchContactsOperation } from './searchContacts.operation';
import { searchMessagesOperation } from './searchMessages.operation';
import { searchArticlesOperation } from './searchArticles.operation';

export const searchOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['search'] } },
  options: [
    {
      name: 'Search All',
      value: 'searchAll',
      description: 'Search conversations, contacts, messages and articles at once (first page of each, grouped in one item)',
      action: 'Search all',
    },
    { name: 'Search Articles', value: 'searchArticles', description: 'Search Help Center articles', action: 'Search articles' },
    { name: 'Search Contacts', value: 'searchContacts', description: 'Search contacts', action: 'Search contacts' },
    { name: 'Search Conversations', value: 'searchConversations', description: 'Search conversations by ID or contact details', action: 'Search conversations' },
    { name: 'Search Messages', value: 'searchMessages', description: 'Search message content', action: 'Search messages' },
  ],
  default: 'searchAll',
};

export const searchFields: INodeProperties[] = [
  ...searchAllOperation,
  ...searchConversationsOperation,
  ...searchContactsOperation,
  ...searchMessagesOperation,
  ...searchArticlesOperation,
];
