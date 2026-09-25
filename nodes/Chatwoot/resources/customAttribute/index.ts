import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { getOperation } from './get.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

export const customAttributeOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['customAttribute'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a new custom attribute definition (Chatwoot 4.14+ requires an administrator token; agent tokens get 401)',
      action: 'Create a custom attribute',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Delete a custom attribute definition (Chatwoot 4.14+ requires an administrator token; agent tokens get 401)',
      action: 'Delete a custom attribute',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get a custom attribute by ID',
      action: 'Get a custom attribute',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get all custom attribute definitions of a model (contact, conversation or company)',
      action: 'Get all custom attributes',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update a custom attribute definition (Chatwoot 4.14+ requires an administrator token; agent tokens get 401)',
      action: 'Update a custom attribute',
    },
  ],
  default: 'getAll',
};

export const customAttributeFields: INodeProperties[] = [
  ...getAllOperation,
  ...getOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
];
