import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['company'], operation: ['create'] } },
    description: 'Name of the company',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: { show: { resource: ['company'], operation: ['create'] } },
    options: [
      {
        displayName: 'Additional Attributes (JSON)',
        name: 'additional_attributes',
        type: 'json',
        default: '{}',
        description:
          "Free-form attributes stored on the company as a JSON object (not returned by Chatwoot's company views). Requires Chatwoot 4.14+.",
      },
      {
        displayName: 'Custom Attributes (JSON)',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description:
          'Company custom attributes as a JSON object, e.g. {"plan": "enterprise", "seats": 25}. Keys should match company custom attribute definitions. Requires Chatwoot 4.14+.',
      },
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'string',
        default: '',
        description: 'Company domain (e.g., company.com)',
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        description: 'Company description',
      },
    ],
  },
];
