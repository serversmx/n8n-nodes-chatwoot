import type { INodeProperties } from 'n8n-workflow';

export const importContactsOperation: INodeProperties[] = [
  {
    displayName: 'Input Binary Field',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['import'],
      },
    },
    description:
      'Name of the input binary property that holds the CSV file (e.g. from "Read/Write Files from Disk", "HTTP Request" or "Convert to File"). Header columns: name, email, phone_number, identifier, company_name ("company" before Chatwoot 4.14) and city; every column except name, email, phone_number, identifier and labels is also stored as a custom attribute. Recent Chatwoot versions also read a labels column (comma-separated, existing labels only; rows with unknown labels are rejected). Existing contacts are matched by identifier, email or phone number and updated. Chatwoot processes the file about a minute later and emails the result to administrators. Requires an administrator token.',
  },
];
