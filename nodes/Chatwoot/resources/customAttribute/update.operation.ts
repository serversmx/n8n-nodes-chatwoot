import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Custom Attribute ID',
    name: 'customAttributeId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['customAttribute'],
        operation: ['update'],
      },
    },
    description: 'ID of the custom attribute to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['customAttribute'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Display Name',
        name: 'attribute_display_name',
        type: 'string',
        default: '',
        description: 'Display name of the custom attribute',
      },
      {
        displayName: 'Description',
        name: 'attribute_description',
        type: 'string',
        default: '',
        description: 'Description of the custom attribute',
      },
      {
        displayName: 'List Values',
        name: 'attribute_values',
        type: 'string',
        default: '',
        placeholder: 'value1,value2,value3',
        description:
          'Comma-separated list of values, replacing the current ones (only for "List" type)',
      },
      {
        displayName: 'Regex Cue',
        name: 'regex_cue',
        type: 'string',
        default: '',
        description: 'Hint shown to agents when a value does not match the Regex Pattern',
      },
      {
        displayName: 'Regex Pattern',
        name: 'regex_pattern',
        type: 'string',
        default: '',
        placeholder: '^[A-Z]{3}-\\d{4}$',
        description:
          'Regular expression that values must match when typed in the Chatwoot dashboard or pre-chat form (for "Text" type; the API does not enforce it)',
      },
    ],
  },
];
