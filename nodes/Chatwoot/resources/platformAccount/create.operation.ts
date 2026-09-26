import type { INodeProperties } from 'n8n-workflow';
import {
  accountCustomAttributesField,
  accountFeaturesField,
  accountLimitsField,
  accountStatusField,
} from './fields';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Account Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['platformAccount'],
        operation: ['create'],
      },
    },
    description: 'Name of the account',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['platformAccount'],
        operation: ['create'],
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
        default: 'en',
        description: 'Locale for the account (e.g. en, es, pt_BR)',
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
