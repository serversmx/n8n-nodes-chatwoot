import type { INodeProperties } from 'n8n-workflow';
import { campaignSharedFields } from './fields';

const updateFieldOptions: INodeProperties[] = [
  ...campaignSharedFields,
  {
    displayName: 'Message',
    name: 'message',
    type: 'string',
    default: '',
    typeOptions: { rows: 3 },
    description: 'Campaign message content',
  },
  {
    displayName: 'Title',
    name: 'title',
    type: 'string',
    default: '',
    description: 'Title of the campaign',
  },
];
updateFieldOptions.sort((a, b) => a.displayName.localeCompare(b.displayName));

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Campaign ID',
    name: 'campaignId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['campaign'], operation: ['update'] } },
    description: 'The ID of the campaign to update (the "id" returned by Get Many)',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: { show: { resource: ['campaign'], operation: ['update'] } },
    options: updateFieldOptions,
  },
];
