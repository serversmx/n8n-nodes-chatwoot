import type { INodeProperties } from 'n8n-workflow';

/**
 * Filters shared by the applied SLA list, metrics and download endpoints
 * (applied_slas_controller#apply_filters). The date range only applies when both Since and Until
 * are set (Chatwoot's DateRangeHelper).
 */
export const appliedSlaFilterOptions: INodeProperties[] = [
  {
    displayName: 'Assigned Agent ID',
    name: 'assigned_agent_id',
    type: 'number',
    default: 0,
    description: 'Only conversations assigned to this agent',
  },
  {
    displayName: 'Inbox ID',
    name: 'inbox_id',
    type: 'number',
    default: 0,
    description: 'Only conversations in this inbox',
  },
  {
    displayName: 'Label',
    name: 'label_list',
    type: 'string',
    default: '',
    description:
      "Only conversations whose labels contain this text (one label name, matched against the conversation's label list)",
  },
  {
    displayName: 'SLA Policy ID',
    name: 'sla_policy_id',
    type: 'number',
    default: 0,
    description: 'Only SLAs of this policy',
  },
  {
    displayName: 'Since',
    name: 'since',
    type: 'dateTime',
    default: '',
    description: 'Start of the date range (applies only when Until is also set)',
  },
  {
    displayName: 'Team ID',
    name: 'team_id',
    type: 'number',
    default: 0,
    description: 'Only conversations assigned to this team',
  },
  {
    displayName: 'Until',
    name: 'until',
    type: 'dateTime',
    default: '',
    description: 'End of the date range (applies only when Since is also set)',
  },
];
