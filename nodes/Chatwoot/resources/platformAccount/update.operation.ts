import type { INodeProperties } from 'n8n-workflow';
import {
  accountCustomAttributesField,
  accountFeaturesField,
  accountLimitsField,
  accountStatusField,
} from './fields';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Account ID',
    name: 'accountId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['platformAccount'],
        operation: ['update'],
      },
    },
    description: 'ID of the account to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['platformAccount'],
        operation: ['update'],
      },
    },
    options: [
      accountCustomAttributesField,
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'string',
        default: '',
        description: 'Domain for the account',
      },
      accountFeaturesField,
      accountLimitsField,
      {
        displayName: 'Locale',
        name: 'locale',
        type: 'string',
        default: '',
        description: 'Locale for the account (e.g. en, es, pt_BR)',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the account',
      },
      accountStatusField,
      {
        displayName: 'Support Email',
        name: 'support_email',
        type: 'string',
        default: '',
        description: 'Support email for the account',
      },
    ],
  },
];
