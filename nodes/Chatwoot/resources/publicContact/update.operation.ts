import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicContact'],
        operation: ['update'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Create)',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['publicContact'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Avatar URL',
        name: 'avatar_url',
        type: 'string',
        default: '',
        description:
          'Public URL of an image to use as the avatar. Only applied when the contact has no avatar yet.',
      },
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description:
          'Custom attributes as JSON object, merged into the existing ones (keys not sent are kept)',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description:
          'Email address of the contact. If another contact of the account already has it, Chatwoot merges both contacts.',
      },
      {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        default: '',
        description:
          'Identifier of the contact, only used for identity validation (HMAC). Chatwoot does not change the identifier through this endpoint.',
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
        description: 'Name of the contact',
      },
      {
        displayName: 'Phone Number',
        name: 'phone_number',
        type: 'string',
        default: '',
        description:
          'Phone number in E.164 format. If another contact of the account already has it, Chatwoot merges both contacts.',
      },
    ],
  },
];
