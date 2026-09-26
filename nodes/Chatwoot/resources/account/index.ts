import type { INodeProperties } from 'n8n-workflow';
import { getOperation } from './get.operation';
import { updateOperation } from './update.operation';
import { brandedEmailLayoutOperation } from './brandedEmailLayout.operation';

export const accountOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['account'],
    },
  },
  options: [
    {
      name: 'Get',
      value: 'get',
      description:
        'Get account details, including settings such as auto-resolve and enabled features',
      action: 'Get account details',
    },
    {
      name: 'Get Branded Email Layout',
      value: 'getBrandedEmailLayout',
      description:
        'Get the Liquid HTML layout used for outgoing emails. Requires Chatwoot 4.17+ and an administrator token.',
      action: 'Get branded email layout',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update account settings (name, locale, auto-resolve, company details)',
      action: 'Update account settings',
    },
    {
      name: 'Update Branded Email Layout',
      value: 'updateBrandedEmailLayout',
      description:
        'Set or remove the Liquid HTML layout used for outgoing emails. Requires Chatwoot 4.17+, an administrator token and the branded_email_templates feature flag (disabled by default).',
      action: 'Update branded email layout',
    },
  ],
  default: 'get',
};

export const accountFields: INodeProperties[] = [
  ...getOperation,
  ...updateOperation,
  ...brandedEmailLayoutOperation,
];
