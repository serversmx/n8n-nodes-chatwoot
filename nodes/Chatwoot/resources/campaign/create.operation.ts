import type { INodeProperties } from 'n8n-workflow';
import { campaignSharedFields } from './fields';

const additionalFieldOptions: INodeProperties[] = [
  ...campaignSharedFields,
  {
    displayName: 'Inbox ID (Deprecated)',
    name: 'inbox_id',
    type: 'number',
    default: 0,
    description:
      'Deprecated: use the Inbox field. Only used when Inbox is empty (workflows created before 0.9.0).',
  },
];
additionalFieldOptions.sort((a, b) => a.displayName.localeCompare(b.displayName));

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Title',
    name: 'title',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
    description: 'Title of the campaign',
  },
  {
    displayName: 'Message',
    name: 'message',
    type: 'string',
    required: true,
    default: '',
    typeOptions: { rows: 3 },
    displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
    description:
      'Campaign message. Website: the chat bubble shown to visitors. SMS: the text sent. WhatsApp: only a preview in Chatwoot, the template in Template Params is what is sent.',
  },
  {
    // Not flagged as required in the schema: workflows saved before 0.9.0 set the inbox in
    // Additional Fields > Inbox ID and must keep running. The node still requires one of the two.
    displayName: 'Inbox Name or ID',
    name: 'inboxId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getCampaignInboxes',
    },
    default: '',
    displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
    description:
      'Required. Inbox that runs the campaign: Website (live chat), SMS, Twilio SMS or WhatsApp. API channel inboxes (e.g. Evolution API) cannot run campaigns. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: { show: { resource: ['campaign'], operation: ['create'] } },
    options: additionalFieldOptions,
  },
];
