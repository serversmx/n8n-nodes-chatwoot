import type { INodeProperties } from 'n8n-workflow';

export const getOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicContact'],
        operation: ['get'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Create)',
  },
  {
    displayName: 'Identity Validation',
    name: 'identityValidation',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['publicContact'],
        operation: ['get'],
      },
    },
    description:
      'Needed when the inbox enforces identity validation (HMAC). A valid hash also marks the contact as verified, which gives it access to all its conversations.',
    options: [
      {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        default: '',
        description: 'Identifier of the contact, used to verify the Identifier Hash',
      },
      {
        displayName: 'Identifier Hash',
        name: 'identifier_hash',
        type: 'string',
        default: '',
        description:
          'HMAC-SHA256 of the Identifier with the inbox HMAC token. Leave empty to have the node compute it from the HMAC Token of the credential.',
      },
    ],
  },
];
