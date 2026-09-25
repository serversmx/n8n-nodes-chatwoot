import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';

export const auditLogOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['auditLog'],
    },
  },
  options: [
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get audit log entries (who changed agents, inboxes, teams, webhooks, automations, macros, sign-ins, deleted conversations/messages). Enterprise, administrators only; an empty list can mean the audit_logs feature is disabled. Since 4.18 IPs are masked and a location is added.',
      action: 'Get audit logs',
    },
  ],
  default: 'getAll',
};

export const auditLogFields: INodeProperties[] = [...getAllOperation];
