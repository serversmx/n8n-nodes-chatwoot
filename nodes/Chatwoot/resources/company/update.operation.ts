import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Company ID',
    name: 'companyId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['company'], operation: ['update'] } },
    description: 'The ID of the company to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: { show: { resource: ['company'], operation: ['update'] } },
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
          'Custom attributes to set, merged into the existing ones (other keys are kept), e.g. {"plan": "enterprise", "seats": 25}. Keys should match company custom attribute definitions. Requires Chatwoot 4.14+.',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Company name',
      },
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'string',
        default: '',
        description: 'Company domain',
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
