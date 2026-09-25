import type { INodeProperties } from 'n8n-workflow';

export const contactsOperation: INodeProperties[] = [
  {
    displayName: 'Company ID',
    name: 'companyId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['company'],
        operation: [
          'addContact',
          'deleteAvatar',
          'deleteCustomAttributes',
          'getContacts',
          'getConversations',
          'getNotes',
          'removeContact',
          'searchContacts',
        ],
      },
    },
    description: 'The ID of the company',
  },
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['company'], operation: ['addContact', 'removeContact'] } },
    description: 'The ID of the contact to link to or unlink from the company',
  },
  {
    displayName: 'Query',
    name: 'query',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['company'], operation: ['searchContacts'] } },
    description:
      'Text to search in contact name, email, phone number or identifier. Only contacts that are not linked to this company are returned.',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: { resource: ['company'], operation: ['getContacts', 'searchContacts'] },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: {
        resource: ['company'],
        operation: ['getContacts', 'searchContacts'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Custom Attribute Keys',
    name: 'customAttributeKeys',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['company'], operation: ['deleteCustomAttributes'] } },
    description: 'Comma-separated keys of the custom attributes to remove, e.g. plan, seats',
  },
];
