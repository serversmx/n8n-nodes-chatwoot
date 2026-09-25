import type { INodeProperties } from 'n8n-workflow';

// Notification::NOTIFICATION_TYPES (same in Chatwoot 4.13 to 4.18); flags are "<channel>_<type>"
const NOTIFICATION_EVENTS = [
  { name: 'Assigned Conversation New Message', type: 'assigned_conversation_new_message' },
  { name: 'Conversation Assignment', type: 'conversation_assignment' },
  { name: 'Conversation Creation', type: 'conversation_creation' },
  { name: 'Conversation Mention', type: 'conversation_mention' },
  {
    name: 'Participating Conversation New Message',
    type: 'participating_conversation_new_message',
  },
  { name: 'SLA Missed First Response (Enterprise)', type: 'sla_missed_first_response' },
  { name: 'SLA Missed Next Response (Enterprise)', type: 'sla_missed_next_response' },
  { name: 'SLA Missed Resolution (Enterprise)', type: 'sla_missed_resolution' },
];

const flagOptions = (channel: 'email' | 'push') =>
  NOTIFICATION_EVENTS.map(({ name, type }) => ({ name, value: `${channel}_${type}` }));

export const updateSettingsOperation: INodeProperties[] = [
  {
    displayName: 'Settings',
    name: 'notificationSettings',
    type: 'collection',
    placeholder: 'Add Setting',
    default: {},
    displayOptions: {
      show: {
        resource: ['notification'],
        operation: ['updateSettings'],
      },
    },
    options: [
      {
        displayName: 'Email Notifications',
        name: 'selected_email_flags',
        type: 'multiOptions',
        options: flagOptions('email'),
        default: [],
        description:
          'Events that send an email to the token user. Replaces the current list; an empty list turns email notifications off.',
      },
      {
        displayName: 'Push Notifications',
        name: 'selected_push_flags',
        type: 'multiOptions',
        options: flagOptions('push'),
        default: [],
        description:
          'Events that send a push notification to the token user. Replaces the current list; an empty list turns push notifications off.',
      },
    ],
  },
];
