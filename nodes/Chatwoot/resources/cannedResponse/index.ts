import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

export const cannedResponseOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['cannedResponse'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a canned response (a saved reply agents insert with /short_code). The short code must be unique in the account.',
      action: 'Create a canned response',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a canned response',
      action: 'Delete a canned response',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get the canned responses of the account, optionally filtered by a search text',
      action: 'Get all canned responses',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Change the short code and/or content of a canned response',
      action: 'Update a canned response',
    },
  ],
  default: 'getAll',
};

export const cannedResponseFields: INodeProperties[] = [
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
];
