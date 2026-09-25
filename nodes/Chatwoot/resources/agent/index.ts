import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

export const agentOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['agent'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Invite a new agent (Chatwoot emails the invitation). Chatwoot 4.18 allows 100 agent creations per account per day by default (RATE_LIMIT_AGENT_CREATE); a full plan answers 402.',
      action: 'Create an agent',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Remove an agent from the account. Chatwoot 4.18 allows 50 agent deletions per account per day by default (RATE_LIMIT_AGENT_DELETE).',
      action: 'Delete an agent',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all agents in the account with their role and availability_status',
      action: 'Get all agents',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update the name, role, availability or auto-offline setting of an agent',
      action: 'Update an agent',
    },
  ],
  default: 'getAll',
};

export const agentFields: INodeProperties[] = [
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
];
