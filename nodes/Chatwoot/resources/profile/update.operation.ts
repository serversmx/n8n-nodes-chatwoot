import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['profile'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Full name of the user that owns the access token',
      },
      {
        displayName: 'Display Name',
        name: 'display_name',
        type: 'string',
        default: '',
        description: 'Name shown to contacts instead of the full name',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description: 'Email address (login) of the user',
      },
      {
        displayName: 'Message Signature',
        name: 'message_signature',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        default: '',
        description: 'Signature appended to the messages of the user',
      },
      {
        displayName: 'Phone Number',
        name: 'phone_number',
        type: 'string',
        default: '',
        placeholder: '+15551234567',
        description: "Phone number stored in the user's custom attributes",
      },
      {
        displayName: 'Availability',
        name: 'availability',
        type: 'options',
        options: [
          { name: 'Online', value: 'online' },
          { name: 'Offline', value: 'offline' },
          { name: 'Busy', value: 'busy' },
        ],
        default: 'online',
        description:
          'Availability in the account of the credential (applied with POST /profile/availability)',
      },
      {
        displayName: 'Auto Offline',
        name: 'auto_offline',
        type: 'boolean',
        default: true,
        description:
          'Whether the user is marked offline automatically when inactive, in the account of the credential (applied with POST /profile/auto_offline)',
      },
    ],
  },
];
