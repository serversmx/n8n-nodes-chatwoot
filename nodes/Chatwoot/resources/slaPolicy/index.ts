import type { INodeProperties } from 'n8n-workflow';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

// Since Chatwoot 4.14 every SLA policy endpoint requires the premium 'sla' feature: when it is
// disabled Chatwoot answers 401 "You are not authorized to do this action" (not an invalid token).
export const slaPolicyOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['slaPolicy'] } },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create an SLA policy (thresholds in seconds). Enterprise SLA feature, administrators only.',
      action: 'Create SLA policy',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Delete an SLA policy (deleted in the background). Enterprise SLA feature, administrators only.',
      action: 'Delete SLA policy',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get an SLA policy by ID. Enterprise SLA feature.',
      action: 'Get SLA policy',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all SLA policies (one item per policy). Enterprise SLA feature.',
      action: 'Get many SLA policies',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update an SLA policy. Enterprise SLA feature, administrators only.',
      action: 'Update SLA policy',
    },
  ],
  default: 'getAll',
};

export const slaPolicyFields: INodeProperties[] = [
  ...getOperation,
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
];
