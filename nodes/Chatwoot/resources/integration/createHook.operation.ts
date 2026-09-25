import type { INodeProperties } from 'n8n-workflow';

export const SETTINGS_DESCRIPTION =
  'Integration settings as a JSON object; the keys depend on the app. Cloudflare RealtimeKit video calls (app "dyte", Chatwoot 4.16+): {"account_id": "...", "app_id": "...", "api_token": "..."}; Chatwoot 4.15 and older used Dyte keys {"api_key": "...", "organization_id": "..."}. OpenAI: {"api_key": "...", "label_suggestion": true}. Dialogflow: {"project_id": "...", "credentials": {...}, "region": "global", "language_code": "en"}. Google Translate: {"project_id": "...", "credentials": {...}}. Chatwoot 4.18 only returns non-secret keys in the output.';

export const createHookOperation: INodeProperties[] = [
  {
    displayName: 'App ID',
    name: 'appId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'dialogflow',
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['createHook'],
      },
    },
    description:
      'ID of the integration app: dialogflow, dyte (Cloudflare RealtimeKit since Chatwoot 4.16), google_translate, leadsquared or openai. Slack, Linear, Notion and Shopify are connected with OAuth in the Chatwoot UI. Use Integration > Get Many to list the apps.',
  },
  {
    displayName: 'Inbox ID',
    name: 'inboxId',
    type: 'number',
    default: 0,
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['createHook'],
      },
    },
    description:
      'ID of the inbox to attach the hook to. Required for inbox-level apps (Dialogflow); leave 0 for account-level apps (OpenAI, Cloudflare RealtimeKit/Dyte, Google Translate, LeadSquared).',
  },
  {
    displayName: 'Settings',
    name: 'settings',
    type: 'json',
    default: '{}',
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['createHook'],
      },
    },
    description: SETTINGS_DESCRIPTION,
  },
];
