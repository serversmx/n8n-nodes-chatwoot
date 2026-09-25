import type { INodeProperties } from 'n8n-workflow';

// GET /public/api/v1/inboxes/{inbox identifier}: read-only, no side effects, works with identity validation
export const publicInboxOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['publicInbox'],
    },
  },
  options: [
    {
      name: 'Get',
      value: 'get',
      description:
        'Get the public settings of the API inbox of the credential: name, timezone, working hours, whether CSAT surveys and greetings are enabled, and whether identity validation (HMAC) is enforced',
      action: 'Get public inbox',
    },
  ],
  default: 'get',
};

// The inbox comes from the credential, so this resource has no fields
export const publicInboxFields: INodeProperties[] = [];
