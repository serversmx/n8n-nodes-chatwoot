import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { chatwootApiRequest, getHttpStatus } from '../../GenericFunctions';

/**
 * Channels Campaign#validate_campaign_inbox accepts (inbox_type Website, Twilio SMS, Sms, Whatsapp).
 * API channel inboxes (Evolution API, custom integrations) are rejected with 422 "Unsupported Inbox type".
 */
export const CAMPAIGN_CHANNEL_TYPES = [
  'Channel::WebWidget',
  'Channel::Sms',
  'Channel::TwilioSms',
  'Channel::Whatsapp',
];

/**
 * Load the inboxes that can run campaigns
 */
export async function getCampaignInboxes(
  this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
  let response: IDataObject | IDataObject[];
  try {
    response = await chatwootApiRequest.call(this, 'GET', '/inboxes');
  } catch (error) {
    // Same policy as the shared loadOptions: an empty list on 404 only, other errors are shown
    if (getHttpStatus(error) === 404) return [];
    // `error` is already a NodeApiError from chatwootApiRequest (see GenericFunctions.chatwootRequest).
    // eslint-disable-next-line
    throw error;
  }

  const inboxes = (Array.isArray(response) ? response : (response.payload ?? [])) as IDataObject[];
  if (!Array.isArray(inboxes)) return [];

  return inboxes
    .filter((inbox) => CAMPAIGN_CHANNEL_TYPES.includes(inbox.channel_type as string))
    .map((inbox) => ({
      name: `${inbox.name as string} (${inbox.channel_type as string})`,
      value: inbox.id as number,
    }));
}
