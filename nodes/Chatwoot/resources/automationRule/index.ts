import type { INodeProperties } from 'n8n-workflow';

export const automationRuleOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['automationRule'],
    },
  },
  options: [
    {
      name: 'Clone',
      value: 'clone',
      description:
        'Duplicate an automation rule (same name, event, conditions, actions, active flag and delay). Returns the new rule under "payload". A rule with an execution delay cannot be cloned while delayed automations are disabled (422).',
      action: 'Clone an automation rule',
    },
    {
      name: 'Create',
      value: 'create',
      description:
        'Create an automation rule. Every automation rule operation requires an administrator token.',
      action: 'Create an automation rule',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete an automation rule',
      action: 'Delete an automation rule',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get an automation rule by ID. Returns the rule under "payload".',
      action: 'Get an automation rule',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all automation rules of the account. Returns them as a "payload" array.',
      action: 'Get all automation rules',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update an automation rule. Only the fields you add are changed.',
      action: 'Update an automation rule',
    },
  ],
  default: 'getAll',
};

// Kept in one place so Create and Update show the same guidance.
const EVENT_OPTIONS = [
  {
    name: 'Conversation Created',
    value: 'conversation_created',
    description: 'A new conversation is created',
  },
  {
    name: 'Conversation Opened',
    value: 'conversation_opened',
    description: 'A resolved or pending conversation is reopened',
  },
  {
    name: 'Conversation Resolved',
    value: 'conversation_resolved',
    description: 'A conversation is marked as resolved',
  },
  {
    name: 'Conversation Updated',
    value: 'conversation_updated',
    description: 'Any conversation attribute changes (status, assignee, team, labels...)',
  },
  {
    name: 'Message Created',
    value: 'message_created',
    description: 'A new message is added to a conversation',
  },
];

const CONDITIONS_DESCRIPTION =
  'Non-empty JSON array of conditions; at least one is required because an empty list runs on every event. Each item: {"attribute_key", "filter_operator", "values": [...], "query_operator"}. ' +
  'query_operator ("and"/"or") joins a condition with the next one: set it on every condition except the last, which uses null. ' +
  'Standard attribute_key values: status, inbox_id, assignee_id, team_id, priority, labels, content, message_type, private_note, ' +
  'email, phone_number, company_name, country_code, city, browser_language, conversation_language, mail_subject, referer ' +
  '(Enterprise adds sla_policy_id). Custom attributes use their key plus "custom_attribute_type": "contact_attribute" or "conversation_attribute". ' +
  'Operators: equal_to, not_equal_to, contains, does_not_contain, starts_with, is_present, is_not_present, is_greater_than, is_less_than, attribute_changed. ' +
  'Chatwoot 4.14+ renamed "company" to "company_name"; the node rewrites a standard "company" key automatically (so Chatwoot 4.13 and older cannot use this condition). ' +
  'Example: [{"attribute_key":"status","filter_operator":"equal_to","values":["open"],"query_operator":null}]';

const ACTIONS_DESCRIPTION =
  'JSON array of actions. Each item: {"action_name", "action_params": [...]}. ' +
  'Valid action_name values: assign_agent, assign_team, remove_assigned_agent, remove_assigned_team, add_label, remove_label, ' +
  'send_message, add_private_note, send_email_to_team, send_email_transcript, send_webhook_event, mute_conversation, snooze_conversation, ' +
  'resolve_conversation, open_conversation, pending_conversation, change_status, change_priority, send_attachment (Enterprise adds add_sla). ' +
  'Example: [{"action_name":"assign_team","action_params":[1]},{"action_name":"add_label","action_params":["vip"]}]';

const EXECUTION_DELAY_DESCRIPTION =
  'Wait this many minutes (10 to 43200, i.e. 30 days) after the event before re-checking the conditions and running the actions. ' +
  'Requires Chatwoot 4.17+ with the "delayed_automations" feature enabled for the account (otherwise Chatwoot answers 422). ' +
  'Delayed rules cannot use attribute_changed conditions, and conversation events only accept status and inbox_id conditions.';

export const automationRuleFields: INodeProperties[] = [
  // Get/Update/Delete/Clone
  {
    displayName: 'Automation Rule ID',
    name: 'automationRuleId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['get', 'update', 'delete', 'clone'],
      },
    },
    description: 'ID of the automation rule',
  },
  // Create
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['create'],
      },
    },
    description: 'Name of the automation rule',
  },
  {
    displayName: 'Event Name',
    name: 'eventName',
    type: 'options',
    required: true,
    options: EVENT_OPTIONS,
    default: 'conversation_created',
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['create'],
      },
    },
    description: 'Event that triggers the automation',
  },
  {
    displayName: 'Conditions (JSON)',
    name: 'conditions',
    type: 'json',
    required: true,
    default: '[]',
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['create'],
      },
    },
    description: CONDITIONS_DESCRIPTION,
  },
  {
    displayName: 'Actions (JSON)',
    name: 'actions',
    type: 'json',
    required: true,
    default: '[]',
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['create'],
      },
    },
    description: ACTIONS_DESCRIPTION,
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Active',
        name: 'active',
        type: 'boolean',
        default: true,
        description: 'Whether the rule is active',
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        description: 'Description of the automation rule',
      },
      {
        displayName: 'Execution Delay (Minutes)',
        name: 'execution_delay',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 43200 },
        default: 60,
        description: `${EXECUTION_DELAY_DESCRIPTION} 0 creates an immediate rule.`,
      },
    ],
  },
  // Update
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['automationRule'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Actions (JSON)',
        name: 'actions',
        type: 'json',
        default: '',
        description: `Replaces all actions. ${ACTIONS_DESCRIPTION}`,
      },
      {
        displayName: 'Active',
        name: 'active',
        type: 'boolean',
        default: true,
        description: 'Whether the rule is active',
      },
      {
        displayName: 'Conditions (JSON)',
        name: 'conditions',
        type: 'json',
        default: '',
        description: `Replaces all conditions. ${CONDITIONS_DESCRIPTION}`,
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        description: 'Description of the automation rule',
      },
      {
        displayName: 'Event Name',
        name: 'event_name',
        type: 'options',
        options: EVENT_OPTIONS,
        default: 'conversation_created',
        description: 'Event that triggers the automation',
      },
      {
        displayName: 'Execution Delay (Minutes)',
        name: 'execution_delay',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 43200 },
        default: 60,
        description: `${EXECUTION_DELAY_DESCRIPTION} 0 removes the delay (the rule runs immediately again).`,
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the automation rule',
      },
    ],
  },
];
