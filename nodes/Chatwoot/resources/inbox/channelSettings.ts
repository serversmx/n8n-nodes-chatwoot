import type { INodeProperties } from 'n8n-workflow';

/** Shared warning for URLs that Chatwoot calls from its server (webhooks, agent bots, API inboxes). */
export const SAFE_FETCH_WARNING =
  'Chatwoot 4.14+ does not deliver to private or internal addresses (localhost, 10.x, 172.16-31.x, 192.168.x, or Docker service names such as http://n8n:5678) unless the Chatwoot server sets SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true. The URL is still saved, but deliveries silently fail.';

type ChannelType = 'api' | 'email' | 'web_widget';

interface ChannelSetting {
  /** Channel types whose Chatwoot model accepts this attribute (Channel::<Type>::EDITABLE_ATTRS). */
  channels: ChannelType[];
  /** Offered by the Create operation (welcome title/tagline are legacy Update Fields on Update). */
  create?: boolean;
  /** Offered by the Update operation. */
  update?: boolean;
  property: INodeProperties;
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  api: 'API',
  email: 'Email',
  web_widget: 'Website',
};

const SETTINGS: ChannelSetting[] = [
  // --- API channel ------------------------------------------------------------------------
  {
    channels: ['api'],
    property: {
      displayName: 'Additional Attributes (JSON)',
      name: 'additional_attributes',
      type: 'json',
      default: '{}',
      description:
        'JSON object with extra API channel settings, e.g. {"agent_reply_time_window": 24} to only let agents reply within 24 hours of the last incoming message. Replaces the stored object.',
    },
  },
  {
    channels: ['api', 'web_widget'],
    property: {
      displayName: 'HMAC Mandatory',
      name: 'hmac_mandatory',
      type: 'boolean',
      default: false,
      description:
        "Whether contacts must be identified with a valid identifier_hash (HMAC-SHA256 of the contact identifier signed with the inbox's HMAC token) before Chatwoot trusts their identity",
    },
  },
  {
    channels: ['api'],
    property: {
      displayName: 'Webhook URL',
      name: 'webhook_url',
      type: 'string',
      default: '',
      placeholder: 'https://evolution.example.com/chatwoot/webhook/my-instance',
      description: `URL where Chatwoot POSTs the events of this API inbox (for Evolution API: {evolution URL}/chatwoot/webhook/{instance}). Since Chatwoot 4.13 each delivery is signed with the inbox secret (headers X-Chatwoot-Signature and X-Chatwoot-Timestamp). ${SAFE_FETCH_WARNING}`,
    },
  },
  // --- Website (web widget) channel -------------------------------------------------------
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Allowed Domains',
      name: 'allowed_domains',
      type: 'string',
      default: '',
      placeholder: 'example.com, *.example.com',
      description: 'Comma-separated domains where the widget may load. Empty allows any domain.',
    },
  },
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Continuity via Email',
      name: 'continuity_via_email',
      type: 'boolean',
      default: true,
      description:
        'Whether to continue the conversation by email when the visitor leaves the website',
    },
  },
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Enabled Widget Features',
      name: 'selected_feature_flags',
      type: 'multiOptions',
      options: [
        { name: 'Allow Mobile Webview', value: 'allow_mobile_webview' },
        { name: 'Attachments', value: 'attachments' },
        { name: 'Emoji Picker', value: 'emoji_picker' },
        { name: 'End Conversation', value: 'end_conversation' },
        { name: 'Use Inbox Avatar for Bot', value: 'use_inbox_avatar_for_bot' },
      ],
      default: [],
      description: 'Widget features to enable. Features not selected are disabled.',
    },
  },
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Pre-Chat Form Enabled',
      name: 'pre_chat_form_enabled',
      type: 'boolean',
      default: false,
      description: 'Whether visitors must fill a pre-chat form before starting a conversation',
    },
  },
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Pre-Chat Form Options (JSON)',
      name: 'pre_chat_form_options',
      type: 'json',
      default: '{}',
      description:
        'JSON object, e.g. {"pre_chat_message": "Share your query", "pre_chat_fields": [{"field_type": "standard", "label": "Email", "name": "emailAddress", "type": "email", "required": true, "enabled": true}]}',
    },
  },
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Reply Time',
      name: 'reply_time',
      type: 'options',
      options: [
        { name: 'In a Day', value: 'in_a_day' },
        { name: 'In a Few Hours', value: 'in_a_few_hours' },
        { name: 'In a Few Minutes', value: 'in_a_few_minutes' },
      ],
      default: 'in_a_few_minutes',
      description: 'Expected reply time shown in the widget',
    },
  },
  {
    channels: ['web_widget'],
    update: false,
    property: {
      displayName: 'Welcome Tagline',
      name: 'welcome_tagline',
      type: 'string',
      default: '',
      description: 'Welcome tagline shown in the widget',
    },
  },
  {
    channels: ['web_widget'],
    update: false,
    property: {
      displayName: 'Welcome Title',
      name: 'welcome_title',
      type: 'string',
      default: '',
      description: 'Welcome title shown in the widget',
    },
  },
  {
    channels: ['web_widget'],
    property: {
      displayName: 'Widget Color',
      name: 'widget_color',
      type: 'color',
      default: '#1f93ff',
      description: 'Main color of the widget (hex)',
    },
  },
  // --- Email channel ----------------------------------------------------------------------
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Address',
      name: 'imap_address',
      type: 'string',
      default: '',
      placeholder: 'imap.example.com',
      description: 'IMAP server used to fetch incoming emails',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Authentication',
      name: 'imap_authentication',
      type: 'options',
      options: [
        { name: 'CRAM-MD5', value: 'cram-md5' },
        { name: 'Login', value: 'login' },
        { name: 'Plain', value: 'plain' },
      ],
      default: 'plain',
      description:
        'IMAP authentication mechanism. Requires Chatwoot 4.14+ (older versions always use Plain).',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Enable SSL',
      name: 'imap_enable_ssl',
      type: 'boolean',
      default: true,
      description: 'Whether to connect to the IMAP server over SSL',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Enabled',
      name: 'imap_enabled',
      type: 'boolean',
      default: false,
      description:
        'Whether Chatwoot fetches incoming emails over IMAP. When enabling it on Update, send the IMAP address, port, login and password in the same request: Chatwoot tests the connection with the settings of that request and answers 422 if it fails.',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Login',
      name: 'imap_login',
      type: 'string',
      default: '',
      description: 'IMAP username',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Password',
      name: 'imap_password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'IMAP password',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'IMAP Port',
      name: 'imap_port',
      type: 'number',
      default: 993,
      description: 'IMAP server port',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Address',
      name: 'smtp_address',
      type: 'string',
      default: '',
      placeholder: 'smtp.example.com',
      description: 'SMTP server used to send replies',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Authentication',
      name: 'smtp_authentication',
      type: 'options',
      options: [
        { name: 'CRAM-MD5', value: 'cram_md5' },
        { name: 'Login', value: 'login' },
        { name: 'Plain', value: 'plain' },
      ],
      default: 'login',
      description: 'SMTP authentication mechanism',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Domain',
      name: 'smtp_domain',
      type: 'string',
      default: '',
      description: 'HELO domain sent to the SMTP server',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Enable SSL/TLS',
      name: 'smtp_enable_ssl_tls',
      type: 'boolean',
      default: false,
      description: 'Whether to use implicit SSL/TLS (usually port 465)',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Enable STARTTLS Auto',
      name: 'smtp_enable_starttls_auto',
      type: 'boolean',
      default: true,
      description:
        'Whether to upgrade the connection with STARTTLS when available (usually port 587)',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Enabled',
      name: 'smtp_enabled',
      type: 'boolean',
      default: false,
      description:
        'Whether Chatwoot sends replies through this SMTP server. When enabling it on Update, send the SMTP address, port, login and password in the same request: Chatwoot tests the connection with the settings of that request and answers 422 if it fails.',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Login',
      name: 'smtp_login',
      type: 'string',
      default: '',
      description: 'SMTP username',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP OpenSSL Verify Mode',
      name: 'smtp_openssl_verify_mode',
      type: 'options',
      options: [
        { name: 'Client Once', value: 'client_once' },
        { name: 'Fail If No Peer Cert', value: 'fail_if_no_peer_cert' },
        { name: 'None', value: 'none' },
        { name: 'Peer', value: 'peer' },
      ],
      default: 'none',
      description: 'TLS certificate verification mode for the SMTP connection',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Password',
      name: 'smtp_password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'SMTP password',
    },
  },
  {
    channels: ['email'],
    property: {
      displayName: 'SMTP Port',
      name: 'smtp_port',
      type: 'number',
      default: 587,
      description: 'SMTP server port',
    },
  },
];

/**
 * Options of the "Channel Settings" collection. On Create they are filtered by the selected
 * Channel Type; on Update (the channel type is not known up front) every option is offered and
 * its description names the inbox types that accept it. Chatwoot ignores attributes that the
 * inbox's channel does not support.
 */
export function channelSettingOptions(operation: 'create' | 'update'): INodeProperties[] {
  return SETTINGS.filter((setting) =>
    operation === 'create' ? setting.create !== false : setting.update !== false,
  )
    .map((setting) => {
      if (operation === 'create') {
        return {
          ...setting.property,
          displayOptions: { show: { '/channelType': setting.channels } },
        };
      }
      const labels = setting.channels.map((channel) => CHANNEL_LABELS[channel]).join('/');
      return {
        ...setting.property,
        displayName: `${setting.property.displayName} (${labels})`,
        description: `${labels} inboxes only. ${setting.property.description}`,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
