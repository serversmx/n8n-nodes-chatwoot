import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { getOperation } from './get.operation';
import { updateOperation } from './update.operation';

export const publicContactOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['publicContact'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create (or reuse) a contact in the API inbox of the credential and return its source_id, the Contact Identifier used by the other Public API operations',
      action: 'Create public contact',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get a contact of the inbox by its source_id: returns id, name, email, phone number and source_id',
      action: 'Get public contact',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update the name, email, phone number, avatar or custom attributes of a contact. Since Chatwoot 4.16 the response only contains source_id, pubsub_token, id, name, email and phone_number (use the Contact resource of the Application API for the full contact).',
      action: 'Update public contact',
    },
  ],
  default: 'create',
};

export const publicContactFields: INodeProperties[] = [
  ...createOperation,
  ...getOperation,
  ...updateOperation,
];
