import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['platformUser'],
        operation: ['update'],
      },
    },
    description: 'ID of the user to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['platformUser'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description:
          'Custom attributes as JSON object. Merged into the existing custom attributes (keys not sent are kept).',
      },
      {
        displayName: 'Display Name',
        name: 'display_name',
        type: 'string',
        default: '',
        description: 'Name shown to customers instead of the full name',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        default: '',
        description:
          'Email address of the user. Changed immediately, without a confirmation email.',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the user',
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
          'New password for the user: at least 6 characters with an uppercase letter, a lowercase letter, a number and a special character',
      },
    ],
  },
];
