import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { parseJsonSafe } from '../../GenericFunctions';

/**
 * Parse a list of user (agent) IDs from a comma-separated string, a single number or an array.
 * Blank entries are ignored; anything that is not a positive integer throws, so a typo never
 * silently removes the wrong members.
 */
export function parseUserIds(value: unknown, fieldName = 'User IDs'): number[] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  const ids: number[] = [];
  for (const part of parts) {
    const text = String(part).trim();
    if (text === '') continue;
    const id = Number(text);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `${fieldName} must be a comma-separated list of positive integers, got "${text}"`,
      );
    }
    ids.push(id);
  }
  if (ids.length === 0) {
    throw new Error(`${fieldName} must contain at least one user ID`);
  }
  return ids;
}

// Channel settings that hold JSON (objects/arrays) and may arrive as a JSON string from the UI
const JSON_CHANNEL_SETTINGS = ['additional_attributes', 'pre_chat_form_options'];

/**
 * Convert the "Channel Settings" collection into the `channel` attributes Chatwoot expects
 * (Channel::<Type>::EDITABLE_ATTRS). With `skipEmpty`, empty strings are dropped (create);
 * otherwise they are sent so a value can be cleared (update).
 */
export function buildChannelAttributes(settings: IDataObject, skipEmpty: boolean): IDataObject {
  const channel: IDataObject = {};
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined || value === null) continue;
    if (skipEmpty && value === '') continue;
    if (JSON_CHANNEL_SETTINGS.includes(key)) {
      if (value === '') continue;
      channel[key] = parseJsonSafe(value, key);
    } else {
      channel[key] = value;
    }
  }
  return channel;
}

// Inbox-level attributes that live on the channel in Chatwoot and were exposed at the root of the
// Update operation before v0.9.0 (Chatwoot silently dropped them there).
const LEGACY_ROOT_CHANNEL_FIELDS = ['website_url', 'welcome_title', 'welcome_tagline'];

// Inbox-level attributes accepted by the Create operation's Additional Fields
// ('avatar_url' is not accepted by Chatwoot and is never sent).
const CREATE_INBOX_ATTRIBUTES = [
  'allow_messages_after_resolved',
  'business_name',
  'csat_survey_enabled',
  'enable_auto_assignment',
  'enable_email_collect',
  'greeting_enabled',
  'greeting_message',
  'lock_to_single_conversation',
  'out_of_office_message',
  'portal_id',
  'sender_name_type',
  'timezone',
  'working_hours_enabled',
];

/** Required channel fields of the Create operation, already read from the node parameters. */
export interface InboxChannelInput {
  type: string;
  websiteUrl?: string;
  email?: string;
  phoneNumber?: string;
  whatsappProvider?: string;
  apiKey?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  bandwidthAccountId?: string;
  bandwidthApplicationId?: string;
  bandwidthApiKey?: string;
  bandwidthApiSecret?: string;
  botToken?: string;
  lineChannelId?: string;
  lineChannelSecret?: string;
  lineChannelToken?: string;
}

/**
 * Read the required channel fields of the Create operation for the selected channel type.
 * Blank values (e.g. an expression that resolved to '') throw before any request: Chatwoot does not
 * reject all of them (an Email inbox with an empty address or an SMS inbox without Bandwidth
 * credentials would be created unusable).
 */
export function readInboxChannelInput(
  ctx: IExecuteFunctions,
  itemIndex: number,
  type: string,
): InboxChannelInput {
  const param = (name: string) => String(ctx.getNodeParameter(name, itemIndex, '') ?? '').trim();
  const required = (name: string, label: string) => {
    const value = param(name);
    if (value === '') throw new Error(`${label} is required to create a ${type} inbox`);
    return value;
  };
  const input: InboxChannelInput = { type };
  switch (type) {
    case 'web_widget':
      input.websiteUrl = required('websiteUrl', 'Website URL');
      break;
    case 'email':
      input.email = required('email', 'Email');
      break;
    case 'whatsapp':
      input.phoneNumber = required('phoneNumber', 'Phone Number');
      input.whatsappProvider = param('whatsappProvider') || 'whatsapp_cloud';
      input.apiKey = required('apiKey', 'API Key');
      if (input.whatsappProvider === 'whatsapp_cloud') {
        input.phoneNumberId = required('phoneNumberId', 'Phone Number ID');
        input.businessAccountId = required('businessAccountId', 'Business Account ID');
      }
      break;
    case 'sms':
      input.phoneNumber = required('phoneNumber', 'Phone Number');
      input.bandwidthAccountId = required('bandwidthAccountId', 'Bandwidth Account ID');
      input.bandwidthApplicationId = required('bandwidthApplicationId', 'Bandwidth Application ID');
      input.bandwidthApiKey = required('bandwidthApiKey', 'Bandwidth API Key');
      input.bandwidthApiSecret = required('bandwidthApiSecret', 'Bandwidth API Secret');
      break;
    case 'telegram':
      input.botToken = required('botToken', 'Bot Token');
      break;
    case 'line':
      input.lineChannelId = required('lineChannelId', 'LINE Channel ID');
      input.lineChannelSecret = required('lineChannelSecret', 'LINE Channel Secret');
      input.lineChannelToken = required('lineChannelToken', 'LINE Channel Token');
      break;
    case 'api':
      break;
    default:
      throw new Error(
        `Unsupported channel type "${type}". Use api, email, line, sms, telegram, web_widget or whatsapp.`,
      );
  }
  return input;
}

