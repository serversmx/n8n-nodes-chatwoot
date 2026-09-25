import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { metricsOperation } from './metrics.operation';
import { downloadOperation } from './download.operation';

// All applied SLA endpoints require the premium 'sla' feature and an administrator. When the
// feature is disabled Chatwoot answers 401 "You are not authorized to do this action".
export const appliedSlaOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['appliedSla'] } },
  options: [
    {
      name: 'Download',
      value: 'download',
      description:
        'Download the breached conversations as CSV (file or parsed rows). Enterprise SLA feature, administrators only.',
      action: 'Download applied SLAs',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'List SLA breaches (missed or active with misses): policy, due dates, conversation, labels, assignee and SLA events. Enterprise SLA feature, administrators only.',
      action: 'Get many applied SLAs',
    },
    {
      name: 'Metrics',
      value: 'metrics',
      description:
        'Get total applied SLAs, number of misses and hit rate. Enterprise SLA feature, administrators only.',
      action: 'Get SLA metrics',
    },
  ],
  default: 'getAll',
};

export const appliedSlaFields: INodeProperties[] = [
  ...getAllOperation,
  ...metricsOperation,
  ...downloadOperation,
];
