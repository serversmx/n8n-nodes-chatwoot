import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

export const labelOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['label'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description: 'Create a new label (requires an administrator token)',
      action: 'Create a label',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a label (requires an administrator token)',
      action: 'Delete a label',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all labels in the account',
      action: 'Get all labels',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update a label (requires an administrator token)',
      action: 'Update a label',
    },
  ],
  default: 'getAll',
};

export const labelFields: INodeProperties[] = [
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
];
