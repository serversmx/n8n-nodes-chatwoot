import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { createHookOperation } from './createHook.operation';
import { updateHookOperation } from './updateHook.operation';
import { deleteHookOperation } from './deleteHook.operation';

export const integrationOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['integration'],
    },
  },
  options: [
    {
      name: 'Create Hook',
      value: 'createHook',
      description:
        'Connect an integration app (e.g. Dialogflow, OpenAI, Cloudflare RealtimeKit video calls) with its settings',
      action: 'Create integration hook',
    },
    {
      name: 'Delete Hook',
      value: 'deleteHook',
      description: 'Delete an integration hook',
      action: 'Delete integration hook',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get the integration apps available to the account, each with its hooks (hook IDs are needed to update or delete them)',
      action: 'Get all integrations',
    },
    {
      name: 'Update Hook',
      value: 'updateHook',
      description: 'Update the settings or enable/disable an integration hook',
      action: 'Update integration hook',
    },
  ],
  default: 'getAll',
};

export const integrationFields: INodeProperties[] = [
  ...getAllOperation,
  ...createHookOperation,
  ...updateHookOperation,
  ...deleteHookOperation,
];
