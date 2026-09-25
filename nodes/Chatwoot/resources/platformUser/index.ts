import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { getOperation } from './get.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';
import { getSsoUrlOperation } from './getSsoUrl.operation';
import { getTokenOperation } from './getToken.operation';

// A Platform App can only read and change the users it created (otherwise 401 "Non permissible resource")
export const platformUserOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['platformUser'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a user (confirmed, no confirmation email). Add it to an account with Account User > Create.',
      action: 'Create user',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a user created by this Platform App (processed in a background job)',
      action: 'Delete user',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get a user created by this Platform App, including its access token and account memberships',
      action: 'Get user',
    },
    {
      name: 'Get Access Token',
      value: 'getToken',
      description:
        "Get the user's Application API access token, to call the Application API on behalf of this user",
      action: 'Get user access token',
    },
    {
      name: 'Get SSO URL',
      value: 'getSsoUrl',
      description: 'Get a one-time login URL for the Chatwoot dashboard (valid for 5 minutes)',
      action: 'Get SSO URL',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update the name, display name, email, password or custom attributes of a user',
      action: 'Update user',
    },
  ],
  default: 'get',
};

export const platformUserFields: INodeProperties[] = [
  ...createOperation,
  ...getOperation,
  ...updateOperation,
  ...deleteOperation,
  ...getSsoUrlOperation,
  ...getTokenOperation,
];
