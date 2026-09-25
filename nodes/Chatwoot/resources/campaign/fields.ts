import type { INodeProperties } from 'n8n-workflow';

// Campaign fields shared by Create (Additional Fields) and Update (Update Fields).
// Chatwoot 4.18 CampaignsController#campaign_params permits: title, description, message, enabled,
// trigger_only_during_business_hours, inbox_id, sender_id, scheduled_at, audience [type, id],
// trigger_rules {}, template_params {} (the same list as 4.13).

export const TEMPLATE_PARAMS_DESCRIPTION =
  'WhatsApp campaigns only (required there): the approved template to send. Object with "name" and "language" of a template of the inbox, ' +
  'plus optional "namespace", "category" and "processed_params" (values for the template variables by component; Liquid such as {{ contact.name }} is rendered per recipient). ' +
  'Example: {"name":"order_update","language":"en","category":"UTILITY","processed_params":{"body":{"1":"{{ contact.name }}"}}}. ' +
  'Sending needs a WhatsApp Cloud inbox and the whatsapp_campaign feature.';

export const campaignSharedFields: INodeProperties[] = [
  {
    displayName: 'Audience (JSON)',
    name: 'audience',
    type: 'json',
    default: '[]',
    description:
      'SMS and WhatsApp campaigns: labels whose contacts receive the campaign, as [{"type":"Label","id":1}] or a plain array of label IDs like [1, 2]. Merged with Audience Label IDs.',
  },
  {
    displayName: 'Audience Label IDs',
    name: 'audienceLabelIds',
    type: 'string',
    default: '',
    placeholder: '3, 7',
    description:
      'SMS and WhatsApp campaigns (required there): comma-separated label IDs. Contacts with any of these labels receive the campaign.',
  },
  {
    displayName: 'Description',
    name: 'description',
    type: 'string',
    default: '',
    description: 'Internal description of the campaign (not sent to contacts)',
  },
  {
    displayName: 'Enabled',
    name: 'enabled',
    type: 'boolean',
    default: true,
    description:
      'Whether a Website campaign is active. Does not cancel a scheduled SMS/WhatsApp campaign (delete it instead).',
  },
  {
    displayName: 'Scheduled At',
    name: 'scheduled_at',
    type: 'dateTime',
    default: '',
    description:
      'SMS and WhatsApp campaigns: when to send (ISO 8601 or Unix timestamp; a value without a UTC offset is read in the n8n server timezone). Defaults to now (sent within a few minutes) when not set. Website campaigns ignore it.',
  },
  {
    displayName: 'Sender Name or ID',
    name: 'sender_id',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getAgents',
    },
    default: '',
    description:
      'Website campaigns: the agent shown as the sender of the message. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Template Params (JSON)',
    name: 'template_params',
    type: 'json',
    default: '',
    description: TEMPLATE_PARAMS_DESCRIPTION,
  },
  {
    displayName: 'Time on Page (Seconds)',
    name: 'time_on_page',
    type: 'number',
    typeOptions: { minValue: 0 },
    default: 10,
    description:
      'Website campaigns: seconds the visitor must stay on the page before the message shows',
  },
  {
    displayName: 'Trigger Only During Business Hours',
    name: 'trigger_only_during_business_hours',
    type: 'boolean',
    default: false,
    description: 'Whether a Website campaign only triggers during the business hours of the inbox',
  },
  {
    displayName: 'Trigger URL',
    name: 'trigger_url',
    type: 'string',
    default: '',
    placeholder: 'https://example.com/pricing',
    description:
      'Website campaigns (required there): page URL where the campaign triggers. Must start with http:// or https://. Left empty, it is not sent.',
  },
];
