import type { INodeProperties } from 'n8n-workflow';
import { csvOutputFields } from '../report/helpers';
import { csatFilterOptions } from './filters';

export const downloadOperation: INodeProperties[] = [
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
