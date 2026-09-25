import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['create'],
      },
    },
    description: 'The ID of the conversation to send the message to',
  },
  {
    displayName: 'Content',
    name: 'content',
    type: 'string',
    default: '',
    typeOptions: {
      rows: 4,
    },
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['create'],
      },
    },
    description:
      'The message text. Optional when the message has attachments (it becomes the caption), a template or a non-text content type.',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Attachments (Binary Properties)',
        name: 'binaryPropertyNames',
        type: 'string',
        default: 'data',
        placeholder: 'data, image, invoice',
        description:
          'Comma-separated names of the input binary properties to send as attachments (max 15). The message is then sent as multipart/form-data. API inboxes (e.g. Evolution) receive each file as a data_url to relay to WhatsApp.',
      },
      {
        displayName: 'BCC Emails',
        name: 'bcc_emails',
        type: 'string',
        default: '',
        description: 'Comma-separated BCC addresses. Email inboxes only.',
      },
      {
        displayName: 'Campaign ID',
        name: 'campaign_id',
        type: 'number',
        default: 0,
        description: 'Link the message to this campaign (stored in the message additional attributes)',
      },
      {
        displayName: 'CC Emails',
        name: 'cc_emails',
        type: 'string',
        default: '',
        description: 'Comma-separated CC addresses. Email inboxes only.',
      },
      {
        displayName: 'Content Attributes',
        name: 'content_attributes',
        type: 'json',
        default: '{}',
        description:
          'JSON object with content attributes, e.g. {"in_reply_to": 123} to reply to a message, {"items": [...]} for input_select/cards, or {"source": "n8n_bot"} for anti-loop detection',
      },
      {
        displayName: 'Content Type',
        name: 'content_type',
        type: 'options',
        default: 'text',
        options: [
          {
            name: 'Text',
            value: 'text',
            description: 'Plain text message',
          },
          {
            name: 'Article',
            value: 'article',
            description: 'Article/rich content',
          },
          {
            name: 'Cards',
            value: 'cards',
            description: 'Card-based layout',
          },
          {
            name: 'Form',
            value: 'form',
            description: 'Form input',
          },
          {
            name: 'Input Email',
            value: 'input_email',
            description: 'Email input request',
          },
          {
            name: 'Input Select',
            value: 'input_select',
            description: 'Selection input',
          },
        ],
        description: 'The type of content being sent',
      },
      {
        displayName: 'Echo ID',
        name: 'echo_id',
        type: 'string',
        default: '',
        description: 'Temporary client-side ID that Chatwoot returns in the response and in real-time events (not stored)',
      },
      {
        displayName: 'Email HTML Content',
        name: 'email_html_content',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        default: '',
        description: 'Custom HTML body for the email. Email inboxes only; Content is still used as the text version.',
      },
      {
        displayName: 'External Created At',
        name: 'external_created_at',
        type: 'dateTime',
        default: '',
        description: 'When the message was created in the external system (stored as a Unix timestamp in the content attributes)',
      },
      {
        displayName: 'Message Type',
        name: 'message_type',
        type: 'options',
        default: 'outgoing',
        options: [
          {
            name: 'Outgoing',
            value: 'outgoing',
            description: 'Message sent by agent (default)',
          },
          {
            name: 'Incoming',
            value: 'incoming',
            description: 'Message received from contact. API inboxes only.',
          },
        ],
        description: 'The direction of the message',
      },
      {
        displayName: 'Private Note',
        name: 'private',
        type: 'boolean',
        default: false,
        description: 'Whether to send as a private note (only visible to agents)',
      },
      {
        displayName: 'Send as Agent Bot ID',
        name: 'sender_agent_bot_id',
        type: 'number',
        default: 0,
        description:
          'Send the outgoing message as this agent bot instead of the user that owns the API token (e.g. so Evolution signs WhatsApp messages with the bot name)',
      },
      {
        displayName: 'Send Audio as Voice Message',
        name: 'is_voice_message',
        type: 'boolean',
        default: false,
        description:
          'Whether to mark audio attachments as voice notes (Chatwoot 4.14.2+, used by WhatsApp Cloud inboxes). Evolution API inboxes always send audio as a voice note.',
      },
      {
        displayName: 'Source ID',
        name: 'source_id',
        type: 'string',
        default: '',
        description:
          'External ID of the message in the channel (e.g. the WhatsApp message ID), stored on the message. Useful in API inboxes to match delivery updates and avoid duplicates.',
      },
      {
        displayName: 'Template Params (WhatsApp)',
        name: 'template_params',
        type: 'json',
        default: '{}',
        description:
          'WhatsApp template for WhatsApp Cloud/360dialog inboxes (Evolution inboxes send only the text). Format: {"name": "order_update", "category": "UTILITY", "language": "en", "processed_params": {"body": {"1": "121212"}, "header": {"media_url": "https://...", "media_type": "image"}, "buttons": [{"type": "copy_code", "parameter": "SAVE20"}]}}. The flat {"processed_params": {"1": "x"}} format is deprecated. Add "content_mode": "raw_template" (Chatwoot 4.17+) when Content holds the raw template body. Cannot be combined with attachments.',
      },
      {
        displayName: 'To Emails',
        name: 'to_emails',
        type: 'string',
        default: '',
        description: 'Comma-separated recipient addresses. Email inboxes only.',
      },
    ],
  },
];
