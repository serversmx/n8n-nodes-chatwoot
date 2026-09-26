import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { getAllOperation } from './getAll.operation';
import { deleteOperation } from './delete.operation';
import { updateOperation } from './update.operation';
import { retryOperation } from './retry.operation';

export const messageOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['message'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description: 'Send a message to a conversation, optionally with file attachments from binary data',
      action: 'Send a message',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a message from a conversation (its content is replaced and attachments are removed)',
      action: 'Delete a message',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get messages from a conversation, oldest first',
      action: 'Get messages from conversation',
    },
    {
      name: 'Retry',
      value: 'retry',
      description:
        'Send a failed outgoing message again through its channel (WhatsApp Cloud, SMS, email, Telegram...). API inboxes (e.g. Evolution) are not re-delivered: Chatwoot only resets the status to Sent.',
      action: 'Retry a failed message',
    },
    {
      name: 'Update Delivery Status',
      value: 'update',
      description: 'Set the delivery status (sent, delivered, read, failed) of a message in an API inbox. Message content cannot be edited.',
      action: 'Update message delivery status',
    },
  ],
  default: 'create',
};

export const messageFields: INodeProperties[] = [
  ...createOperation,
  ...getAllOperation,
  ...deleteOperation,
  ...updateOperation,
  ...retryOperation,
];
