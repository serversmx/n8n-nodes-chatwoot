import type { INodeProperties } from 'n8n-workflow';

export const getOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['csatSurvey'],
        operation: ['get'],
      },
    },
    description: 'ID of the conversation (the number shown in the Chatwoot URL)',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['csatSurvey'],
        operation: ['get'],
      },
    },
    description:
      'Chatwoot cannot filter CSAT responses by conversation. Without a complete date range, the node first fetches the conversation and scans responses in its inbox from its creation date to now. Set both dates to override that range.',
    options: [
      {
        displayName: 'Since',
        name: 'since',
        type: 'dateTime',
        default: '',
        description: 'Only scan responses created after this date (applies only with Until)',
      },
      {
        displayName: 'Until',
        name: 'until',
        type: 'dateTime',
        default: '',
        description: 'Only scan responses created before this date (applies only with Since)',
      },
    ],
  },
];
