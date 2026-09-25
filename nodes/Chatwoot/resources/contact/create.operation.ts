import type { INodeProperties } from 'n8n-workflow';

/** EVOCW-5: on Evolution API inboxes the identifier is the WhatsApp JID used to deliver messages. */
export const IDENTIFIER_DESCRIPTION =
  'Unique external identifier of the contact in this account. Warning: on WhatsApp inboxes managed by Evolution API, the identifier holds the WhatsApp JID (e.g. 5215512345678@s.whatsapp.net or 123456789@lid) that Evolution uses to deliver messages. Do not overwrite it there; store CRM or user IDs in Custom Attributes instead.';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['create'],
      },
    },
    description: 'Full name of the contact',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Additional Attributes',
        name: 'additional_attributes',
        type: 'json',
        default: '{}',
        description:
          'Standard profile attributes as a JSON object, e.g. {"company_name": "Acme", "city": "Monterrey", "country_code": "MX", "description": "VIP customer", "social_profiles": {"linkedin": "acme"}}',
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
          'ID of the company to link the contact to. Requires Chatwoot 4.15+ Enterprise with the Companies feature enabled; ignored otherwise.',
      },
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description:
          'Custom attributes as a JSON object keyed by attribute key (e.g. {"plan": "premium", "crm_id": "123"})',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description: 'Email address of the contact (unique per account)',
      },
      {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        default: '',
        description: IDENTIFIER_DESCRIPTION,
      },
      {
        displayName: 'Inbox ID',
        name: 'inbox_id',
        type: 'number',
        default: 0,
        description:
          'Also link the new contact to this inbox (creates a contact inbox). Find the ID in Chatwoot under Settings → Inboxes.',
      },
      {
        displayName: 'Phone Number',
        name: 'phone_number',
        type: 'string',
        placeholder: '+5215512345678',
        default: '',
        description:
          'Phone number in E.164 format: "+" followed by country code and number, no spaces (unique per account)',
      },
      {
        displayName: 'Source ID',
        name: 'source_id',
        type: 'string',
        default: '',
        description:
          'Source ID of the contact in the inbox given by Inbox ID (e.g. the WhatsApp number without "+", or your own ID for API inboxes). Requires Inbox ID. When empty, Chatwoot generates one for API and website inboxes and uses the email (email inboxes) or phone number (SMS and WhatsApp inboxes) sent with the contact; other channels need it, otherwise the contact is not created.',
      },
    ],
  },
];
