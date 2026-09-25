import type { INodeProperties } from 'n8n-workflow';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';
import { searchOperation } from './search.operation';
import { contactsOperation } from './contacts.operation';

// Companies are an Enterprise feature. Since Chatwoot 4.14 the account also needs the 'companies'
// feature (Super Admin → Accounts → Features); otherwise every endpoint answers
// 403 "Companies are not enabled for this account".
export const companyOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['company'] } },
  options: [
    {
      name: 'Add Contact',
      value: 'addContact',
      description:
        'Link a contact to the company (a contact belongs to one company; it is moved if already linked elsewhere). Requires Chatwoot 4.14+.',
      action: 'Add a contact to a company',
    },
    {
      name: 'Create',
      value: 'create',
      description: 'Create a new company (Enterprise, companies feature)',
      action: 'Create a company',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Delete a company (Enterprise). Since Chatwoot 4.14 the deletion runs in the background.',
      action: 'Delete a company',
    },
    {
      name: 'Delete Avatar',
      value: 'deleteAvatar',
      description: "Remove the company's avatar image. Requires Chatwoot 4.14+.",
      action: 'Delete a company avatar',
    },
    {
      name: 'Delete Custom Attributes',
      value: 'deleteCustomAttributes',
      description: 'Remove custom attributes from a company by key. Requires Chatwoot 4.14+.',
      action: 'Delete company custom attributes',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get a company by ID (Enterprise, companies feature)',
      action: 'Get a company',
    },
    {
      name: 'Get Contacts',
      value: 'getContacts',
      description: 'List the contacts linked to a company. Requires Chatwoot 4.14+.',
      action: 'Get company contacts',
    },
    {
      name: 'Get Conversations',
      value: 'getConversations',
      description:
        "Get the 20 most recent conversations of the company's contacts (only those the user can access). Requires Chatwoot 4.14+.",
      action: 'Get company conversations',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all companies (Enterprise, companies feature)',
      action: 'Get many companies',
    },
    {
      name: 'Get Notes',
      value: 'getNotes',
      description:
        "Get the 20 most recent notes written on the company's contacts. Requires Chatwoot 4.14+.",
      action: 'Get company notes',
    },
    {
      name: 'Remove Contact',
      value: 'removeContact',
      description: 'Unlink a contact from the company. Requires Chatwoot 4.14+.',
      action: 'Remove a contact from a company',
    },
    {
      name: 'Search',
      value: 'search',
      description: 'Search companies by name or domain (Enterprise, companies feature)',
      action: 'Search companies',
    },
    {
      name: 'Search Contacts',
      value: 'searchContacts',
      description:
        'Search contacts that are NOT linked to the company yet (candidates for Add Contact). Requires Chatwoot 4.14+.',
      action: 'Search contacts to add to a company',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update a company (Enterprise, companies feature)',
      action: 'Update a company',
    },
  ],
  default: 'getAll',
};

export const companyFields: INodeProperties[] = [
  ...getOperation,
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
  ...searchOperation,
  ...contactsOperation,
];
