import type { INodeProperties } from 'n8n-workflow';

export const MACRO_ACTIONS_DESCRIPTION =
  'JSON array of actions, run in order. Each item: {"action_name", "action_params": [...]}. ' +
  'Valid action_name values: send_message, add_private_note, add_label, remove_label, assign_agent, assign_team, ' +
  'remove_assigned_agent, remove_assigned_team, change_status, change_priority, resolve_conversation, snooze_conversation, ' +
  'mute_conversation, send_email_transcript, send_webhook_event, send_attachment. ' +
  'Example: [{"action_name":"assign_team","action_params":[1]},{"action_name":"add_label","action_params":["billing"]}]';

export const MACRO_VISIBILITY_DESCRIPTION =
  'Personal macros are visible only to their author; global macros to every agent. Only administrator tokens can create or edit global macros (Chatwoot stores macros created by agents as personal).';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['create'],
      },
    },
    description: 'Name of the macro',
  },
  {
    displayName: 'Actions (JSON)',
    name: 'actions',
    type: 'json',
    required: true,
    default: '[]',
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['create'],
      },
    },
    description: MACRO_ACTIONS_DESCRIPTION,
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Visibility',
        name: 'visibility',
        type: 'options',
        options: [
          { name: 'Personal', value: 'personal' },
          { name: 'Global', value: 'global' },
        ],
        default: 'personal',
        description: `${MACRO_VISIBILITY_DESCRIPTION} Defaults to Personal when not set.`,
      },
    ],
  },
];
