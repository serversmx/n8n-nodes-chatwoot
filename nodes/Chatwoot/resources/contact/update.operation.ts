import type { INodeProperties } from 'n8n-workflow';
import { IDENTIFIER_DESCRIPTION } from './create.operation';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['update'],
      },
    },
    description: 'The ID of the contact to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Additional Attributes',
        name: 'additional_attributes',
        type: 'json',
        default: '{}',
        description:
          'Standard profile attributes as a JSON object, merged into the existing ones (keys not sent are kept), e.g. {"company_name": "Acme", "city": "Monterrey", "country_code": "MX", "description": "VIP customer"}',
      },
      {
        displayName: 'Avatar URL',
        name: 'avatar_url',
        type: 'string',
        default: '',
        description:
          'Public URL of an image that Chatwoot downloads in the background and uses as the avatar',
      },
      {
        displayName: 'Blocked',
        name: 'blocked',
        type: 'boolean',
        default: false,
        description:
          'Whether the contact is blocked (Chatwoot opens new conversations of blocked contacts as resolved and skips agent notifications)',
      },
      {
        displayName: 'Company ID',
        name: 'company_id',
        type: 'number',
        default: 0,
        description:
          'ID of the company to link the contact to; set 0 to unlink the company. Requires Chatwoot 4.15+ Enterprise with the Companies feature enabled; ignored otherwise.',
      },
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description:
          'Custom attributes as a JSON object, merged into the existing ones (keys not sent are kept)',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description: 'Email address of the contact (unique per account). An empty value clears it.',
      },
      {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        default: '',
        description: `${IDENTIFIER_DESCRIPTION} An empty value clears the identifier.`,
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Full name of the contact',
      },
      {
        displayName: 'Phone Number',
        name: 'phone_number',
        type: 'string',
        placeholder: '+5215512345678',
        default: '',
        description:
          'Phone number in E.164 format: "+" followed by country code and number, no spaces (unique per account). An empty value clears it.',
      },
    ],
  },
];
