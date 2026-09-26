import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

// A Platform App can only read and change the accounts it created (otherwise 401 "Non permissible resource")
export const platformAccountOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['platformAccount'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a new account (tenant), optionally with status, features, limits and custom attributes',
      action: 'Create account',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Delete an account created by this Platform App. Chatwoot deletes it and all its data in a background job.',
      action: 'Delete account',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get an account created by this Platform App, with its enabled features, limits and status',
      action: 'Get account',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'List the accounts created by this Platform App',
      action: 'Get accounts',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update an account: name, locale, domain, support email, status (active or suspended), features, limits or custom attributes',
      action: 'Update account',
    },
  ],
  default: 'get',
};

export const platformAccountFields: INodeProperties[] = [
  ...createOperation,
  ...getOperation,
  ...getAllOperation,
  ...updateOperation,
  ...deleteOperation,
];
