import type { INodeProperties } from 'n8n-workflow';
import { csvOutputFields } from '../report/helpers';
import { csatFilterOptions } from './filters';

export const downloadOperation: INodeProperties[] = [
  ...(['since', 'until'] as const).map((name): INodeProperties => ({
    displayName: name === 'since' ? 'Since' : 'Until',
    name,
    type: 'dateTime',
    required: true,
    default: '',
    displayOptions: {
      show: { resource: ['csatSurvey'], operation: ['download'] },
      hide: { [`/options.${name}`]: [{ _cnd: { exists: true } }] },
    },
    description: 'Required reporting period for the CSV; saved Options date values remain supported',
  })),
  ...csvOutputFields('csatSurvey', ['download']),
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['csatSurvey'],
        operation: ['download'],
      },
    },
    description:
      'Since and Until are required: Chatwoot writes the reporting period at the end of the CSV',
    options: csatFilterOptions,
  },
];