/**
 * Build the POST /inboxes body: inbox attributes at the root and the channel attributes nested
 * under `channel` with its `type` (InboxesController#create reads them only from there).
 */
export function buildInboxCreateBody(
  name: string,
  input: InboxChannelInput,
  channelSettings: IDataObject,
  additionalFields: IDataObject,
): IDataObject {
  const body: IDataObject = { name };
  for (const key of CREATE_INBOX_ATTRIBUTES) {
    const value = additionalFields[key];
    if (value === undefined || value === null || value === '') continue;
    // 0 means "no help center" (the default of the number field)
    if (key === 'portal_id' && !value) continue;
    body[key] = value;
  }

  const channel: IDataObject = { type: input.type };
  switch (input.type) {
    case 'web_widget':
      channel.website_url = input.websiteUrl;
      break;
    case 'email':
      channel.email = input.email;
      break;
    case 'whatsapp': {
      const provider = input.whatsappProvider || 'whatsapp_cloud';
      channel.phone_number = input.phoneNumber;
      channel.provider = provider;
      channel.provider_config =
        provider === 'whatsapp_cloud'
          ? {
              api_key: input.apiKey,
              phone_number_id: input.phoneNumberId,
              business_account_id: input.businessAccountId,
            }
          : { api_key: input.apiKey };
      break;
    }
    case 'sms':
      channel.phone_number = input.phoneNumber;
      channel.provider_config = {
        account_id: input.bandwidthAccountId,
        application_id: input.bandwidthApplicationId,
        api_key: input.bandwidthApiKey,
        api_secret: input.bandwidthApiSecret,
      };
      break;
    case 'telegram':
      channel.bot_token = input.botToken;
      break;
    case 'line':
      channel.line_channel_id = input.lineChannelId;
      channel.line_channel_secret = input.lineChannelSecret;
      channel.line_channel_token = input.lineChannelToken;
      break;
    default:
      // api: every setting is optional
      break;
  }
  Object.assign(channel, buildChannelAttributes(channelSettings, true));
  body.channel = channel;
  return body;
}

/**
 * Build the PATCH /inboxes/:id body. Inbox attributes stay at the root, channel attributes are
 * nested under `channel` WITHOUT `type` (Chatwoot would try to assign it to the channel record),
 * `working_hours` is a root array and JSON fields are parsed.
 */
export function buildInboxUpdateBody(
  updateFields: IDataObject,
  channelSettings: IDataObject,
): IDataObject {
  const body: IDataObject = {};
  const channel = buildChannelAttributes(channelSettings, false);

  for (const [key, value] of Object.entries(updateFields)) {
    if (value === undefined || value === null) continue;
    if (LEGACY_ROOT_CHANNEL_FIELDS.includes(key)) {
      // A widget cannot have a blank website URL (422): an empty value keeps the current one, as
      // it did before v0.9.0 when these fields were ignored
      if (key === 'website_url' && value === '') continue;
      channel[key] = value;
    } else if (key === 'csat_config') {
      if (value !== '') body.csat_config = parseJsonSafe(value, 'csat_config');
    } else if (key === 'working_hours') {
      if (value === '') continue;
      const workingHours = parseJsonSafe(value, 'working_hours');
      if (!Array.isArray(workingHours)) {
        throw new Error(
          'working_hours must be a JSON array of days, e.g. [{"day_of_week": 1, "open_hour": 9, "open_minutes": 0, "close_hour": 17, "close_minutes": 0}]',
        );
      }
      body.working_hours = workingHours;
    } else if (key === 'branded_email_layout') {
      // An empty layout clears the inbox layout (Chatwoot treats null as "remove")
      body.branded_email_layout = value === '' ? null : value;
    } else if (key === 'portal_id') {
      // 0 detaches the help center portal
      body.portal_id = value ? value : null;
    } else {
      body[key] = value;
    }
  }

  if (Object.keys(channel).length > 0) body.channel = channel;
  return body;
}
