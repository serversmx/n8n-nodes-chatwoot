import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { deleteOperation } from './delete.operation';

// Only works on accounts created by the same Platform App (otherwise 401 "Non permissible resource")
export const accountUserOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['accountUser'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Add a user to an account with a role. If the user is already a member, only the role is changed.',
      action: 'Create account user',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Remove a user from an account (the user itself is kept). Chatwoot also answers success when the user was not a member.',
      action: 'Delete account user',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'List the memberships of an account: user_id, role, availability and timestamps',
      action: 'Get account users',
    },
  ],
  default: 'getAll',
};

export const accountUserFields: INodeProperties[] = [
  ...getAllOperation,
  ...createOperation,
  ...deleteOperation,
];
