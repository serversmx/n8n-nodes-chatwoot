import type { INodeProperties } from 'n8n-workflow';

// GET/PUT /public/api/v1/csat_survey/{conversation uuid}: keyed by the conversation UUID only
export const csatSurveyOperation: INodeProperties[] = [
  {
    displayName: 'Conversation UUID',
    name: 'conversationUuid',
    type: 'string',
    required: true,
    default: '',
    placeholder: '98c5d7f3-8873-4262-b101-d56425ff7ee1',
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['getCsatSurvey', 'submitCsatSurvey'],
      },
    },
    description:
      'The uuid of the conversation (field "uuid" of a Public API conversation, also the last part of the CSAT survey link), not its numeric ID',
  },
  {
    displayName: 'Rating',
    name: 'rating',
    type: 'number',
    required: true,
    typeOptions: {
      minValue: 1,
      maxValue: 5,
    },
    default: 5,
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['submitCsatSurvey'],
      },
    },
    description: 'Satisfaction rating from 1 (very unsatisfied) to 5 (very satisfied)',
  },
  {
    displayName: 'Feedback Message',
    name: 'feedbackMessage',
    type: 'string',
    typeOptions: {
      rows: 3,
    },
    default: '',
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['submitCsatSurvey'],
      },
    },
    description: 'Optional comment of the contact',
  },
];
