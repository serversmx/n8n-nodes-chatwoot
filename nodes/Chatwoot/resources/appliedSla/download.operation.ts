import type { INodeProperties } from 'n8n-workflow';
import { csvOutputFields } from '../report/helpers';
import { appliedSlaFilterOptions } from './filters';

export const downloadOperation: INodeProperties[] = [
  ...csvOutputFields('appliedSla', ['download']),
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: { resource: ['appliedSla'], operation: ['download'] } },
    options: appliedSlaFilterOptions,
  },
];
