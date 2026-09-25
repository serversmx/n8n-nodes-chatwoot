import type { INodeProperties } from 'n8n-workflow';
import { CONTACT_FILTER_PAYLOAD_HELP } from './filter.operation';

export const exportContactsOperation: INodeProperties[] = [
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['export'],
      },
    },
    options: [
      {
        displayName: 'Column Names',
        name: 'column_names',
        type: 'string',
        default: '',
        description:
          'Comma-separated contact columns to include, in order (e.g. id,name,email,phone_number,identifier,created_at,labels). Unknown columns are skipped, and so is labels on Chatwoot versions older than the labels export. Default: id,name,email,phone_number (plus labels where supported).',
      },
      {
        displayName: 'Filter Payload',
        name: 'payload',
        type: 'json',
        default: '[]',
        description: `Export only the contacts matching these conditions (same format as Contact > Filter; takes precedence over Label). ${CONTACT_FILTER_PAYLOAD_HELP}`,
      },
      {
        // The parameter name stays 'tag' for saved workflows; Chatwoot reads it as `label`
        displayName: 'Label',
        name: 'tag',
        type: 'string',
        default: '',
        description:
          'Export only contacts with this label (label title; separate several with commas to match any of them)',
      },
    ],
  },
];
