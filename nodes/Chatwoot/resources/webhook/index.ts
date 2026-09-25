import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';

export const webhookOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['webhook'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create an account webhook. The output includes its secret: each delivery carries X-Chatwoot-Signature = "sha256=" + hex HMAC-SHA256 of "{X-Chatwoot-Timestamp}.{raw body}" keyed with that secret.',
      action: 'Create a webhook',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a webhook',
      action: 'Delete a webhook',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all webhooks in the account (one item per webhook, including its secret)',
      action: 'Get all webhooks',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update the URL, events, name or inbox of a webhook',
      action: 'Update a webhook',
    },
  ],
  default: 'getAll',
};

export const webhookFields: INodeProperties[] = [
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
];
