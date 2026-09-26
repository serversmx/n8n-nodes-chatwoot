import type { INodeProperties } from 'n8n-workflow';

export const deleteCustomAttributesOperation: INodeProperties[] = [
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['deleteCustomAttributes'],
      },
    },
    description: 'ID of the contact',
  },
  {
    displayName: 'Custom Attribute Keys',
    name: 'customAttributeKeys',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'plan,crm_id',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['deleteCustomAttributes'],
      },
    },
    description:
      "Comma-separated keys to remove from the contact's custom attributes (Update merges custom attributes, so this is the way to delete a key). Other keys are kept.",
  },
];
