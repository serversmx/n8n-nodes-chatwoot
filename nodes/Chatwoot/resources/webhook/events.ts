import type { INodePropertyOptions } from 'n8n-workflow';

/** Chatwoot Webhook::ALLOWED_WEBHOOK_EVENTS (identical in Chatwoot 4.13–4.18). */
export const WEBHOOK_EVENT_OPTIONS: INodePropertyOptions[] = [
  {
    name: 'Contact Created',
    value: 'contact_created',
    description: 'Triggered when a new contact is created',
  },
  {
    name: 'Contact Updated',
    value: 'contact_updated',
    description: 'Triggered when a contact is updated',
  },
  {
    name: 'Conversation Created',
    value: 'conversation_created',
    description: 'Triggered when a new conversation is created',
  },
  {
    name: 'Conversation Status Changed',
    value: 'conversation_status_changed',
    description: 'Triggered when conversation status changes (open, resolved, pending, snoozed)',
  },
  {
    name: 'Conversation Typing Off',
    value: 'conversation_typing_off',
    description: 'Triggered when an agent or contact stops typing',
  },
  {
    name: 'Conversation Typing On',
    value: 'conversation_typing_on',
    description: 'Triggered when an agent or contact starts typing',
  },
  {
    name: 'Conversation Updated',
    value: 'conversation_updated',
    description: 'Triggered when a conversation is updated',
  },
  {
    name: 'Inbox Created',
    value: 'inbox_created',
    description:
      'Triggered when an inbox is created (the payload has the inbox settings and channel, not the inbox ID)',
  },
  {
    name: 'Inbox Updated',
    value: 'inbox_updated',
    description: 'Triggered when inbox settings change (includes changed_attributes)',
  },
  {
    name: 'Message Created',
    value: 'message_created',
    description: 'Triggered when a new message is sent',
  },
  {
    name: 'Message Updated',
    value: 'message_updated',
    description: 'Triggered when a message is updated',
  },
  {
    name: 'Webwidget Triggered',
    value: 'webwidget_triggered',
    description: 'Triggered when chat widget is opened',
  },
];
