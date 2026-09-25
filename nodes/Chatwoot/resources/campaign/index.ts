import type { INodeProperties } from 'n8n-workflow';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';
import { getMetricsOperation } from './getMetrics.operation';
import { getRecipientsOperation } from './getRecipients.operation';

export { getCampaignInboxes } from './loadOptions';

// Every campaign endpoint requires an administrator token (CampaignPolicy)
export const campaignOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['campaign'] } },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a campaign (administrator token). Website: set Trigger URL. SMS: set Audience Label IDs. WhatsApp: set Audience Label IDs and Template Params.',
      action: 'Create a campaign',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a campaign',
      action: 'Delete a campaign',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get a campaign by ID. campaign_status is active, processing or completed; one-off SMS/WhatsApp campaigns also return scheduled_at as Unix seconds.',
      action: 'Get a campaign',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get all campaigns of the account (administrator token), one item per campaign. The "id" of each item is the ID the other campaign operations take.',
      action: 'Get many campaigns',
    },
    {
      name: 'Get Metrics',
      value: 'getMetrics',
      description:
        'Get delivery totals of a one-off WhatsApp campaign (audience, sent, delivered, read, failed, skipped). Requires Chatwoot 4.17+ Enterprise with WhatsApp campaigns enabled.',
      action: 'Get campaign delivery metrics',
    },
    {
      name: 'Get Recipients',
      value: 'getRecipients',
      description:
        'Get the recipients of a one-off WhatsApp campaign with their delivery status and error details. Requires Chatwoot 4.17+ Enterprise with WhatsApp campaigns enabled.',
      action: 'Get campaign recipients',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update a campaign. Completed one-off campaigns cannot be changed.',
      action: 'Update a campaign',
    },
  ],
  default: 'getAll',
};

export const campaignFields: INodeProperties[] = [
  ...getOperation,
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
  ...getMetricsOperation,
  ...getRecipientsOperation,
];
