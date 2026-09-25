import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Email',
    name: 'email',
    type: 'string',
    placeholder: 'name@email.com',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['platformUser'],
        operation: ['create'],
      },
    },
    description:
      'Email address of the user. If a user with this email already exists, Chatwoot returns that user unchanged and gives this Platform App access to it.',
  },
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['platformUser'],
        operation: ['create'],
      },
    },
    description: 'Name of the user',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['platformUser'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description: 'Custom attributes as JSON object',
      },
      {
        displayName: 'Display Name',
        name: 'display_name',
        type: 'string',
        default: '',
        description: 'Name shown to customers instead of the full name',
      },
      {
        displayName: 'Password',
        name: 'password',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        description:
          'Password for the user. Needed to create a new user (Chatwoot rejects new users without one): at least 6 characters with an uppercase letter, a lowercase letter, a number and a special character.',
      },
    ],
  },
];
