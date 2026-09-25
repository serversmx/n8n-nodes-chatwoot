import type { INodeProperties } from 'n8n-workflow';
import { downloadOperation } from './download.operation';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { metricsOperation } from './metrics.operation';
import { updateReviewNotesOperation } from './updateReviewNotes.operation';

export const csatSurveyOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['csatSurvey'],
    },
  },
  options: [
    {
      name: 'Download',
      value: 'download',
      description:
        'Download CSAT responses as CSV (file or parsed rows) with agent, rating, feedback, contact and conversation link. Since and Until are required.',
      action: 'Download CSAT responses',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'List CSAT survey responses (rating, feedback, contact, assigned agent, conversation_id) filtered by date range, agents, inbox, team or rating',
      action: 'Get many CSAT responses',
    },
    {
      name: 'Get by Conversation',
      value: 'get',
      description:
        'Get the CSAT survey response of one conversation (no output item when the contact did not answer)',
      action: 'Get CSAT survey',
    },
    {
      name: 'Metrics',
      value: 'metrics',
      description:
        'Get CSAT totals: number of responses, count per rating and number of surveys sent',
      action: 'Get CSAT metrics',
    },
    {
      name: 'Update Review Notes',
      value: 'updateReviewNotes',
      description:
        'Set the internal review notes of a CSAT response. Enterprise; administrators or report managers.',
      action: 'Update CSAT review notes',
    },
  ],
  default: 'get',
};

export const csatSurveyFields: INodeProperties[] = [
  ...downloadOperation,
  ...getOperation,
  ...getAllOperation,
  ...metricsOperation,
  ...updateReviewNotesOperation,
];
