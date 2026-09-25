import type { IDataObject } from 'n8n-workflow';

import { parseJsonSafe } from '../../GenericFunctions';
import { parseStringList, toUnixSeconds } from '../conversation/helpers';

/** Chatwoot's Message::NUMBER_OF_PERMITTED_ATTACHMENTS. */
export const MAX_MESSAGE_ATTACHMENTS = 15;

/** Parsed Message > Create options, shared by the JSON and the multipart request. */
export interface MessageCreateParts {
  /** Scalar Chatwoot params (message_type, content_type, source_id, sender_type...). */
  fields: IDataObject;
  /** content_attributes object, when set and not empty. */
  contentAttributes?: IDataObject;
  /** template_params object, when set and not empty. */
  templateParams?: IDataObject;
  /** Binary property names to upload as attachments[]. */
  binaryPropertyNames: string[];
}

function parseJsonObject(value: unknown, fieldName: string): IDataObject | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseJsonSafe(value, fieldName);
  if (parsed === null || parsed === undefined) return undefined;
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`"${fieldName}" must be a JSON object`);
  }
  return Object.keys(parsed as IDataObject).length > 0 ? (parsed as IDataObject) : undefined;
}

/**
 * Map the Message > Create options collection to MessageBuilder params (cw-4.18.0
 * app/builders/messages/message_builder.rb). `private` is only set when true: in multipart requests
 * Rails would receive the string "false", which MessageBuilder treats as truthy for email content.
 */
export function buildMessageCreateParts(options: IDataObject): MessageCreateParts {
  const fields: IDataObject = {};
  if (options.message_type) fields.message_type = options.message_type;
  if (options.private === true) fields.private = true;
  if (options.content_type) fields.content_type = options.content_type;
  if (options.source_id) fields.source_id = String(options.source_id).trim();
  if (options.echo_id) fields.echo_id = String(options.echo_id).trim();
  if (options.campaign_id) fields.campaign_id = options.campaign_id;
  if (options.sender_agent_bot_id) {
    fields.sender_type = 'AgentBot';
    fields.sender_id = options.sender_agent_bot_id;
  }
  const externalCreatedAt = toUnixSeconds(options.external_created_at, 'External Created At');
  if (externalCreatedAt !== undefined) fields.external_created_at = externalCreatedAt;
  for (const key of ['cc_emails', 'bcc_emails', 'to_emails']) {
    const emails = parseStringList(options[key]);
    if (emails.length > 0) fields[key] = emails.join(',');
  }
  if (options.email_html_content) fields.email_html_content = options.email_html_content;
  if (options.is_voice_message === true) fields.is_voice_message = true;

  const binaryPropertyNames = parseStringList(options.binaryPropertyNames);

  return {
    fields,
    contentAttributes: parseJsonObject(options.content_attributes, 'Content Attributes'),
    templateParams: parseJsonObject(options.template_params, 'Template Params'),
    binaryPropertyNames,
  };
}
