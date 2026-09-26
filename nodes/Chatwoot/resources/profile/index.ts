import type { INodeProperties } from 'n8n-workflow';
import { fetchOperation } from './fetch.operation';
import { updateOperation } from './update.operation';
import { availabilityOperation } from './availability.operation';

export const profileOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['profile'],
    },
  },
  options: [
    {
      name: 'Fetch',
      value: 'fetch',
      description:
        'Get the profile of the user that owns the access token (name, email, role and availability per account)',
      action: 'Fetch profile',
    },
    {
      name: 'Set Availability',
      value: 'availability',
      description:
        'Set the availability (online, busy or offline) of the token owner in the account of the credential',
      action: 'Set availability',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update the profile of the user that owns the access token (name, display name, email, signature, availability)',
      action: 'Update profile',
    },
  ],
  default: 'fetch',
};

export const profileFields: INodeProperties[] = [
  ...fetchOperation,
  ...updateOperation,
  ...availabilityOperation,
];
