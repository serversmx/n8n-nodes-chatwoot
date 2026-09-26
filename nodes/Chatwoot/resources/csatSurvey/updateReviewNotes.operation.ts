import type { INodeProperties } from 'n8n-workflow';

export const updateReviewNotesOperation: INodeProperties[] = [
  {
    displayName: 'CSAT Response ID',
    name: 'csatResponseId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['csatSurvey'], operation: ['updateReviewNotes'] } },
    description: 'ID of the CSAT survey response (the "id" field returned by Get Many)',
  },
  {
    displayName: 'Review Notes',
    name: 'reviewNotes',
    type: 'string',
    typeOptions: { rows: 4 },
    default: '',
    displayOptions: { show: { resource: ['csatSurvey'], operation: ['updateReviewNotes'] } },
    description: 'Internal review notes for this rating. Leave empty to clear them.',
  },
];
