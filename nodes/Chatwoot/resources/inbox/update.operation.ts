import type { INodeProperties } from 'n8n-workflow';

import { channelSettingOptions } from './channelSettings';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Inbox',
    name: 'inboxId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getInboxes',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['update'],
      },
    },
    description:
      'Select the inbox to update. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the inbox',
      },
      {
        displayName: 'Enable Auto Assignment',
        name: 'enable_auto_assignment',
        type: 'boolean',
        default: true,
        description: 'Whether to automatically assign conversations to agents',
      },
      {
        displayName: 'Greeting Enabled',
        name: 'greeting_enabled',
        type: 'boolean',
        default: false,
        description: 'Whether to send a greeting message when a conversation starts',
      },
      {
        displayName: 'Greeting Message',
        name: 'greeting_message',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        default: '',
        description: 'Greeting message sent when greetings are enabled',
      },
      {
        displayName: 'Enable Email Collect',
        name: 'enable_email_collect',
        type: 'boolean',
        default: true,
        description:
          'Whether to prompt visitors for email before starting a conversation (Website inboxes)',
      },
      {
        displayName: 'CSAT Survey Enabled',
        name: 'csat_survey_enabled',
        type: 'boolean',
        default: false,
        description: 'Whether to show customer satisfaction survey after conversation resolution',
      },
      {
        displayName: 'CSAT Config (JSON)',
        name: 'csat_config',
        type: 'json',
        default: '{}',
        description:
          'Replaces the whole CSAT config. Keys not sent reset to Chatwoot defaults, including survey_rules; a WhatsApp CSAT template is removed unless template is included. Use Inbox > Get and include the settings to keep. Example: {"display_type": "emoji", "message": "Please rate us", "button_text": "Rate", "language": "en", "survey_rules": {"operator": "contains", "values": ["billing"]}}.',
      },
      {
        displayName: 'Allow Messages After Resolved',
        name: 'allow_messages_after_resolved',
        type: 'boolean',
        default: true,
        description:
          'Whether contacts can send messages after conversation is resolved (Website inboxes)',
      },
      {
        displayName: 'Lock to Single Conversation',
        name: 'lock_to_single_conversation',
        type: 'boolean',
        default: false,
        description:
          'Whether a contact keeps a single conversation instead of opening a new one after resolution (API, LINE, Telegram, WhatsApp and SMS inboxes)',
      },
      {
        displayName: 'Working Hours Enabled',
        name: 'working_hours_enabled',
        type: 'boolean',
        default: false,
        description: 'Whether to enable working hours for this inbox',
      },
      {
        displayName: 'Working Hours (JSON)',
        name: 'working_hours',
        type: 'json',
        default: '[]',
        description:
          'JSON array with the days to change, e.g. [{"day_of_week": 1, "open_hour": 9, "open_minutes": 0, "close_hour": 17, "close_minutes": 0}, {"day_of_week": 0, "closed_all_day": true}]. day_of_week: 0 = Sunday … 6 = Saturday; open_all_day is also accepted.',
      },
      {
        displayName: 'Out of Office Message',
        name: 'out_of_office_message',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        default: '',
        description: 'Message shown to visitors outside working hours',
      },
      {
        displayName: 'Timezone',
        name: 'timezone',
        type: 'string',
        default: '',
        placeholder: 'America/New_York',
        description: 'Timezone for working hours (e.g., America/New_York, Europe/London)',
      },
      {
        displayName: 'Business Name',
        name: 'business_name',
        type: 'string',
        default: '',
        description:
          'Business name used as sender name in email replies (Website and Email inboxes)',
      },
      {
        displayName: 'Sender Name Type',
        name: 'sender_name_type',
        type: 'options',
        options: [
          {
            name: 'Friendly',
            value: 'friendly',
            description: 'Agent name and business name, e.g. "John from Acme"',
          },
          {
            name: 'Professional',
            value: 'professional',
            description: 'Business name only',
          },
        ],
        default: 'friendly',
        description: 'Sender name used in outgoing email replies (Website and Email inboxes)',
      },
      {
        displayName: 'Help Center Portal ID',
        name: 'portal_id',
        type: 'number',
        default: 0,
        description: 'ID of the Help Center portal linked to the inbox. 0 unlinks the portal.',
      },
      {
        displayName: 'Branded Email Layout',
        name: 'branded_email_layout',
        type: 'string',
        typeOptions: {
          rows: 6,
        },
        default: '',
        description:
          'Liquid HTML layout for outgoing email replies of an Email inbox. Must contain {{ content_for_layout }}; empty removes the inbox layout. Requires Chatwoot 4.17+, an administrator token and the branded_email_templates feature flag.',
      },
      {
        displayName: 'Welcome Title',
        name: 'welcome_title',
        type: 'string',
        default: '',
        description:
          'Welcome title shown in the widget (Website inboxes; sent as a channel setting)',
      },
      {
        displayName: 'Welcome Tagline',
        name: 'welcome_tagline',
        type: 'string',
        default: '',
        description:
          'Welcome tagline shown in the widget (Website inboxes; sent as a channel setting)',
      },
      {
        displayName: 'Website URL',
        name: 'website_url',
        type: 'string',
        default: '',
        description:
          'Website URL of the widget (Website inboxes; sent as a channel setting). Empty keeps the current URL.',
      },
    ],
  },
  {
    displayName: 'Channel Settings',
    name: 'channelSettings',
    type: 'collection',
    placeholder: 'Add Setting',
    default: {},
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['update'],
      },
    },
    description:
      "Settings of the inbox's channel, sent inside `channel`. Each setting names the inbox types that accept it; Chatwoot ignores settings the inbox's channel does not support.",
    options: channelSettingOptions('update'),
  },
];
