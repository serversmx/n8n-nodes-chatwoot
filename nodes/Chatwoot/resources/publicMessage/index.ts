import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { getAllOperation } from './getAll.operation';
import { updateOperation } from './update.operation';

export const publicMessageOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['publicMessage'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Send a message as the contact (incoming message) in a conversation of the API inbox, optionally with file attachments',
      action: 'Create public message',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get the messages of a conversation as the contact sees them (no private notes or activity messages), oldest first. Unless the contact is verified with an identifier hash, only conversations created with the same source_id are found.',
      action: 'Get public messages',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Answer an interactive bot message as the contact (selected option, form values or CSAT rating), stored as submitted_values. The message text itself cannot be changed.',
      action: 'Update public message',
    },
  ],
  default: 'create',
};

export const publicMessageFields: INodeProperties[] = [
  ...createOperation,
  ...getAllOperation,
  ...updateOperation,
];
