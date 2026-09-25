import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['publicContact'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Avatar URL',
        name: 'avatar_url',
        type: 'string',
        default: '',
        description:
          'Public URL of an image to use as the contact avatar (downloaded by Chatwoot in the background)',
      },
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description: 'Custom attributes as JSON object',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description: 'Email address of the contact',
      },
      {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        default: '',
        description:
          'Your own unique ID for the contact (e.g. the user ID in your system). An existing contact with this identifier, email or phone number is reused instead of creating a new one.',
      },
      {
        displayName: 'Identifier Hash',
        name: 'identifier_hash',
        type: 'string',
        default: '',
        description:
          'HMAC-SHA256 of the Identifier with the inbox HMAC token, required when the inbox enforces identity validation. Leave empty to have the node compute it from the HMAC Token of the credential.',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the contact (Chatwoot generates a random name when empty)',
      },
      {
        displayName: 'Phone Number',
        name: 'phone_number',
        type: 'string',
        default: '',
        description: 'Phone number of the contact in E.164 format (e.g. +5215512345678)',
      },
      {
        displayName: 'Source ID',
        name: 'source_id',
        type: 'string',
        default: '',
        description:
          'Contact identifier to use in this inbox (e.g. the WhatsApp number). When a contact with this source ID already exists in the inbox, it is returned unchanged, so the call is idempotent. When empty, Chatwoot generates a random UUID and every call creates a new contact inbox.',
      },
    ],
  },
];
