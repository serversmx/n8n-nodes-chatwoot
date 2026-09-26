import type { INodeProperties } from 'n8n-workflow';

import { channelSettingOptions } from './channelSettings';

const show = (channelType?: string[]) => ({
  show: {
    resource: ['inbox'],
    operation: ['create'],
    ...(channelType ? { channelType } : {}),
  },
});

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(),
    description:
      'Name of the inbox. Telegram inboxes ignore it: Chatwoot names them after the bot.',
  },
  {
    displayName: 'Channel Type',
    name: 'channelType',
    type: 'options',
    required: true,
    options: [
      {
        name: 'API',
        value: 'api',
        description: 'Generic API channel for custom integrations (e.g. Evolution API)',
      },
      {
        name: 'Email',
        value: 'email',
        description: 'Email inbox with optional IMAP/SMTP settings',
      },
      {
        name: 'LINE',
        value: 'line',
        description: 'LINE Messaging API channel',
      },
      {
        name: 'SMS (Bandwidth)',
        value: 'sms',
        description: 'SMS through Bandwidth',
      },
      {
        name: 'Telegram',
        value: 'telegram',
        description: 'Telegram bot',
      },
      {
        name: 'Web Widget',
        value: 'web_widget',
        description: 'Website live-chat widget',
      },
      {
        name: 'WhatsApp',
        value: 'whatsapp',
        description: 'WhatsApp Cloud API (or legacy 360dialog)',
      },
    ],
    default: 'api',
    displayOptions: show(),
    description:
      'Type of channel. Facebook, Instagram, TikTok, X (Twitter) and Google/Microsoft email inboxes need OAuth in the Chatwoot UI, and Twilio SMS/WhatsApp inboxes use another endpoint, so they cannot be created here.',
  },
  // --- Required channel fields ---------------------------------------------------------------
  {
    displayName: 'Website URL',
    name: 'websiteUrl',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'https://example.com',
    displayOptions: show(['web_widget']),
    description: 'URL of the website where the widget is installed',
  },
  {
    displayName: 'Email',
    name: 'email',
    type: 'string',
    placeholder: 'support@example.com',
    required: true,
    default: '',
    displayOptions: show(['email']),
    description: 'Email address of the inbox (must be unique in the Chatwoot installation)',
  },
  {
    displayName: 'Phone Number',
    name: 'phoneNumber',
    type: 'string',
    required: true,
    default: '',
    placeholder: '+15551234567',
    displayOptions: show(['whatsapp', 'sms']),
    description: 'Phone number of the channel in E.164 format',
  },
  {
    displayName: 'WhatsApp Provider',
    name: 'whatsappProvider',
    type: 'options',
    options: [
      {
        name: 'WhatsApp Cloud API',
        value: 'whatsapp_cloud',
        description: "Meta's WhatsApp Cloud API",
      },
      {
        name: '360dialog (Legacy)',
        value: 'default',
        description: 'Deprecated 360dialog on-premise API',
      },
    ],
    default: 'whatsapp_cloud',
    displayOptions: show(['whatsapp']),
    description:
      'WhatsApp provider. Chatwoot validates the credentials with the provider when the inbox is created.',
  },
  {
    displayName: 'API Key',
    name: 'apiKey',
    type: 'string',
    typeOptions: { password: true },
    required: true,
    default: '',
    displayOptions: show(['whatsapp']),
    description:
      'WhatsApp Cloud API access token (or the 360dialog API key for the legacy provider)',
  },
  {
    displayName: 'Phone Number ID',
    name: 'phoneNumberId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['create'],
        channelType: ['whatsapp'],
        whatsappProvider: ['whatsapp_cloud'],
      },
    },
    description: 'Phone number ID from the Meta WhatsApp Business dashboard',
  },
  {
    displayName: 'Business Account ID',
    name: 'businessAccountId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['create'],
        channelType: ['whatsapp'],
        whatsappProvider: ['whatsapp_cloud'],
      },
    },
    description: 'WhatsApp Business Account (WABA) ID from the Meta dashboard',
  },
  {
    displayName: 'Bandwidth Account ID',
    name: 'bandwidthAccountId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(['sms']),
    description: 'Bandwidth account ID',
  },
  {
    displayName: 'Bandwidth Application ID',
    name: 'bandwidthApplicationId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(['sms']),
    description: 'Bandwidth messaging application ID',
  },
  {
    displayName: 'Bandwidth API Key',
    name: 'bandwidthApiKey',
    type: 'string',
    typeOptions: { password: true },
    required: true,
    default: '',
    displayOptions: show(['sms']),
    description: 'Bandwidth API username (key)',
  },
  {
    displayName: 'Bandwidth API Secret',
    name: 'bandwidthApiSecret',
    type: 'string',
    typeOptions: { password: true },
    required: true,
    default: '',
    displayOptions: show(['sms']),
    description: 'Bandwidth API password (secret)',
  },
  {
    displayName: 'Bot Token',
    name: 'botToken',
    type: 'string',
    typeOptions: { password: true },
    required: true,
    default: '',
    displayOptions: show(['telegram']),
    description:
      'Telegram bot token from @BotFather. Chatwoot validates it and registers its webhook.',
  },
  {
    displayName: 'LINE Channel ID',
    name: 'lineChannelId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(['line']),
    description: 'Channel ID from the LINE Developers console',
  },
  {
    displayName: 'LINE Channel Secret',
    name: 'lineChannelSecret',
    type: 'string',
    typeOptions: { password: true },
    required: true,
    default: '',
    displayOptions: show(['line']),
    description: 'Channel secret from the LINE Developers console',
  },
  {
    displayName: 'LINE Channel Token',
    name: 'lineChannelToken',
    type: 'string',
    typeOptions: { password: true },
    required: true,
    default: '',
    displayOptions: show(['line']),
    description: 'Long-lived channel access token from the LINE Developers console',
  },
  // --- Optional channel settings (sent inside `channel`) -----------------------------------
  {
    displayName: 'Channel Settings',
    name: 'channelSettings',
    type: 'collection',
    placeholder: 'Add Setting',
    default: {},
    displayOptions: show(['api', 'email', 'web_widget']),
    description: 'Optional settings of the selected channel type',
    options: channelSettingOptions('create'),
  },
  // --- Optional inbox settings (sent at the root) ------------------------------------------
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: show(),
    options: [
      {
        displayName: 'Allow Messages After Resolved',
        name: 'allow_messages_after_resolved',
        type: 'boolean',
        default: true,
        description:
          'Whether contacts can keep messaging after the conversation is resolved (Website inboxes)',
      },
      {
        // Obsolete: Chatwoot's inbox API accepts an uploaded `avatar` file, not an avatar URL,
        // so this value was never applied. Hidden (always) but kept for saved workflows.
        displayName: 'Avatar URL',
        name: 'avatar_url',
        type: 'string',
        default: '',
        displayOptions: { hide: { '/resource': ['inbox'] } },
        description: 'Not supported by Chatwoot (ignored)',
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
        displayName: 'CSAT Survey Enabled',
        name: 'csat_survey_enabled',
        type: 'boolean',
        default: false,
        description:
          'Whether to send a customer satisfaction survey when a conversation is resolved',
      },
      {
        displayName: 'Enable Auto Assignment',
        name: 'enable_auto_assignment',
        type: 'boolean',
        default: true,
        description:
          'Whether new conversations are automatically assigned to available agents of the inbox',
      },
      {
        displayName: 'Enable Email Collect',
        name: 'enable_email_collect',
        type: 'boolean',
        default: true,
        description: 'Whether to ask visitors for their email (Website inboxes)',
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
        typeOptions: { rows: 3 },
        default: '',
        description: 'The greeting message sent when greetings are enabled',
      },
      {
        displayName: 'Help Center Portal ID',
        name: 'portal_id',
        type: 'number',
        default: 0,
        description: 'ID of the Help Center portal linked to the inbox (0 = none)',
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
        displayName: 'Out of Office Message',
        name: 'out_of_office_message',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        description: 'Message sent outside working hours',
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
        displayName: 'Timezone',
        name: 'timezone',
        type: 'string',
        default: 'UTC',
        placeholder: 'America/Mexico_City',
        description: 'IANA timezone used for working hours',
      },
      {
        displayName: 'Working Hours Enabled',
        name: 'working_hours_enabled',
        type: 'boolean',
        default: false,
        description:
          'Whether working hours are enforced (configure the hours afterwards with Inbox > Update > Working Hours)',
      },
    ],
  },
];
