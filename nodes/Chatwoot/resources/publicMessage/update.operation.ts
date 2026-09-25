import type { INodeProperties } from 'n8n-workflow';

const show = (responseType: string[]) => ({
  show: {
    resource: ['publicMessage'],
    operation: ['update'],
    responseType,
  },
});

// Chatwoot only accepts `submitted_values` here (the contact's answer to a bot message): the message
// text itself can never be changed through the Public API.
export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['update'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Public Contact > Create)',
  },
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['update'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Message ID',
    name: 'messageId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['update'],
      },
    },
    description:
      'ID of the message in this conversation. Chatwoot accepts any message ID, so choose an input_select, form or input_csat message matching Response Type.',
  },
  {
    displayName: 'Response Type',
    name: 'responseType',
    type: 'options',
    options: [
      {
        name: 'CSAT Rating',
        value: 'csat',
        description: 'Answer an input_csat message with a rating and optional feedback',
      },
      {
        name: 'Form Values',
        value: 'form',
        description: 'Answer a form message with one name/value pair per form field',
      },
      {
        name: 'Legacy Content (Ignored)',
        value: '',
        description: 'Preserve saved workflows: send Content, which Chatwoot ignores without editing the message',
      },
      {
        name: 'Raw JSON',
        value: 'json',
        description: 'Send your own submitted_values object or array',
      },
      {
        name: 'Selected Option',
        value: 'option',
        description: 'Answer an input_select message with the option the contact chose',
      },
    ],
    default: '',
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['update'],
      },
    },
    description:
      'Choose an explicit response type to submit an interactive answer. The legacy default sends Content unchanged; Chatwoot ignores it and cannot edit message text.',
  },
  {
    displayName: 'Content (Legacy)',
    name: 'content',
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(['']),
    description: 'Preserved for saved workflows. Chatwoot ignores Content on this endpoint; explicitly select a Response Type to submit an interactive answer.',
  },
  {
    displayName: 'Selected Option Title',
    name: 'content',
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(['option']),
    description:
      'Title of the option the contact chose (one of the items of the input_select message). Sent as submitted_values: [{ title, value }].',
  },
  {
    displayName: 'Selected Option Value',
    name: 'optionValue',
    type: 'string',
    default: '',
    displayOptions: show(['option']),
    description: 'Value of the chosen option. Defaults to the title when empty.',
  },
  {
    displayName: 'Rating',
    name: 'csatRating',
    type: 'number',
    required: true,
    typeOptions: {
      minValue: 1,
      maxValue: 5,
    },
    default: 5,
    displayOptions: show(['csat']),
    description:
      'Satisfaction rating from 1 to 5. Chatwoot rejects changes to a CSAT survey older than 14 days (422).',
  },
  {
    displayName: 'Feedback Message',
    name: 'csatFeedbackMessage',
    type: 'string',
    typeOptions: {
      rows: 3,
    },
    default: '',
    displayOptions: show(['csat']),
    description: 'Optional comment of the contact',
  },
  {
    displayName: 'Form Values',
    name: 'formValues',
    type: 'fixedCollection',
    placeholder: 'Add Form Value',
    typeOptions: {
      multipleValues: true,
    },
    default: {},
    displayOptions: show(['form']),
    description: 'Values of the form fields, sent as submitted_values: [{ name, value }]',
    options: [
      {
        displayName: 'Value',
        name: 'values',
        values: [
          {
            displayName: 'Field Name',
            name: 'name',
            type: 'string',
            default: '',
            description: 'Name of the form field, as defined in the form message items',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'Value entered by the contact',
          },
        ],
      },
    ],
  },
  {
    displayName: 'Submitted Values (JSON)',
    name: 'submittedValues',
    type: 'json',
    required: true,
    default: '[]',
    displayOptions: show(['json']),
    description:
      'JSON sent as submitted_values. Chatwoot keeps only the keys name, title, value and csat_survey_response (with rating and feedback_message), e.g. [{"title": "Yes", "value": "yes"}].',
  },
];
