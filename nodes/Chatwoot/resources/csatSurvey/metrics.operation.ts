import type { INodeProperties } from 'n8n-workflow';
import { csatFilterOptions } from './filters';

export const metricsOperation: INodeProperties[] = [
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['csatSurvey'],
        operation: ['metrics'],
      },
    },
    options: csatFilterOptions,
  },
];
