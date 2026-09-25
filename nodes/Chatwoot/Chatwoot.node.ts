import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
  chatwootRequest,
  chatwootApiRequest,
  chatwootApiV2Request,
  chatwootApiRequestAllItems,
  chatwootApiRequestAllMessages,
  chatwootMultipartRequest,
  chatwootPlatformApiRequest,
  chatwootPublicApiRequest,
  getHttpStatus,
  extractItems,
  validateId,
  parseJsonSafe,
  getAgents,
  getTeams,
  getInboxes,
  getLabels,
  getAgentBots,
  getPortals,
  getCategories,
  getIntegrations,
} from './GenericFunctions';

// Application API Resource imports
import { accountOperations, accountFields } from './resources/account';
import { agentOperations, agentFields } from './resources/agent';
import { agentBotOperations, agentBotFields } from './resources/agentBot';
import { automationRuleOperations, automationRuleFields } from './resources/automationRule';
import { teamOperations, teamFields } from './resources/team';
import { inboxOperations, inboxFields } from './resources/inbox';
import { labelOperations, labelFields } from './resources/label';
import { cannedResponseOperations, cannedResponseFields } from './resources/cannedResponse';
import { customAttributeOperations, customAttributeFields } from './resources/customAttribute';
import { customFilterOperations, customFilterFields } from './resources/customFilter';
import { webhookOperations, webhookFields } from './resources/webhook';
import { conversationOperations, conversationFields } from './resources/conversation';
import { messageOperations, messageFields } from './resources/message';
import { contactOperations, contactFields } from './resources/contact';
import { reportOperations, reportFields, REPORT_CSV_DOWNLOADS } from './resources/report';
import { profileOperations, profileFields } from './resources/profile';
import { helpCenterOperations, helpCenterFields } from './resources/helpCenter';
import { integrationOperations, integrationFields } from './resources/integration';
import { auditLogOperations, auditLogFields } from './resources/auditLog';
import { csatSurveyOperations, csatSurveyFields } from './resources/csatSurvey';
import { macroOperations, macroFields } from './resources/macro';
import { notificationOperations, notificationFields } from './resources/notification';
import { campaignOperations, campaignFields, getCampaignInboxes } from './resources/campaign';
import { contactNoteOperations, contactNoteFields } from './resources/contactNote';
import { conversationParticipantOperations, conversationParticipantFields } from './resources/conversationParticipant';
import { companyOperations, companyFields } from './resources/company';
import { searchOperations as globalSearchOperations, searchFields as globalSearchFields } from './resources/search';
import { slaPolicyOperations, slaPolicyFields } from './resources/slaPolicy';
import { appliedSlaOperations, appliedSlaFields } from './resources/appliedSla';
import { liveReportOperations, liveReportFields } from './resources/liveReport';
import { summaryReportOperations, summaryReportFields } from './resources/summaryReport';

// Resource-specific execute helpers
import {
  addLegacyConditionHint,
  renameLegacyConditionKeys,
  resolveExecutionDelay,
} from './resources/automationRule/helpers';
import { buildCampaignBody, needsCurrentTriggerRules } from './resources/campaign/helpers';
import { toUnixSeconds } from './resources/notification/helpers';

// Platform API Resource imports
import { platformAccountOperations, platformAccountFields } from './resources/platformAccount';
import { platformUserOperations, platformUserFields } from './resources/platformUser';
import { accountUserOperations, accountUserFields } from './resources/accountUser';
import { accountAgentBotOperations, accountAgentBotFields } from './resources/accountAgentBot';

// Public API Resource imports
import { publicContactOperations, publicContactFields } from './resources/publicContact';
import { publicConversationOperations, publicConversationFields } from './resources/publicConversation';
import { publicMessageOperations, publicMessageFields } from './resources/publicMessage';
import { publicInboxOperations, publicInboxFields } from './resources/publicInbox';
import {
  applyIdentifierHash,
  contactIdentifierPath,
  IDENTITY_VALIDATION_HINT,
} from './resources/publicContact/identity';

// Reporting / insight helpers (report, csatSurvey, appliedSla, auditLog, company, helpCenter)
import {
  buildCsvOutput,
  parseIdList,
  parseJsonObject,
  parseStringList,
  portalConfigFromResponse,
  requestFilteredPages,
  toUnixSeconds,
} from './resources/report/helpers';

// Execute helpers
import {
  buildInboxCreateBody,
  buildInboxUpdateBody,
  parseUserIds,
  readInboxChannelInput,
} from './resources/inbox/helpers';
import { buildAccountUpdateBody } from './resources/account/helpers';
import { buildAgentBody } from './resources/agent/helpers';

export class Chatwoot implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Chatwoot',
    name: 'chatwoot',
    icon: 'file:chatwoot.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with Chatwoot API to manage conversations, messages, contacts, and more',
    defaults: {
      name: 'Chatwoot',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [
      {
        name: 'chatwootApi',
        required: true,
        displayOptions: {
          show: {
            resource: [
              'account',
              'agent',
              'agentBot',
              'automationRule',
              'cannedResponse',
              'contact',
              'conversation',
              'customAttribute',
              'customFilter',
              'inbox',
              'label',
              'message',
              'report',
              'team',
              'webhook',
              'profile',
              'helpCenter',
              'integration',
              'auditLog',
              'csatSurvey',
              'macro',
              'notification',
              'campaign',
              'contactNote',
              'conversationParticipant',
              'company',
              'search',
              'slaPolicy',
              'appliedSla',
              'liveReport',
              'summaryReport',
            ],
          },
        },
      },
      {
        name: 'chatwootPlatformApi',
        required: true,
        displayOptions: {
          show: {
            resource: ['platformAccount', 'platformUser', 'accountUser', 'accountAgentBot'],
          },
        },
      },
      {
        name: 'chatwootPublicApi',
        required: true,
        displayOptions: {
          show: {
            resource: ['publicContact', 'publicConversation', 'publicInbox', 'publicMessage'],
          },
        },
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          // Application API Resources
          { name: 'Account', value: 'account' },
          { name: 'Agent', value: 'agent' },
          { name: 'Agent Bot', value: 'agentBot' },
          { name: 'Applied SLA (Enterprise)', value: 'appliedSla' },
          { name: 'Audit Log', value: 'auditLog' },
          { name: 'Automation Rule', value: 'automationRule' },
          { name: 'Campaign', value: 'campaign' },
          { name: 'Canned Response', value: 'cannedResponse' },
          { name: 'Company (Enterprise)', value: 'company' },
          { name: 'Contact', value: 'contact' },
          { name: 'Contact Note', value: 'contactNote' },
          { name: 'Conversation', value: 'conversation' },
          { name: 'Conversation Participant', value: 'conversationParticipant' },
          { name: 'CSAT Survey', value: 'csatSurvey' },
          { name: 'Custom Attribute', value: 'customAttribute' },
          { name: 'Custom Filter', value: 'customFilter' },
          { name: 'Help Center', value: 'helpCenter' },
          { name: 'Inbox', value: 'inbox' },
          { name: 'Integration', value: 'integration' },
          { name: 'Label', value: 'label' },
          { name: 'Live Report', value: 'liveReport' },
          { name: 'Macro', value: 'macro' },
          { name: 'Message', value: 'message' },
          { name: 'Notification', value: 'notification' },
          { name: 'Profile', value: 'profile' },
          { name: 'Report', value: 'report' },
          { name: 'Search', value: 'search' },
          { name: 'SLA Policy (Enterprise)', value: 'slaPolicy' },
          { name: 'Summary Report', value: 'summaryReport' },
          { name: 'Team', value: 'team' },
          { name: 'Webhook', value: 'webhook' },
          // Platform API Resources
          { name: '[Platform] Account', value: 'platformAccount' },
          { name: '[Platform] Account Agent Bot', value: 'accountAgentBot' },
          { name: '[Platform] Account User', value: 'accountUser' },
          { name: '[Platform] User', value: 'platformUser' },
          // Public API Resources
          { name: '[Public] Contact', value: 'publicContact' },
          { name: '[Public] Conversation', value: 'publicConversation' },
          { name: '[Public] Inbox', value: 'publicInbox' },
          { name: '[Public] Message', value: 'publicMessage' },
        ],
        default: 'conversation',
      },
      // Application API Operations
      accountOperations,
      agentOperations,
      agentBotOperations,
      automationRuleOperations,
      teamOperations,
      inboxOperations,
      labelOperations,
      cannedResponseOperations,
      customAttributeOperations,
      customFilterOperations,
      webhookOperations,
      conversationOperations,
      messageOperations,
      contactOperations,
      reportOperations,
      profileOperations,
      helpCenterOperations,
      integrationOperations,
      auditLogOperations,
      csatSurveyOperations,
      macroOperations,
      notificationOperations,
      campaignOperations,
      contactNoteOperations,
      conversationParticipantOperations,
      companyOperations,
      globalSearchOperations,
      slaPolicyOperations,
      appliedSlaOperations,
      liveReportOperations,
      summaryReportOperations,
      // Platform API Operations
      platformAccountOperations,
      platformUserOperations,
      accountUserOperations,
      accountAgentBotOperations,
      // Public API Operations
      publicContactOperations,
      publicConversationOperations,
      publicMessageOperations,
      publicInboxOperations,
      // Application API Fields
      ...accountFields,
      ...agentFields,
      ...agentBotFields,
      ...automationRuleFields,
      ...teamFields,
      ...inboxFields,
      ...labelFields,
      ...cannedResponseFields,
      ...customAttributeFields,
      ...customFilterFields,
      ...webhookFields,
      ...conversationFields,
      ...messageFields,
      ...contactFields,
      ...reportFields,
      ...profileFields,
      ...helpCenterFields,
      ...integrationFields,
      ...auditLogFields,
      ...csatSurveyFields,
      ...macroFields,
      ...notificationFields,
      ...campaignFields,
      ...contactNoteFields,
      ...conversationParticipantFields,
      ...companyFields,
      ...globalSearchFields,
      ...slaPolicyFields,
      ...appliedSlaFields,
      ...liveReportFields,
      ...summaryReportFields,
      // Platform API Fields
      ...platformAccountFields,
      ...platformUserFields,
      ...accountUserFields,
      ...accountAgentBotFields,
      // Public API Fields
      ...publicContactFields,
      ...publicConversationFields,
      ...publicMessageFields,
      ...publicInboxFields,
    ],
  };

  methods = {
    loadOptions: {
      getAgents,
      getTeams,
      getInboxes,
      getLabels,
      getAgentBots,
      getPortals,
      getCategories,
      getIntegrations,
      getCampaignInboxes,
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData: IDataObject | IDataObject[];

        // =====================================================================
        // ACCOUNT
        // =====================================================================
        if (resource === 'account') {
          if (operation === 'get') {
            responseData = await chatwootApiRequest.call(this, 'GET', '', {}, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const body = buildAccountUpdateBody(updateFields);

            responseData = await chatwootApiRequest.call(this, 'PATCH', '', body, {}, { itemIndex: i });
          } else if (operation === 'getBrandedEmailLayout') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/branded_email_layout', {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'updateBrandedEmailLayout') {
            const layout = this.getNodeParameter('brandedEmailLayout', i, '') as string;
            // Chatwoot removes the account layout when branded_email_layout is null
            const body: IDataObject = { branded_email_layout: layout.trim() === '' ? null : layout };
            responseData = await chatwootApiRequest.call(this, 'PATCH', '/branded_email_layout', body, {}, {
              itemIndex: i,
            });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AGENT
        // =====================================================================
        else if (resource === 'agent') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/agents', {}, {}, { itemIndex: i });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const email = this.getNodeParameter('email', i) as string;
            const role = this.getNodeParameter('role', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name, email, role, ...buildAgentBody(additionalFields, 'create') };

            // Agent creation is throttled per day (rack-attack): retrying within seconds cannot help
            responseData = await chatwootApiRequest.call(this, 'POST', '/agents', body, {}, {
              itemIndex: i,
              retry: false,
            });
          } else if (operation === 'update') {
            const agentId = validateId(this.getNodeParameter('agentId', i), 'Agent ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body = buildAgentBody(updateFields, 'update');
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/agents/${agentId}`, body, {}, {
              itemIndex: i,
            });
          } else if (operation === 'delete') {
            const agentId = validateId(this.getNodeParameter('agentId', i), 'Agent ID');
            // Agent deletion is throttled per day (rack-attack): retrying within seconds cannot help
            await chatwootApiRequest.call(this, 'DELETE', `/agents/${agentId}`, {}, {}, {
              itemIndex: i,
              retry: false,
            });
            responseData = { success: true, id: agentId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // TEAM
        // =====================================================================
        else if (resource === 'team') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/teams', {}, {}, { itemIndex: i });
          } else if (operation === 'get') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/teams/${teamId}`, {}, {}, { itemIndex: i });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.allow_auto_assign !== undefined) {
              body.allow_auto_assign = additionalFields.allow_auto_assign;
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/teams', body, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.description) body.description = updateFields.description;
            if (updateFields.allow_auto_assign !== undefined) body.allow_auto_assign = updateFields.allow_auto_assign;

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/teams/${teamId}`, body, {}, {
              itemIndex: i,
            });
          } else if (operation === 'delete') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            await chatwootApiRequest.call(this, 'DELETE', `/teams/${teamId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: teamId };
          } else if (operation === 'addAgent') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const userIds = parseUserIds(this.getNodeParameter('userIds', i));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'POST', `/teams/${teamId}/team_members`, body, {}, {
              itemIndex: i,
            });
          } else if (operation === 'deleteAgent') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const userIds = parseUserIds(this.getNodeParameter('userIds', i));

            const body: IDataObject = { user_ids: userIds };
            // Chatwoot answers `head :ok`, so report what was removed
            await chatwootApiRequest.call(this, 'DELETE', `/teams/${teamId}/team_members`, body, {}, {
              itemIndex: i,
            });
            responseData = { success: true, teamId, userIds };
          } else if (operation === 'getMembers') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/teams/${teamId}/team_members`, {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'updateAgents') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const userIds = parseUserIds(this.getNodeParameter('userIds', i));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/teams/${teamId}/team_members`, body, {}, {
              itemIndex: i,
            });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // INBOX
        // =====================================================================
        else if (resource === 'inbox') {
          if (operation === 'getAll') {
            const response = await chatwootApiRequest.call(this, 'GET', '/inboxes', {}, {}, { itemIndex: i });
            responseData = ((response as IDataObject).payload || response) as IDataObject[];
          } else if (operation === 'get') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/inboxes/${inboxId}`, {}, {}, { itemIndex: i });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const channelType = this.getNodeParameter('channelType', i) as string;
            const channelInput = readInboxChannelInput(this, i, channelType);
            const channelSettings = ['api', 'email', 'web_widget'].includes(channelType)
              ? (this.getNodeParameter('channelSettings', i, {}) as IDataObject)
              : {};
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body = buildInboxCreateBody(name, channelInput, channelSettings, additionalFields);
            responseData = await chatwootApiRequest.call(this, 'POST', '/inboxes', body, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const channelSettings = this.getNodeParameter('channelSettings', i, {}) as IDataObject;

            const body = buildInboxUpdateBody(updateFields, channelSettings);
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/inboxes/${inboxId}`, body, {}, {
              itemIndex: i,
            });
          } else if (operation === 'delete') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            // Chatwoot queues the deletion and answers { message }
            const response = (await chatwootApiRequest.call(this, 'DELETE', `/inboxes/${inboxId}`, {}, {}, {
              itemIndex: i,
            })) as IDataObject;
            responseData = { success: true, id: inboxId, ...(response.message ? { message: response.message } : {}) };
          } else if (operation === 'addAgent' || operation === 'updateAgents') {
            // Collection routes: POST (add) / PATCH (replace) /inbox_members with { inbox_id, user_ids }
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const userIds = parseUserIds(this.getNodeParameter('userIds', i));

            const body: IDataObject = { inbox_id: inboxId, user_ids: userIds };
            const response = await chatwootApiRequest.call(
              this,
              operation === 'addAgent' ? 'POST' : 'PATCH',
              '/inbox_members',
              body,
              {},
              { itemIndex: i },
            );
            responseData = extractItems(response, 'payload');
          } else if (operation === 'deleteAgent') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const userIds = parseUserIds(this.getNodeParameter('userIds', i));

            const body: IDataObject = { inbox_id: inboxId, user_ids: userIds };
            // Chatwoot answers `head :ok`, so report what was removed
            await chatwootApiRequest.call(this, 'DELETE', '/inbox_members', body, {}, { itemIndex: i });
            responseData = { success: true, inboxId, userIds };
          } else if (operation === 'getMembers') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const response = await chatwootApiRequest.call(this, 'GET', `/inbox_members/${inboxId}`, {}, {}, {
              itemIndex: i,
            });
            responseData = extractItems(response, 'payload');
          } else if (operation === 'getAgentBot') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/inboxes/${inboxId}/agent_bot`, {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'setAgentBot') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const agentBotId = this.getNodeParameter('agentBotId', i) as number;

            const body: IDataObject = { agent_bot: agentBotId || null };
            // Chatwoot answers `head :ok`, so report the new assignment
            await chatwootApiRequest.call(this, 'POST', `/inboxes/${inboxId}/set_agent_bot`, body, {}, {
              itemIndex: i,
            });
            responseData = { success: true, inboxId, agentBotId: agentBotId || null };
          } else if (operation === 'resetSecret') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(this, 'POST', `/inboxes/${inboxId}/reset_secret`, {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'rotateHmacToken') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(
              this,
              'POST',
              `/inboxes/${inboxId}/rotate_hmac_token`,
              {},
              {},
              { itemIndex: i },
            );
          } else if (operation === 'getMessageTemplates') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const templateName = (this.getNodeParameter('templateName', i, '') as string).trim();

            const qs: IDataObject = {};
            if (templateName) qs.name = templateName;
            const response = await chatwootApiRequest.call(
              this,
              'GET',
              `/inboxes/${inboxId}/message_templates`,
              {},
              qs,
              { itemIndex: i },
            );
            responseData = extractItems(response, 'payload');
          } else if (operation === 'syncTemplates') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const response = (await chatwootApiRequest.call(
              this,
              'POST',
              `/inboxes/${inboxId}/sync_templates`,
              {},
              {},
              { itemIndex: i },
            )) as IDataObject;
            responseData = { success: true, inboxId, ...(response.message ? { message: response.message } : {}) };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // LABEL
        // =====================================================================
        else if (resource === 'label') {
          if (operation === 'getAll') {
            const response = await chatwootApiRequest.call(this, 'GET', '/labels');
            responseData = ((response as IDataObject).payload || response) as IDataObject[];
          } else if (operation === 'create') {
            const title = this.getNodeParameter('title', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { title };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.color) body.color = additionalFields.color;
            if (additionalFields.show_on_sidebar !== undefined) {
              body.show_on_sidebar = additionalFields.show_on_sidebar;
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/labels', body);
          } else if (operation === 'update') {
            const labelId = validateId(this.getNodeParameter('labelId', i), 'Label ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = { ...updateFields };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/labels/${labelId}`, body);
          } else if (operation === 'delete') {
            const labelId = validateId(this.getNodeParameter('labelId', i), 'Label ID');
            await chatwootApiRequest.call(this, 'DELETE', `/labels/${labelId}`);
            responseData = { success: true, id: labelId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CANNED RESPONSE
        // =====================================================================
        else if (resource === 'cannedResponse') {
          const requestOptions = { itemIndex: i };
          // Chatwoot requires params[:canned_response]; top-level short_code/content are wrapped by
          // Rails wrap_parameters (same as the dashboard). Responses are plain objects / a plain array.
          if (operation === 'getAll') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.search) qs.search = options.search;

            responseData = await chatwootApiRequest.call(this, 'GET', '/canned_responses', {}, qs, requestOptions);
          } else if (operation === 'create') {
            const shortCode = this.getNodeParameter('shortCode', i) as string;
            const content = this.getNodeParameter('content', i) as string;

            const body: IDataObject = { short_code: shortCode, content };
            responseData = await chatwootApiRequest.call(this, 'POST', '/canned_responses', body, {}, requestOptions);
          } else if (operation === 'update') {
            const cannedResponseId = validateId(this.getNodeParameter('cannedResponseId', i), 'Canned Response ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            // An empty body would fail with 422 "param is missing or the value is empty: canned_response"
            const body: IDataObject = {};
            if (updateFields.short_code) body.short_code = updateFields.short_code;
            if (updateFields.content) body.content = updateFields.content;
            if (Object.keys(body).length === 0) {
              throw new NodeOperationError(this.getNode(), 'Add Short Code and/or Content to update', { itemIndex: i });
            }
            responseData = await chatwootApiRequest.call(
              this,
              'PATCH',
              `/canned_responses/${cannedResponseId}`,
              body,
              {},
              requestOptions,
            );
          } else if (operation === 'delete') {
            const cannedResponseId = validateId(this.getNodeParameter('cannedResponseId', i), 'Canned Response ID');
            await chatwootApiRequest.call(this, 'DELETE', `/canned_responses/${cannedResponseId}`, {}, {}, requestOptions);
            responseData = { success: true, id: cannedResponseId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CUSTOM ATTRIBUTE
        // =====================================================================
        else if (resource === 'customAttribute') {
          if (operation === 'getAll') {
            const attributeModel = this.getNodeParameter('attributeModel', i) as string;
            const qs: IDataObject = { attribute_model: attributeModel };
            responseData = await chatwootApiRequest.call(this, 'GET', '/custom_attribute_definitions', {}, qs);
          } else if (operation === 'get') {
            const customAttributeId = validateId(this.getNodeParameter('customAttributeId', i), 'Custom Attribute ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/custom_attribute_definitions/${customAttributeId}`);
          } else if (operation === 'create') {
            const attributeDisplayName = this.getNodeParameter('attributeDisplayName', i) as string;
            const attributeKey = this.getNodeParameter('attributeKey', i) as string;
            const attributeModel = this.getNodeParameter('attributeModel', i) as string;
            const attributeDisplayType = this.getNodeParameter('attributeDisplayType', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = {
              attribute_display_name: attributeDisplayName,
              attribute_key: attributeKey,
              attribute_model: attributeModel,
              attribute_display_type: attributeDisplayType,
            };

            if (additionalFields.attribute_description) {
              body.attribute_description = additionalFields.attribute_description;
            }
            if (additionalFields.default_value) body.default_value = additionalFields.default_value;
            if (additionalFields.attribute_values) {
              body.attribute_values = (additionalFields.attribute_values as string).split(',').map((v) => v.trim());
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/custom_attribute_definitions', body);
          } else if (operation === 'update') {
            const customAttributeId = validateId(this.getNodeParameter('customAttributeId', i), 'Custom Attribute ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.attribute_display_name) body.attribute_display_name = updateFields.attribute_display_name;
            if (updateFields.attribute_description) body.attribute_description = updateFields.attribute_description;
            if (updateFields.default_value) body.default_value = updateFields.default_value;
            if (updateFields.attribute_values) {
              body.attribute_values = (updateFields.attribute_values as string).split(',').map((v) => v.trim());
            }

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/custom_attribute_definitions/${customAttributeId}`, body);
          } else if (operation === 'delete') {
            const customAttributeId = validateId(this.getNodeParameter('customAttributeId', i), 'Custom Attribute ID');
            await chatwootApiRequest.call(this, 'DELETE', `/custom_attribute_definitions/${customAttributeId}`);
            responseData = { success: true, id: customAttributeId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // WEBHOOK
        // =====================================================================
        else if (resource === 'webhook') {
          // Chatwoot wraps webhooks as { payload: { webhooks: [...] } } / { payload: { webhook: {...} } }
          const unwrapWebhook = (response: IDataObject | IDataObject[]): IDataObject =>
            (((response as IDataObject).payload as IDataObject | undefined)?.webhook as IDataObject) ??
            (response as IDataObject);
          const webhookBody = (fields: IDataObject): IDataObject => {
            const body: IDataObject = {};
            if (fields.url !== undefined) body.url = fields.url;
            if (fields.subscriptions !== undefined) body.subscriptions = fields.subscriptions;
            if (fields.name !== undefined) body.name = fields.name;
            // '' (no inbox selected) removes the inbox association
            if (fields.inbox_id !== undefined) body.inbox_id = fields.inbox_id === '' ? null : fields.inbox_id;
            return body;
          };

          if (operation === 'getAll') {
            const response = await chatwootApiRequest.call(this, 'GET', '/webhooks', {}, {}, { itemIndex: i });
            responseData = extractItems(response, 'payload.webhooks');
          } else if (operation === 'create') {
            const url = this.getNodeParameter('url', i) as string;
            const subscriptions = this.getNodeParameter('subscriptions', i) as string[];
            const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

            const body = webhookBody({ ...additionalFields, url, subscriptions });
            const response = await chatwootApiRequest.call(this, 'POST', '/webhooks', body, {}, { itemIndex: i });
            responseData = unwrapWebhook(response);
          } else if (operation === 'update') {
            const webhookId = validateId(this.getNodeParameter('webhookId', i), 'Webhook ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body = webhookBody(updateFields);
            const response = await chatwootApiRequest.call(this, 'PATCH', `/webhooks/${webhookId}`, body, {}, {
              itemIndex: i,
            });
            responseData = unwrapWebhook(response);
          } else if (operation === 'delete') {
            const webhookId = validateId(this.getNodeParameter('webhookId', i), 'Webhook ID');
            await chatwootApiRequest.call(this, 'DELETE', `/webhooks/${webhookId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: webhookId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CONVERSATION
        // =====================================================================
        else if (resource === 'conversation') {
          if (operation === 'get') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/conversations/${conversationId}`);
          } else if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const filters = this.getNodeParameter('filters', i) as IDataObject;

            const qs: IDataObject = {};
            if (filters.status && filters.status !== 'all') qs.status = filters.status;
            if (filters.assignee_type && filters.assignee_type !== 'all') qs.assignee_type = filters.assignee_type;
            if (filters.inbox_id) qs.inbox_id = filters.inbox_id;
            if (filters.team_id) qs.team_id = filters.team_id;
            if (filters.labels) qs.labels = (filters.labels as string).split(',').map((l) => l.trim());
            if (filters.q) qs.q = filters.q;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/conversations', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/conversations', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'updateStatus') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const status = this.getNodeParameter('status', i) as string;

            const body: IDataObject = { status };
            if (status === 'snoozed') {
              const snoozedUntil = this.getNodeParameter('snoozed_until', i, '') as string;
              if (snoozedUntil) {
                body.snoozed_until = Math.floor(new Date(snoozedUntil).getTime() / 1000);
              }
            }

            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/toggle_status`, body);
          } else if (operation === 'assign') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const assignmentType = this.getNodeParameter('assignmentType', i) as string;

            const body: IDataObject = {};
            if (assignmentType === 'agent') {
              body.assignee_id = validateId(this.getNodeParameter('assigneeId', i), 'Agent ID');
            } else if (assignmentType === 'team') {
              body.team_id = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            } else if (assignmentType === 'unassign') {
              body.assignee_id = null;
            }

            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/assignments`, body);
          } else if (operation === 'addLabels') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const labels = this.getNodeParameter('labels', i) as string[];

            const body: IDataObject = { labels };
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/labels`, body);
          } else if (operation === 'create') {
            const sourceId = this.getNodeParameter('sourceId', i) as string;
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = {
              source_id: sourceId,
              inbox_id: inboxId,
            };
            if (additionalFields.contact_id) body.contact_id = additionalFields.contact_id;
            if (additionalFields.status) body.status = additionalFields.status;
            if (additionalFields.assignee_id) body.assignee_id = additionalFields.assignee_id;
            if (additionalFields.team_id) body.team_id = additionalFields.team_id;
            if (additionalFields.custom_attributes) {
              body.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/conversations', body);
          } else if (operation === 'togglePriority') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const priority = this.getNodeParameter('priority', i) as string;

            const body: IDataObject = { priority };
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/toggle_priority`, body);
          } else if (operation === 'update') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.priority) body.priority = updateFields.priority;
            if (updateFields.assignee_id) body.assignee_id = updateFields.assignee_id;
            if (updateFields.team_id) body.team_id = updateFields.team_id;
            if (updateFields.status) body.status = updateFields.status;

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/conversations/${conversationId}`, body);
          } else if (operation === 'filter') {
            const filterPayload = this.getNodeParameter('filterPayload', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;

            const body: IDataObject = { payload: parseJsonSafe(filterPayload, 'filter payload') };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'POST', '/conversations/filter', body, {}, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              const result = (await chatwootApiRequest.call(this, 'POST', '/conversations/filter', body)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'updateCustomAttributes') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const customAttributes = this.getNodeParameter('customAttributes', i) as string;

            // Chatwoot's PATCH /conversations/:id only permits `:priority` (see
            // ConversationsController#permitted_update_params). Custom attributes
            // must use the dedicated POST /conversations/:id/custom_attributes
            // endpoint with `attribute_key: null` to set all keys at once.
            const body: IDataObject = {
              custom_attributes: parseJsonSafe(customAttributes, 'custom_attributes'),
              attribute_key: null,
            };

            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/custom_attributes`, body);
          } else if (operation === 'listLabels') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/conversations/${conversationId}/labels`);
          } else if (operation === 'getMeta') {
            const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
            const qs: IDataObject = {};

            if (filters.status) qs.status = filters.status;
            if (filters.inbox_id) qs.inbox_id = filters.inbox_id;
            if (filters.assignee_type) qs.assignee_type = filters.assignee_type;

            responseData = await chatwootApiRequest.call(this, 'GET', '/conversations/meta', {}, qs);
          } else if (operation === 'mute') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/mute`);
          } else if (operation === 'unmute') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/unmute`);
          } else if (operation === 'delete') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            await chatwootApiRequest.call(this, 'DELETE', `/conversations/${conversationId}`);
            responseData = { success: true, id: conversationId };
          } else if (operation === 'search') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const qs2: IDataObject = { q: query };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/conversations/search', {}, qs2, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs2.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/conversations/search', {}, qs2)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'transcript') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const email = this.getNodeParameter('email', i) as string;
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/transcript`, { email });
          } else if (operation === 'toggleTyping') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const typingStatus = this.getNodeParameter('typingStatus', i) as string;
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/toggle_typing_status`, {
              typing_status: typingStatus,
            });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // MESSAGE
        // =====================================================================
        else if (resource === 'message') {
          if (operation === 'create') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const content = this.getNodeParameter('content', i) as string;
            const options = this.getNodeParameter('options', i) as IDataObject;

            const body: IDataObject = { content };
            if (options.message_type) body.message_type = options.message_type;
            if (options.private !== undefined) body.private = options.private;
            if (options.content_type) body.content_type = options.content_type;
            if (options.content_attributes) {
              try {
                body.content_attributes = typeof options.content_attributes === 'string'
                  ? JSON.parse(options.content_attributes as string)
                  : options.content_attributes;
              } catch {
                body.content_attributes = options.content_attributes;
              }
            }
            if (options.template_params) {
              const tp = parseJsonSafe(options.template_params, 'template_params');
              // Only include if it's a non-empty object
              if (tp && typeof tp === 'object' && Object.keys(tp).length > 0) {
                body.template_params = tp;
              }
            }

            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/messages`, body);
          } else if (operation === 'getAll') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;

            if (returnAll) {
              responseData = await chatwootApiRequestAllMessages.call(this, conversationId);
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              responseData = await chatwootApiRequestAllMessages.call(this, conversationId, limit);
            }
          } else if (operation === 'delete') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const messageId = validateId(this.getNodeParameter('messageId', i), 'Message ID');
            await chatwootApiRequest.call(this, 'DELETE', `/conversations/${conversationId}/messages/${messageId}`);
            responseData = { success: true, id: messageId };
          } else if (operation === 'update') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const messageId = validateId(this.getNodeParameter('messageId', i), 'Message ID');
            const content = this.getNodeParameter('content', i) as string;

            const body: IDataObject = { content };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/conversations/${conversationId}/messages/${messageId}`, body);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CONTACT
        // =====================================================================
        else if (resource === 'contact') {
          if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = {};
            if (name) body.name = name;
            if (additionalFields.inbox_id) body.inbox_id = additionalFields.inbox_id;
            if (additionalFields.email) body.email = additionalFields.email;
            if (additionalFields.phone_number) body.phone_number = additionalFields.phone_number;
            if (additionalFields.identifier) body.identifier = additionalFields.identifier;
            if (additionalFields.custom_attributes) {
              body.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/contacts', body);
          } else if (operation === 'get') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/contacts/${contactId}`);
          } else if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const options = this.getNodeParameter('options', i) as IDataObject;

            const qs: IDataObject = {};
            if (options.sort) qs.sort = options.sort;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/contacts', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/contacts', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'update') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.email) body.email = updateFields.email;
            if (updateFields.phone_number) body.phone_number = updateFields.phone_number;
            if (updateFields.identifier) body.identifier = updateFields.identifier;
            if (updateFields.avatar_url) body.avatar_url = updateFields.avatar_url;
            if (updateFields.blocked !== undefined) body.blocked = updateFields.blocked;
            if (updateFields.custom_attributes) {
              body.custom_attributes = parseJsonSafe(updateFields.custom_attributes, 'custom_attributes');
            }

            responseData = await chatwootApiRequest.call(this, 'PUT', `/contacts/${contactId}`, body);
          } else if (operation === 'delete') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            await chatwootApiRequest.call(this, 'DELETE', `/contacts/${contactId}`);
            responseData = { success: true, id: contactId };
          } else if (operation === 'search') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const options = this.getNodeParameter('options', i) as IDataObject;

            const qs: IDataObject = { q: query };
            if (options.sort) qs.sort = options.sort;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/contacts/search', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/contacts/search', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'getConversations') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            const response = await chatwootApiRequest.call(this, 'GET', `/contacts/${contactId}/conversations`);
            responseData = ((response as IDataObject).payload || response) as IDataObject[];
          } else if (operation === 'merge') {
            const baseContactId = validateId(this.getNodeParameter('baseContactId', i), 'Base Contact ID');
            const mergeeContactId = validateId(this.getNodeParameter('mergeeContactId', i), 'Merge Contact ID');

            const body: IDataObject = {
              base_contact_id: baseContactId,
              mergee_contact_id: mergeeContactId,
            };

            responseData = await chatwootApiRequest.call(this, 'POST', '/actions/contact_merge', body);
          } else if (operation === 'filter') {
            const filterPayload = this.getNodeParameter('filterPayload', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;

            const body: IDataObject = { payload: parseJsonSafe(filterPayload, 'filter payload') };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'POST', '/contacts/filter', body, {}, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              const result = (await chatwootApiRequest.call(this, 'POST', '/contacts/filter', body)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'addLabels') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            const labels = this.getNodeParameter('labels', i) as string[];

            const body: IDataObject = { labels };
            responseData = await chatwootApiRequest.call(this, 'POST', `/contacts/${contactId}/labels`, body);
          } else if (operation === 'listLabels') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/contacts/${contactId}/labels`);
          } else if (operation === 'import') {
            const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
            const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
            const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

            const credentials = await this.getCredentials('chatwootApi');
            const baseUrl = (credentials.baseUrl as string).trim().replace(/\/+$/, '');
            const accountId = credentials.accountId as number;

            responseData = (await this.helpers.httpRequest({
              method: 'POST',
              url: `${baseUrl}/api/v1/accounts/${accountId}/contacts/import`,
              headers: {
                api_access_token: credentials.apiAccessToken as string,
              },
              body: {
                import_file: {
                  value: buffer,
                  options: {
                    filename: binaryData.fileName || 'contacts.csv',
                    contentType: binaryData.mimeType || 'text/csv',
                  },
                },
              },
              json: true,
            })) as IDataObject;
          } else if (operation === 'export') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const body: IDataObject = {};
            if (options.tag) body.tag = options.tag;
            if (options.column_names) {
              body.column_names = (options.column_names as string).split(',').map((c) => c.trim());
            }
            responseData = await chatwootApiRequest.call(this, 'POST', '/contacts/export', body);
          } else if (operation === 'contactableInboxes') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/contacts/${contactId}/contactable_inboxes`);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AGENT BOT
        // =====================================================================
        else if (resource === 'agentBot') {
          const agentBotBody = (fields: IDataObject, clearable: boolean): IDataObject => {
            const body: IDataObject = {};
            for (const key of ['name', 'description', 'outgoing_url', 'avatar_url']) {
              const value = fields[key];
              if (value === undefined || value === null) continue;
              // On update an empty description / outgoing URL clears it (as before v0.9.0);
              // an empty name or avatar URL is never sent
              if (value === '' && !(clearable && (key === 'description' || key === 'outgoing_url'))) {
                continue;
              }
              body[key] = value;
            }
            if (fields.bot_config !== undefined && fields.bot_config !== '') {
              body.bot_config = parseJsonSafe(fields.bot_config, 'bot_config');
            }
            return body;
          };

          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/agent_bots', {}, {}, { itemIndex: i });
          } else if (operation === 'get') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/agent_bots/${agentBotId}`, {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { ...agentBotBody(additionalFields, false), name };
            responseData = await chatwootApiRequest.call(this, 'POST', '/agent_bots', body, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body = agentBotBody(updateFields, true);
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/agent_bots/${agentBotId}`, body, {}, {
              itemIndex: i,
            });
          } else if (operation === 'delete') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            await chatwootApiRequest.call(this, 'DELETE', `/agent_bots/${agentBotId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: agentBotId };
          } else if (operation === 'deleteAvatar') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            responseData = await chatwootApiRequest.call(this, 'DELETE', `/agent_bots/${agentBotId}/avatar`, {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'resetAccessToken' || operation === 'resetSecret') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            const action = operation === 'resetAccessToken' ? 'reset_access_token' : 'reset_secret';
            responseData = await chatwootApiRequest.call(this, 'POST', `/agent_bots/${agentBotId}/${action}`, {}, {}, {
              itemIndex: i,
            });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AUTOMATION RULE
        // =====================================================================
        else if (resource === 'automationRule') {
          const requestOptions = { itemIndex: i };
          // Rewrites the legacy 'company' condition key (Chatwoot 4.14+) and tells the user about it
          const prepareConditions = (raw: unknown): IDataObject[] => {
            const { conditions, renamed } = renameLegacyConditionKeys(parseJsonSafe(raw, 'conditions'));
            if (renamed > 0) addLegacyConditionHint(this);
            return conditions as IDataObject[];
          };

          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/automation_rules', {}, {}, requestOptions);
          } else if (operation === 'get') {
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            responseData = await chatwootApiRequest.call(
              this,
              'GET',
              `/automation_rules/${automationRuleId}`,
              {},
              {},
              requestOptions,
            );
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const eventName = this.getNodeParameter('eventName', i) as string;
            const conditions = prepareConditions(this.getNodeParameter('conditions', i));
            const actions = parseJsonSafe(this.getNodeParameter('actions', i), 'actions');
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = {
              name,
              event_name: eventName,
              conditions,
              actions,
            };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.active !== undefined) body.active = additionalFields.active;
            const executionDelay = resolveExecutionDelay(additionalFields.execution_delay, 'create');
            if (executionDelay !== undefined) body.execution_delay = executionDelay;

            responseData = await chatwootApiRequest.call(this, 'POST', '/automation_rules', body, {}, requestOptions);
          } else if (operation === 'update') {
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.description) body.description = updateFields.description;
            if (updateFields.event_name) body.event_name = updateFields.event_name;
            if (updateFields.active !== undefined) body.active = updateFields.active;
            if (updateFields.conditions) body.conditions = prepareConditions(updateFields.conditions);
            if (updateFields.actions) body.actions = parseJsonSafe(updateFields.actions, 'actions');
            const executionDelay = resolveExecutionDelay(updateFields.execution_delay, 'update');
            if (executionDelay !== undefined) body.execution_delay = executionDelay;

            responseData = await chatwootApiRequest.call(
              this,
              'PATCH',
              `/automation_rules/${automationRuleId}`,
              body,
              {},
              requestOptions,
            );
          } else if (operation === 'clone') {
            // POST /automation_rules/:automation_rule_id/clone (nested route); 4.17+ answers 422 when the
            // rule has a delay and the account lost the delayed_automations feature
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            responseData = await chatwootApiRequest.call(
              this,
              'POST',
              `/automation_rules/${automationRuleId}/clone`,
              {},
              {},
              requestOptions,
            );
          } else if (operation === 'delete') {
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            await chatwootApiRequest.call(this, 'DELETE', `/automation_rules/${automationRuleId}`, {}, {}, requestOptions);
            responseData = { success: true, id: automationRuleId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CUSTOM FILTER
        // =====================================================================
        else if (resource === 'customFilter') {
          if (operation === 'getAll') {
            const filterType = this.getNodeParameter('filterType', i) as string;
            responseData = await chatwootApiRequest.call(this, 'GET', '/custom_filters', {}, { filter_type: filterType });
          } else if (operation === 'get') {
            const customFilterId = validateId(this.getNodeParameter('customFilterId', i), 'Custom Filter ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/custom_filters/${customFilterId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const filterType = this.getNodeParameter('filterType', i) as string;
            const query = parseJsonSafe(this.getNodeParameter('query', i), 'query');

            const body: IDataObject = {
              name,
              filter_type: filterType,
              query,
            };

            responseData = await chatwootApiRequest.call(this, 'POST', '/custom_filters', body);
          } else if (operation === 'update') {
            const customFilterId = validateId(this.getNodeParameter('customFilterId', i), 'Custom Filter ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.query) body.query = parseJsonSafe(updateFields.query, 'query');

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/custom_filters/${customFilterId}`, body);
          } else if (operation === 'delete') {
            const customFilterId = validateId(this.getNodeParameter('customFilterId', i), 'Custom Filter ID');
            await chatwootApiRequest.call(this, 'DELETE', `/custom_filters/${customFilterId}`);
            responseData = { success: true, id: customFilterId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // REPORT (Application API v2 — /api/v2/accounts/{id}/reports/...)
        // =====================================================================
        else if (resource === 'report') {
          const options = this.getNodeParameter('options', i, {}) as IDataObject;

          // Helper: since/until as integer Unix seconds + the options collection. `extra` is applied
          // last so an operation's own params (e.g. the outgoing messages group_by entity) are never
          // overwritten by an option. Array params are sent as inbox_ids[]=1&inbox_ids[]=2.
          const buildQs = (extra: IDataObject = {}): IDataObject => {
            const qs: IDataObject = {};
            const since = toUnixSeconds(this.getNodeParameter('since', i, ''), 'Since');
            const until = toUnixSeconds(this.getNodeParameter('until', i, ''), 'Until');
            if (since !== undefined) qs.since = since;
            if (until !== undefined) qs.until = until;
            if (options.id) qs.id = options.id;
            if (options.group_by) qs.group_by = options.group_by;
            if (options.timezone_offset !== undefined) qs.timezone_offset = options.timezone_offset;
            if (options.business_hours !== undefined) qs.business_hours = options.business_hours;
            if (options.days_before) qs.days_before = options.days_before;
            const inboxIds = parseIdList(options.inbox_ids, 'Inbox IDs');
            const labelIds = parseIdList(options.label_ids, 'Label IDs');
            if (inboxIds.length > 0) qs.inbox_ids = inboxIds;
            if (labelIds.length > 0) qs.label_ids = labelIds;
            return { ...qs, ...extra };
          };

          // Entity reports (Type = agent/inbox/label/team) need the entity ID
          const getEntityType = (): string => {
            const type = this.getNodeParameter('type', i) as string;
            if (type !== 'account' && !options.id) {
              throw new NodeOperationError(
                this.getNode(),
                `Options → Entity ID is required when Type is "${type}"`,
                { itemIndex: i },
              );
            }
            return type;
          };

          const csvDownload = Object.prototype.hasOwnProperty.call(REPORT_CSV_DOWNLOADS, operation)
            ? REPORT_CSV_DOWNLOADS[operation]
            : undefined;
          if (csvDownload) {
            // CSV endpoints: request text and output a binary file or parsed rows
            const qs = buildQs();
            if (csvDownload.dateRange && (qs.since === undefined || qs.until === undefined)) {
              // The CSV templates start with Date.strptime(params[:since]) → 500 without a range
              throw new NodeOperationError(this.getNode(), 'Since and Until are required for this report', { itemIndex: i });
            }
            const csv = await chatwootApiV2Request.call(this, 'GET', csvDownload.endpoint, {}, qs, {
              itemIndex: i,
              json: false,
              encoding: 'text',
            });
            returnData.push(
              ...(await buildCsvOutput.call(this, i, csv, { fileName: csvDownload.fileName, headerRow: 1, csvSafe: true })),
            );
            continue;
          }

          if (operation === 'accountSummary') {
            const type = getEntityType();
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/summary', {}, buildQs({ type }), { itemIndex: i });
          } else if (operation === 'timeseries') {
            const type = getEntityType();
            const metric = this.getNodeParameter('metric', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports', {}, buildQs({ type, metric }), { itemIndex: i });
          } else if (operation === 'botSummary') {
            const type = getEntityType();
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/bot_summary', {}, buildQs({ type }), { itemIndex: i });
          } else if (operation === 'botMetrics') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/bot_metrics', {}, buildQs(), { itemIndex: i });
          } else if (operation === 'conversationStatistics') {
            // Chatwoot only distinguishes 'account' from everything else (per-agent list, 25 per page,
            // user_id ignored). Legacy free-text values (inbox, team, label) behave like 'agent'.
            const conversationType = this.getNodeParameter('conversationType', i, 'account') as string;
            if (!conversationType || conversationType === 'account') {
              responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/conversations', {}, { type: 'account' }, { itemIndex: i });
            } else {
              const agents = await chatwootApiRequestAllItems.call(this, 'GET', '/reports/conversations', {}, { type: 'agent' }, undefined, {
                api: 'applicationV2',
                pageSize: 25,
                itemIndex: i,
              });
              const userId = Number(options.user_id) || 0;
              responseData = userId ? agents.filter((agent) => Number(agent.id) === userId) : agents;
            }
          } else if (operation === 'drilldown') {
            const type = getEntityType();
            const metric = this.getNodeParameter('metric', i) as string;
            const bucketTimestamp = toUnixSeconds(this.getNodeParameter('bucketTimestamp', i, ''), 'Bucket Start');
            if (bucketTimestamp === undefined) {
              throw new NodeOperationError(this.getNode(), 'Bucket Start is required for Drilldown', { itemIndex: i });
            }
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            // Chatwoot pages drilldowns with per_page up to 100
            const qs = buildQs({
              type,
              metric,
              bucket_timestamp: bucketTimestamp,
              per_page: limit === undefined ? 100 : Math.min(Math.max(limit, 1), 100),
            });
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/reports/drilldown', {}, qs, 'payload', {
              api: 'applicationV2',
              limit,
              itemIndex: i,
            });
          } else if (operation === 'inboxLabelMatrix') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/inbox_label_matrix', {}, buildQs(), { itemIndex: i });
          } else if (operation === 'firstResponseTimeDistribution') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/first_response_time_distribution', {}, buildQs(), { itemIndex: i });
          } else if (operation === 'outgoingMessagesCount') {
            const groupBy = this.getNodeParameter('groupBy', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/outgoing_messages_count', {}, buildQs({ group_by: groupBy }), { itemIndex: i });
          } else if (operation === 'reportingEvents') {
            // Enterprise, administrators only (v1 endpoint): 25 per page with meta.total_pages
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const qs = buildQs();
            if (options.inbox_id) qs.inbox_id = options.inbox_id;
            if (options.user_id) qs.user_id = options.user_id;
            if (options.event_name) qs.name = options.event_name;
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/reporting_events', {}, qs, 'payload', {
              limit,
              itemIndex: i,
            });
          } else if (operation === 'conversationReportingEvents') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/conversations/${conversationId}/reporting_events`, {}, {}, { itemIndex: i });
          } else if (operation === 'yearInReview') {
            const year = this.getNodeParameter('year', i) as number;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/year_in_review', {}, { year }, { itemIndex: i });
          } else if (operation === 'conversationCounts') {
            // Note: this stays on v1 because /conversations/meta is a v1 endpoint
            responseData = await chatwootApiRequest.call(this, 'GET', '/conversations/meta', {}, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PROFILE
        // =====================================================================
        else if (resource === 'profile') {
          // /api/v1/profile is NOT account-scoped ('user' API root). Availability and auto-offline are
          // stored per account, so they go to their own endpoints with the credential's account_id.
          const profileRequest = async (method: 'GET' | 'PUT' | 'POST', endpoint: string, body: IDataObject = {}) =>
            await chatwootRequest.call(this, method, endpoint, body, {}, { api: 'user', itemIndex: i });
          const credentialAccountId = async () => {
            const credentials = await this.getCredentials('chatwootApi', i);
            return Number(credentials.accountId);
          };

          if (operation === 'fetch') {
            responseData = await profileRequest('GET', '/profile');
          } else if (operation === 'update') {
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const profile: IDataObject = {};
            for (const key of ['name', 'display_name', 'email', 'message_signature', 'phone_number']) {
              if (updateFields[key] === undefined) continue;
              // name and email cannot be blank; the other fields are cleared with an empty value
              if (updateFields[key] === '' && (key === 'name' || key === 'email')) continue;
              profile[key] = updateFields[key];
            }
            const hasAvailability = updateFields.availability !== undefined && updateFields.availability !== '';
            const hasAutoOffline = updateFields.auto_offline !== undefined;
            if (Object.keys(profile).length === 0 && !hasAvailability && !hasAutoOffline) {
              throw new NodeOperationError(this.getNode(), 'Add at least one field to update', { itemIndex: i });
            }

            // Each endpoint answers the full profile; the last response is the up-to-date one
            let profileResponse: IDataObject | IDataObject[] = {};
            if (Object.keys(profile).length > 0) {
              profileResponse = await profileRequest('PUT', '/profile', { profile });
            }
            if (hasAvailability) {
              profileResponse = await profileRequest('POST', '/profile/availability', {
                profile: { account_id: await credentialAccountId(), availability: updateFields.availability },
              });
            }
            if (hasAutoOffline) {
              profileResponse = await profileRequest('POST', '/profile/auto_offline', {
                profile: { account_id: await credentialAccountId(), auto_offline: updateFields.auto_offline },
              });
            }
            responseData = profileResponse;
          } else if (operation === 'availability') {
            const availability = this.getNodeParameter('availability', i) as string;
            const accountId = await credentialAccountId();
            responseData = await profileRequest('POST', '/profile/availability', {
              profile: { account_id: accountId, availability },
            });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // HELP CENTER
        // =====================================================================
        else if (resource === 'helpCenter') {
          // Chatwoot's PortalsController/CategoriesController/ArticlesController
          // use `params.require(:portal|:category|:article)` so create/update
          // bodies must wrap fields under the resource key. Without the wrapper
          // create returns 500 and update silently no-ops.
          // Portals are looked up by slug (find_by!(slug:)).
          const getPortalSlug = (): string => {
            const slug = String(this.getNodeParameter('portalSlug', i) ?? '').trim();
            if (!slug) {
              throw new NodeOperationError(this.getNode(), 'Portal Slug must not be empty', { itemIndex: i });
            }
            return encodeURIComponent(slug);
          };

          const buildPortalFields = (fields: IDataObject) => {
            const portal: IDataObject = {};
            for (const key of ['name', 'slug', 'custom_domain', 'header_text', 'homepage_link', 'page_title', 'color']) {
              if (fields[key] !== undefined && fields[key] !== '') portal[key] = fields[key];
            }
            if (fields.archived !== undefined) portal.archived = fields.archived;
            const config: IDataObject = {};
            if (fields.default_locale) config.default_locale = String(fields.default_locale).trim();
            const allowedLocales = parseStringList(fields.allowed_locales);
            if (allowedLocales.length > 0) config.allowed_locales = allowedLocales;
            if (fields.draft_locales !== undefined) config.draft_locales = parseStringList(fields.draft_locales);
            if (fields.layout) config.layout = fields.layout;
            for (const key of ['social_profiles', 'analytics']) {
              const value = parseJsonObject(fields[key], key);
              if (value) config[key] = value;
            }
            // inbox_id (website inbox for the live chat widget) is read outside the portal wrapper
            const inboxId = Number(fields.inbox_id) > 0 ? Number(fields.inbox_id) : undefined;
            return { portal, config, inboxId };
          };

          const buildCategoryFields = (fields: IDataObject): IDataObject => {
            const category: IDataObject = {};
            for (const key of ['name', 'slug', 'locale', 'description', 'icon', 'icon_color']) {
              if (fields[key] !== undefined && fields[key] !== '') category[key] = fields[key];
            }
            if (fields.position !== undefined) category.position = fields.position;
            for (const key of ['parent_category_id', 'associated_category_id']) {
              if (Number(fields[key]) > 0) category[key] = Number(fields[key]);
            }
            const relatedIds = parseIdList(fields.related_category_ids, 'Related Category IDs');
            if (relatedIds.length > 0) category.related_category_ids = relatedIds;
            return category;
          };

          const buildArticleFields = (fields: IDataObject) => {
            const article: IDataObject = {};
            for (const key of ['title', 'content', 'description', 'slug', 'status', 'locale', 'draft_title', 'draft_content']) {
              if (fields[key] !== undefined && fields[key] !== '') article[key] = fields[key];
            }
            if (fields.position !== undefined) article.position = fields.position;
            // Never send 0/'' IDs: Chatwoot 4.18 rejects author_id 0 with 422 "Invalid author ID"
            for (const key of ['category_id', 'author_id', 'associated_article_id']) {
              const id = Number(fields[key]);
              if (Number.isInteger(id) && id > 0) article[key] = id;
            }
            const meta: IDataObject = {};
            if (fields.meta_title) meta.title = fields.meta_title;
            if (fields.meta_description) meta.description = fields.meta_description;
            if (fields.meta_tags !== undefined) meta.tags = parseStringList(fields.meta_tags);
            return { article, meta };
          };

          if (operation === 'createPortal') {
            const name = this.getNodeParameter('name', i) as string;
            const slug = this.getNodeParameter('slug', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
            const { portal, config, inboxId } = buildPortalFields(additionalFields);

            const body: IDataObject = { portal: { ...portal, name, slug } };
            if (Object.keys(config).length > 0) (body.portal as IDataObject).config = config;
            if (inboxId) body.inbox_id = inboxId;
            responseData = await chatwootApiRequest.call(this, 'POST', '/portals', body, {}, { itemIndex: i });
          } else if (operation === 'getPortal') {
            const portalSlug = getPortalSlug();
            responseData = await chatwootApiRequest.call(this, 'GET', `/portals/${portalSlug}`, {}, {}, { itemIndex: i });
          } else if (operation === 'updatePortal') {
            const portalSlug = getPortalSlug();
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const { portal, config, inboxId } = buildPortalFields(updateFields);

            if (Object.keys(config).length > 0) {
              // Older Chatwoot versions replace the whole config (dropping allowed locales, layout...):
              // read the current config and send the merged object, which is safe on every version.
              const current = (await chatwootApiRequest.call(this, 'GET', `/portals/${portalSlug}`, {}, {}, { itemIndex: i })) as IDataObject;
              portal.config = { ...portalConfigFromResponse(current), ...config };
            }
            const body: IDataObject = { portal };
            if (inboxId) {
              body.inbox_id = inboxId;
              // PortalsController#update only applies inbox_id together with portal attributes
              // (`if params[:portal].present?`): resend the current slug so a widget-only change
              // is not silently ignored
              if (Object.keys(portal).length === 0) portal.slug = decodeURIComponent(portalSlug);
            }
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/portals/${portalSlug}`, body, {}, { itemIndex: i });
          } else if (operation === 'deletePortal') {
            const portalSlug = getPortalSlug();
            await chatwootApiRequest.call(this, 'DELETE', `/portals/${portalSlug}`, {}, {}, { itemIndex: i });
            responseData = { success: true, portalSlug: decodeURIComponent(portalSlug) };
          } else if (operation === 'listPortals') {
            // index renders { payload: [...], meta }: one output item per portal
            const response = (await chatwootApiRequest.call(this, 'GET', '/portals', {}, {}, { itemIndex: i })) as IDataObject;
            responseData = (Array.isArray(response.payload) ? response.payload : []) as IDataObject[];
          } else if (operation === 'createCategory') {
            const portalSlug = getPortalSlug();
            const name = this.getNodeParameter('name', i) as string;
            const slug = this.getNodeParameter('slug', i) as string;
            const locale = this.getNodeParameter('locale', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { category: { ...buildCategoryFields(additionalFields), name, slug, locale } };
            responseData = await chatwootApiRequest.call(this, 'POST', `/portals/${portalSlug}/categories`, body, {}, { itemIndex: i });
          } else if (operation === 'getCategory' || operation === 'updateCategory' || operation === 'deleteCategory') {
            const portalSlug = getPortalSlug();
            const categoryId = validateId(this.getNodeParameter('categoryId', i), 'Category ID');
            const endpoint = `/portals/${portalSlug}/categories/${categoryId}`;
            if (operation === 'getCategory') {
              responseData = await chatwootApiRequest.call(this, 'GET', endpoint, {}, {}, { itemIndex: i });
            } else if (operation === 'updateCategory') {
              const category = buildCategoryFields(this.getNodeParameter('updateFields', i) as IDataObject);
              if (Object.keys(category).length === 0) {
                throw new NodeOperationError(this.getNode(), 'Update Fields: set at least one field to update', { itemIndex: i });
              }
              responseData = await chatwootApiRequest.call(this, 'PATCH', endpoint, { category }, {}, { itemIndex: i });
            } else {
              await chatwootApiRequest.call(this, 'DELETE', endpoint, {}, {}, { itemIndex: i });
              responseData = { success: true, id: categoryId };
            }
          } else if (operation === 'listCategories') {
            const portalSlug = getPortalSlug();
            const locale = this.getNodeParameter('locale', i, '') as string;
            const qs: IDataObject = {};
            if (locale) qs.locale = locale;
            // Categories are not paginated in practice (1000 per page); index renders { payload, meta }
            const response = (await chatwootApiRequest.call(this, 'GET', `/portals/${portalSlug}/categories`, {}, qs, { itemIndex: i })) as IDataObject;
            responseData = (Array.isArray(response.payload) ? response.payload : []) as IDataObject[];
          } else if (operation === 'createArticle') {
            const portalSlug = getPortalSlug();
            const title = this.getNodeParameter('title', i) as string;
            const content = this.getNodeParameter('content', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
            const { article, meta } = buildArticleFields(additionalFields);
            article.title = title;
            article.content = content;
            if (Object.keys(meta).length > 0) article.meta = meta;

            if (!article.author_id) {
              // Chatwoot requires an author and has no default: use the token owner, as the dashboard
              // does. GET /notification_settings is account-scoped and returns the current user_id.
              let userId = 0;
              try {
                const settings = (await chatwootApiRequest.call(this, 'GET', '/notification_settings', {}, {}, { itemIndex: i })) as IDataObject;
                userId = Number(settings.user_id);
              } catch (error) {
                throw new NodeOperationError(this.getNode(), 'Could not resolve the article author from the API access token', {
                  itemIndex: i,
                  description: `Set Additional Fields → Author Name or ID. ${(error as Error).message}`,
                });
              }
              if (!Number.isInteger(userId) || userId < 1) {
                throw new NodeOperationError(this.getNode(), 'Could not resolve the article author from the API access token', {
                  itemIndex: i,
                  description: 'Set Additional Fields → Author Name or ID.',
                });
              }
              article.author_id = userId;
            }
            responseData = await chatwootApiRequest.call(this, 'POST', `/portals/${portalSlug}/articles`, { article }, {}, { itemIndex: i });
          } else if (operation === 'getArticle' || operation === 'updateArticle' || operation === 'deleteArticle') {
            const portalSlug = getPortalSlug();
            const articleId = validateId(this.getNodeParameter('articleId', i), 'Article ID');
            const endpoint = `/portals/${portalSlug}/articles/${articleId}`;
            if (operation === 'getArticle') {
              responseData = await chatwootApiRequest.call(this, 'GET', endpoint, {}, {}, { itemIndex: i });
            } else if (operation === 'updateArticle') {
              const { article, meta } = buildArticleFields(this.getNodeParameter('updateFields', i) as IDataObject);
              if (Object.keys(meta).length > 0) {
                // Chatwoot replaces meta as a whole: merge into the current meta
                const current = (await chatwootApiRequest.call(this, 'GET', endpoint, {}, {}, { itemIndex: i })) as IDataObject;
                const currentMeta = ((current.payload as IDataObject | undefined)?.meta ?? {}) as IDataObject;
                article.meta = { ...currentMeta, ...meta };
              }
              if (Object.keys(article).length === 0) {
                throw new NodeOperationError(this.getNode(), 'Update Fields: set at least one field to update', { itemIndex: i });
              }
              // Only draft_title/draft_content: staged edit that keeps the published version (4.16+)
              responseData = await chatwootApiRequest.call(this, 'PATCH', endpoint, { article }, {}, { itemIndex: i });
            } else {
              await chatwootApiRequest.call(this, 'DELETE', endpoint, {}, {}, { itemIndex: i });
              responseData = { success: true, id: articleId };
            }
          } else if (operation === 'listArticles') {
            const portalSlug = getPortalSlug();
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const options = this.getNodeParameter('options', i) as IDataObject;

            const qs: IDataObject = {};
            if (options.locale) qs.locale = options.locale;
            if (options.category_slug) qs.category_slug = options.category_slug;
            if (options.status) qs.status = options.status;
            if (options.query) qs.query = options.query;
            if (Number(options.author_id) > 0) qs.author_id = Number(options.author_id);

            responseData = await chatwootApiRequestAllItems.call(this, 'GET', `/portals/${portalSlug}/articles`, {}, qs, 'payload', {
              limit,
              pageSize: 25,
              itemIndex: i,
            });
          } else if (
            operation === 'bulkUpdateArticleStatus' ||
            operation === 'bulkUpdateArticleCategory' ||
            operation === 'bulkDeleteArticles'
          ) {
            // Chatwoot 4.14+: /portals/:slug/articles/bulk_actions/* answer `head :ok`
            const portalSlug = getPortalSlug();
            const ids = parseIdList(this.getNodeParameter('articleIds', i), 'Article IDs');
            if (ids.length === 0) {
              throw new NodeOperationError(this.getNode(), 'Article IDs must contain at least one ID', { itemIndex: i });
            }
            const endpoint = `/portals/${portalSlug}/articles/bulk_actions`;
            if (operation === 'bulkUpdateArticleStatus') {
              const status = this.getNodeParameter('bulkStatus', i) as string;
              await chatwootApiRequest.call(this, 'PATCH', `${endpoint}/update_status`, { ids, status }, {}, { itemIndex: i });
              responseData = { success: true, ids, status };
            } else if (operation === 'bulkUpdateArticleCategory') {
              const categoryId = validateId(this.getNodeParameter('bulkCategoryId', i), 'Category ID');
              await chatwootApiRequest.call(this, 'PATCH', `${endpoint}/update_category`, { ids, category_id: categoryId }, {}, { itemIndex: i });
              responseData = { success: true, ids, categoryId };
            } else {
              await chatwootApiRequest.call(this, 'DELETE', `${endpoint}/delete_articles`, { ids }, {}, { itemIndex: i });
              responseData = { success: true, ids };
            }
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // INTEGRATION
        // =====================================================================
        else if (resource === 'integration') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/integrations/apps', {}, {}, {
              itemIndex: i,
            });
          } else if (operation === 'createHook') {
            const appId = this.getNodeParameter('appId', i) as string;
            const inboxId = this.getNodeParameter('inboxId', i, 0) as number | string;
            const settings = parseJsonSafe(this.getNodeParameter('settings', i), 'settings');

            // Only inbox-level apps (Dialogflow) need an inbox; account-level apps must not send one
            const hook: IDataObject = { app_id: appId, settings };
            if (inboxId !== 0 && inboxId !== '' && inboxId !== null && inboxId !== undefined) {
              hook.inbox_id = validateId(inboxId, 'Inbox ID');
            }
            responseData = await chatwootApiRequest.call(this, 'POST', '/integrations/hooks', { hook }, {}, {
              itemIndex: i,
            });
          } else if (operation === 'updateHook') {
            const hookId = validateId(this.getNodeParameter('hookId', i), 'Hook ID');
            const settings = parseJsonSafe(this.getNodeParameter('settings', i), 'settings') as IDataObject;
            const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

            // An empty settings object would wipe the stored settings (or fail the app's schema)
            const hook: IDataObject = {};
            if (settings && typeof settings === 'object' && Object.keys(settings).length > 0) {
              hook.settings = settings;
            }
            if (updateFields.status) hook.status = updateFields.status;
            if (Object.keys(hook).length === 0) {
              throw new NodeOperationError(this.getNode(), 'Set Settings or a Status to update the hook', {
                itemIndex: i,
              });
            }
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/integrations/hooks/${hookId}`, { hook }, {}, {
              itemIndex: i,
            });
          } else if (operation === 'deleteHook') {
            const hookId = validateId(this.getNodeParameter('hookId', i), 'Hook ID');
            await chatwootApiRequest.call(this, 'DELETE', `/integrations/hooks/${hookId}`, {}, {}, {
              itemIndex: i,
            });
            responseData = { success: true, id: hookId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AUDIT LOG
        // =====================================================================
        else if (resource === 'auditLog') {
          // GET /audit_logs renders { per_page, total_entries, current_page, audit_logs: [...] }
          // (25 per page since 4.17). Filters types[]/q/since/until/sort exist since Chatwoot 4.17.
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
            const qs: IDataObject = {};

            // The legacy single "auditable_type" filter is merged into types[]
            const types = new Set<string>(parseStringList(filters.types));
            if (filters.auditable_type) types.add(filters.auditable_type as string);
            if (types.size > 0) qs.types = [...types];
            if (filters.q) qs.q = filters.q;
            const since = toUnixSeconds(filters.since, 'Since');
            const until = toUnixSeconds(filters.until, 'Until');
            if (since !== undefined) qs.since = since;
            if (until !== undefined) qs.until = until;
            if (filters.sort) qs.sort = filters.sort;

            const userId = Number(filters.user_id) || 0;
            if (userId) {
              // No server-side user filter: scan the pages and keep this user's entries
              responseData = await requestFilteredPages.call(this, '/audit_logs', qs, 'audit_logs', (entry) => Number(entry.user_id) === userId, {
                limit,
                pageSize: 25,
                itemIndex: i,
              });
            } else {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/audit_logs', {}, qs, 'audit_logs', {
                limit,
                itemIndex: i,
              });
            }
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CSAT SURVEY
        // =====================================================================
        else if (resource === 'csatSurvey') {
          // Chatwoot filters CSAT responses only by date range (both since and until), assigned agents
          // (user_ids[]), inbox_id, team_id and rating[]. The list is a bare array, 25 per page.
          const options = this.getNodeParameter('options', i, {}) as IDataObject;
          const buildCsatQs = (): IDataObject => {
            const qs: IDataObject = {};
            const since = toUnixSeconds(options.since, 'Since');
            const until = toUnixSeconds(options.until, 'Until');
            if (since !== undefined) qs.since = since;
            if (until !== undefined) qs.until = until;
            const userIds = parseIdList(options.user_ids, 'Agent IDs');
            if (userIds.length > 0) qs.user_ids = userIds;
            if (options.inbox_id) qs.inbox_id = options.inbox_id;
            if (options.team_id) qs.team_id = options.team_id;
            const ratings = parseStringList(options.rating);
            if (ratings.length > 0) qs.rating = ratings;
            return qs;
          };

          if (operation === 'get') {
            // There is no conversation filter (conversation_id used to be ignored and the first page
            // of the whole account was returned): scan newest first and keep the matching response.
            // The response's conversation_id is the conversation display ID used in URLs.
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const qs = { ...buildCsatQs(), sort: '-created_at' };
            responseData = await requestFilteredPages.call(this, '/csat_survey_responses', qs, undefined, (response) => Number(response.conversation_id) === conversationId, {
              limit: 1,
              pageSize: 25,
              itemIndex: i,
            });
          } else if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const qs = { ...buildCsatQs(), sort: (options.sort as string) || '-created_at' };
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/csat_survey_responses', {}, qs, undefined, {
              limit,
              pageSize: 25,
              itemIndex: i,
            });
          } else if (operation === 'metrics') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/csat_survey_responses/metrics', {}, buildCsatQs(), { itemIndex: i });
          } else if (operation === 'download') {
            const qs = buildCsatQs();
            // The CSV template ends with Date.strptime(params[:since]) → 500 without a range
            if (qs.since === undefined || qs.until === undefined) {
              throw new NodeOperationError(this.getNode(), 'CSAT Download requires Options → Since and Until', {
                itemIndex: i,
                description: 'Chatwoot writes the reporting period into the CSV and fails (500) when the date range is missing.',
              });
            }
            const csv = await chatwootApiRequest.call(this, 'GET', '/csat_survey_responses/download', {}, { ...qs, sort: '-created_at' }, {
              itemIndex: i,
              json: false,
              encoding: 'text',
            });
            returnData.push(...(await buildCsvOutput.call(this, i, csv, { fileName: 'csat_report.csv', headerRow: 0, csvSafe: true })));
            continue;
          } else if (operation === 'updateReviewNotes') {
            // Enterprise: PATCH /csat_survey_responses/:id with a top-level csat_review_notes
            const csatResponseId = validateId(this.getNodeParameter('csatResponseId', i), 'CSAT Response ID');
            const reviewNotes = this.getNodeParameter('reviewNotes', i, '') as string;
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/csat_survey_responses/${csatResponseId}`, { csat_review_notes: reviewNotes }, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // MACRO
        // =====================================================================
        else if (resource === 'macro') {
          const requestOptions = { itemIndex: i };
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/macros', {}, {}, requestOptions);
          } else if (operation === 'get') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/macros/${macroId}`, {}, {}, requestOptions);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const actions = this.getNodeParameter('actions', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            // Macro#set_visibility assigns params[:visibility] as-is: omitting it stores NULL, and a
            // macro that is neither personal nor global never shows up in Get Many
            const body: IDataObject = {
              name,
              actions: parseJsonSafe(actions, 'actions'),
              visibility: additionalFields.visibility || 'personal',
            };

            responseData = await chatwootApiRequest.call(this, 'POST', '/macros', body, {}, requestOptions);
          } else if (operation === 'update') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.visibility) {
              body.visibility = updateFields.visibility;
            } else {
              // Same NULL-visibility trap as Create: resend the current visibility
              const current = (await chatwootApiRequest.call(
                this,
                'GET',
                `/macros/${macroId}`,
                {},
                {},
                requestOptions,
              )) as IDataObject;
              const currentMacro = (current.payload ?? current) as IDataObject;
              body.visibility = currentMacro.visibility || 'personal';
            }
            if (updateFields.actions) {
              body.actions = parseJsonSafe(updateFields.actions, 'actions');
            }

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/macros/${macroId}`, body, {}, requestOptions);
          } else if (operation === 'delete') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            await chatwootApiRequest.call(this, 'DELETE', `/macros/${macroId}`, {}, {}, requestOptions);
            responseData = { success: true, id: macroId };
          } else if (operation === 'execute') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const options = this.getNodeParameter('options', i, {}) as IDataObject;

            const conversationIds = [conversationId];
            for (const raw of String(options.additionalConversationIds ?? '').split(',')) {
              if (!raw.trim()) continue;
              const id = validateId(raw.trim(), 'Additional Conversation IDs');
              if (!conversationIds.includes(id)) conversationIds.push(id);
            }

            // MacrosExecutionJob runs later and answers `head :ok`; since 4.18 it skips (and only
            // logs) conversations the token user cannot see, so the output reports "queued"
            await chatwootApiRequest.call(
              this,
              'POST',
              `/macros/${macroId}/execute`,
              { conversation_ids: conversationIds },
              {},
              requestOptions,
            );
            responseData = { success: true, status: 'queued', macroId, conversationIds };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // NOTIFICATION
        // =====================================================================
        else if (resource === 'notification') {
          const requestOptions = { itemIndex: i };
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const options = this.getNodeParameter('options', i) as IDataObject;

            // NotificationFinder reads params[:includes] (serialized as includes[]=read&includes[]=snoozed)
            const qs: IDataObject = {};
            const includes: string[] = [];
            if (options.includes_read) includes.push('read');
            if (options.includes_snoozed) includes.push('snoozed');
            if (includes.length > 0) qs.includes = includes;
            if (options.sort_order) qs.sort_order = options.sort_order;

            // { data: { meta: { count, unread_count, current_page }, payload: [...] } }, 15 per page
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/notifications', {}, qs, 'data.payload', {
              limit,
              pageSize: 15,
              itemIndex: i,
            });
          } else if (operation === 'markRead') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            responseData = await chatwootApiRequest.call(
              this,
              'PATCH',
              `/notifications/${notificationId}`,
              {},
              {},
              requestOptions,
            );
          } else if (operation === 'delete') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            await chatwootApiRequest.call(this, 'DELETE', `/notifications/${notificationId}`, {}, {}, requestOptions);
            responseData = { success: true, id: notificationId };
          } else if (operation === 'deleteAll') {
            // Anything but 'read' deletes every notification; the job runs asynchronously (`head :ok`)
            const deleteType = this.getNodeParameter('deleteType', i) as string;
            const body = { type: deleteType };
            await chatwootApiRequest.call(this, 'POST', '/notifications/destroy_all', body, {}, requestOptions);
            responseData = { success: true, status: 'queued', type: deleteType };
          } else if (operation === 'readAll') {
            // `head :ok`
            await chatwootApiRequest.call(this, 'POST', '/notifications/read_all', {}, {}, requestOptions);
            responseData = { success: true };
          } else if (operation === 'unreadCount') {
            // Chatwoot renders the bare number (`render json: @unread_count`)
            const count = await chatwootApiRequest.call(
              this,
              'GET',
              '/notifications/unread_count',
              {},
              {},
              requestOptions,
            );
            const unreadCount = Number(count);
            responseData = Number.isFinite(unreadCount) ? { unread_count: unreadCount } : (count as IDataObject);
          } else if (operation === 'markUnread') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            responseData = await chatwootApiRequest.call(
              this,
              'POST',
              `/notifications/${notificationId}/unread`,
              {},
              {},
              requestOptions,
            );
          } else if (operation === 'snooze') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            const snoozedUntil = toUnixSeconds(this.getNodeParameter('snoozedUntil', i), 'Snoozed Until');
            responseData = await chatwootApiRequest.call(
              this,
              'POST',
              `/notifications/${notificationId}/snooze`,
              { snoozed_until: snoozedUntil },
              {},
              requestOptions,
            );
          } else if (operation === 'getSettings') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/notification_settings', {}, {}, requestOptions);
          } else if (operation === 'updateSettings') {
            const settings = this.getNodeParameter('notificationSettings', i) as IDataObject;
            if (settings.selected_email_flags === undefined && settings.selected_push_flags === undefined) {
              throw new NodeOperationError(
                this.getNode(),
                'Add Email Notifications and/or Push Notifications to update',
                { itemIndex: i },
              );
            }

            // The controller assigns both lists: a missing one would clear every flag of that channel,
            // so read the current settings and resend the list the user did not set
            let emailFlags = settings.selected_email_flags as string[] | undefined;
            let pushFlags = settings.selected_push_flags as string[] | undefined;
            if (emailFlags === undefined || pushFlags === undefined) {
              const current = (await chatwootApiRequest.call(
                this,
                'GET',
                '/notification_settings',
                {},
                {},
                requestOptions,
              )) as IDataObject;
              emailFlags ??= (current.selected_email_flags as string[] | undefined) ?? [];
              pushFlags ??= (current.selected_push_flags as string[] | undefined) ?? [];
            }

            responseData = await chatwootApiRequest.call(
              this,
              'PATCH',
              '/notification_settings',
              { notification_settings: { selected_email_flags: emailFlags, selected_push_flags: pushFlags } },
              {},
              requestOptions,
            );
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CAMPAIGN
        // =====================================================================
        else if (resource === 'campaign') {
          const requestOptions = { itemIndex: i };
          // Campaign routes use the display ID (the "id" in every campaign response).
          // Fields are sent at the top level like the Chatwoot dashboard does: Rails wraps them into
          // params[:campaign] (wrap_parameters, the Campaign model has all these columns).
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/campaigns', {}, {}, requestOptions);
          } else if (operation === 'get') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            responseData = await chatwootApiRequest.call(
              this,
              'GET',
              `/campaigns/${campaignId}`,
              {},
              {},
              requestOptions,
            );
          } else if (operation === 'create') {
            const title = this.getNodeParameter('title', i) as string;
            const message = this.getNodeParameter('message', i) as string;
            const inbox = this.getNodeParameter('inboxId', i, '') as string | number;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            // Campaign validates inbox_id presence: fall back to the pre-0.9.0 Additional Fields > Inbox ID
            let inboxId: number | undefined;
            if (inbox !== '' && inbox !== 0 && inbox !== null && inbox !== undefined) {
              inboxId = validateId(inbox, 'Inbox');
            } else if (additionalFields.inbox_id) {
              inboxId = validateId(additionalFields.inbox_id, 'Inbox ID');
            }
            if (inboxId === undefined) {
              throw new NodeOperationError(this.getNode(), 'Inbox is required to create a campaign', {
                itemIndex: i,
                description:
                  'Choose a Website, SMS, Twilio SMS or WhatsApp inbox in the "Inbox" field. API channel inboxes cannot run campaigns.',
              });
            }

            const body: IDataObject = {
              ...buildCampaignBody(additionalFields, 'create'),
              title,
              message,
              inbox_id: inboxId,
            };

            responseData = await chatwootApiRequest.call(this, 'POST', '/campaigns', body, {}, requestOptions);
          } else if (operation === 'update') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            // trigger_rules is replaced as a whole: keep the current URL / time when only one changes
            let currentTriggerRules: IDataObject | undefined;
            if (needsCurrentTriggerRules(updateFields)) {
              const current = (await chatwootApiRequest.call(
                this,
                'GET',
                `/campaigns/${campaignId}`,
                {},
                {},
                requestOptions,
              )) as IDataObject;
              currentTriggerRules = (current.trigger_rules as IDataObject | undefined) ?? {};
            }

            const body = buildCampaignBody(updateFields, 'update', currentTriggerRules);
            if (Object.keys(body).length === 0) {
              throw new NodeOperationError(
                this.getNode(),
                'Add at least one field to update in "Update Fields"',
                { itemIndex: i },
              );
            }

            responseData = await chatwootApiRequest.call(
              this,
              'PATCH',
              `/campaigns/${campaignId}`,
              body,
              {},
              requestOptions,
            );
          } else if (operation === 'delete') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            await chatwootApiRequest.call(this, 'DELETE', `/campaigns/${campaignId}`, {}, {}, requestOptions);
            responseData = { success: true, id: campaignId };
          } else if (operation === 'getMetrics') {
            // Enterprise route (4.17+). 401 unless the campaign is a one-off WhatsApp campaign and the
            // account has whatsapp_campaign; 404 on Community Edition
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            responseData = await chatwootApiRequest.call(
              this,
              'GET',
              `/campaigns/${campaignId}/analytics/metrics`,
              {},
              {},
              requestOptions,
            );
          } else if (operation === 'getRecipients') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const options = this.getNodeParameter('options', i) as IDataObject;

            const qs: IDataObject = {};
            if (options.status) qs.status = options.status;

            // { payload: [...], meta: { current_page, total_pages, total_count } }, 25 per page
            responseData = await chatwootApiRequestAllItems.call(
              this,
              'GET',
              `/campaigns/${campaignId}/analytics/contacts`,
              {},
              qs,
              'payload',
              { limit, pageSize: 25, itemIndex: i },
            );
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CONTACT NOTE
        // =====================================================================
        else if (resource === 'contactNote') {
          if (operation === 'getAll') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/contacts/${contactId}/notes`);
          } else if (operation === 'create') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            const content = this.getNodeParameter('content', i) as string;
            responseData = await chatwootApiRequest.call(this, 'POST', `/contacts/${contactId}/notes`, { content });
          } else if (operation === 'update') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            const noteId = validateId(this.getNodeParameter('noteId', i), 'Note ID');
            const content = this.getNodeParameter('content', i) as string;
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/contacts/${contactId}/notes/${noteId}`, { content });
          } else if (operation === 'delete') {
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            const noteId = validateId(this.getNodeParameter('noteId', i), 'Note ID');
            await chatwootApiRequest.call(this, 'DELETE', `/contacts/${contactId}/notes/${noteId}`);
            responseData = { success: true, id: noteId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CONVERSATION PARTICIPANT
        // =====================================================================
        else if (resource === 'conversationParticipant') {
          if (operation === 'getAll') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/conversations/${conversationId}/participants`);
          } else if (operation === 'add') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));
            responseData = await chatwootApiRequest.call(this, 'POST', `/conversations/${conversationId}/participants`, { user_ids: userIds });
          } else if (operation === 'remove') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));
            responseData = await chatwootApiRequest.call(this, 'DELETE', `/conversations/${conversationId}/participants`, { user_ids: userIds });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // COMPANY (Enterprise)
        // =====================================================================
        else if (resource === 'company') {
          // Enterprise + 'companies' account feature since 4.14 (403 "Companies are not enabled for
          // this account" otherwise). Lists: { meta: { total_count, page }, payload: [...] }.
          const buildCompanyBody = (fields: IDataObject): IDataObject => {
            const company: IDataObject = {};
            if (fields.name) company.name = fields.name;
            if (fields.domain) company.domain = fields.domain;
            if (fields.description) company.description = fields.description;
            for (const key of ['custom_attributes', 'additional_attributes']) {
              const value = parseJsonObject(fields[key], key);
              if (value) company[key] = value;
            }
            // CompaniesController reads params.require(:company)
            return { company };
          };

          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const options = this.getNodeParameter('options', i, {}) as IDataObject;
            const qs: IDataObject = {};
            if (options.sort) qs.sort = `${options.direction === 'desc' ? '-' : ''}${options.sort as string}`;
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/companies', {}, qs, 'payload', {
              limit,
              pageSize: 25,
              itemIndex: i,
            });
          } else if (operation === 'get') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/companies/${companyId}`, {}, {}, { itemIndex: i });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
            const body = buildCompanyBody({ ...additionalFields, name });
            responseData = await chatwootApiRequest.call(this, 'POST', '/companies', body, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            // custom_attributes are merged into the existing ones by Chatwoot (4.14+)
            const body = buildCompanyBody(updateFields);
            if (Object.keys(body.company as IDataObject).length === 0) {
              throw new NodeOperationError(this.getNode(), 'Update Fields: set at least one field to update', { itemIndex: i });
            }
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/companies/${companyId}`, body, {}, { itemIndex: i });
          } else if (operation === 'delete') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            await chatwootApiRequest.call(this, 'DELETE', `/companies/${companyId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: companyId };
          } else if (operation === 'search') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/companies/search', {}, { q: query }, 'payload', {
              limit,
              pageSize: 25,
              itemIndex: i,
            });
          } else if (operation === 'getContacts' || operation === 'searchContacts') {
            // 15 per page; search returns contacts NOT linked to this company (candidates to add)
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const endpoint = operation === 'getContacts' ? `/companies/${companyId}/contacts` : `/companies/${companyId}/contacts/search`;
            const qs: IDataObject = operation === 'searchContacts' ? { q: this.getNodeParameter('query', i) as string } : {};
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', endpoint, {}, qs, 'payload', {
              limit,
              pageSize: 15,
              itemIndex: i,
            });
          } else if (operation === 'addContact') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            responseData = await chatwootApiRequest.call(this, 'POST', `/companies/${companyId}/contacts`, { contact_id: contactId }, {}, { itemIndex: i });
          } else if (operation === 'removeContact') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const contactId = validateId(this.getNodeParameter('contactId', i), 'Contact ID');
            await chatwootApiRequest.call(this, 'DELETE', `/companies/${companyId}/contacts/${contactId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, companyId, contactId };
          } else if (operation === 'getConversations' || operation === 'getNotes') {
            // Both return the 20 most recent records as { payload: [...] }
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const segment = operation === 'getConversations' ? 'conversations' : 'notes';
            const response = (await chatwootApiRequest.call(this, 'GET', `/companies/${companyId}/${segment}`, {}, {}, { itemIndex: i })) as IDataObject;
            responseData = (Array.isArray(response.payload) ? response.payload : []) as IDataObject[];
          } else if (operation === 'deleteCustomAttributes') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const keys = parseStringList(this.getNodeParameter('customAttributeKeys', i));
            if (keys.length === 0) {
              throw new NodeOperationError(this.getNode(), 'Custom Attribute Keys must contain at least one key', { itemIndex: i });
            }
            responseData = await chatwootApiRequest.call(this, 'POST', `/companies/${companyId}/destroy_custom_attributes`, { custom_attributes: keys }, {}, { itemIndex: i });
          } else if (operation === 'deleteAvatar') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            responseData = await chatwootApiRequest.call(this, 'DELETE', `/companies/${companyId}/avatar`, {}, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // SEARCH (Global)
        // =====================================================================
        else if (resource === 'search') {
          if (operation === 'searchAll') {
            const query = this.getNodeParameter('query', i) as string;
            responseData = await chatwootApiRequest.call(this, 'GET', '/search', {}, { q: query });
          } else if (operation === 'searchConversations') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const qs: IDataObject = { q: query };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/search/conversations', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/search/conversations', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'searchContacts') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const qs: IDataObject = { q: query };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/search/contacts', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/search/contacts', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'searchMessages') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const qs: IDataObject = { q: query };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/search/messages', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/search/messages', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // SLA POLICY (Enterprise)
        // =====================================================================
        else if (resource === 'slaPolicy') {
          // Requires the premium 'sla' feature (401 "You are not authorized to do this action" otherwise)
          if (operation === 'getAll') {
            // index renders { payload: [...] }: one output item per policy
            const response = (await chatwootApiRequest.call(this, 'GET', '/sla_policies', {}, {}, { itemIndex: i })) as IDataObject;
            responseData = (Array.isArray(response.payload) ? response.payload : response) as IDataObject[];
          } else if (operation === 'get') {
            const slaPolicyId = validateId(this.getNodeParameter('slaPolicyId', i), 'SLA Policy ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/sla_policies/${slaPolicyId}`, {}, {}, { itemIndex: i });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
            const body: IDataObject = { name };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.first_response_time_threshold) body.first_response_time_threshold = additionalFields.first_response_time_threshold;
            if (additionalFields.next_response_time_threshold) body.next_response_time_threshold = additionalFields.next_response_time_threshold;
            if (additionalFields.resolution_time_threshold) body.resolution_time_threshold = additionalFields.resolution_time_threshold;
            if (additionalFields.only_during_business_hours !== undefined) body.only_during_business_hours = additionalFields.only_during_business_hours;
            responseData = await chatwootApiRequest.call(this, 'POST', '/sla_policies', body, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const slaPolicyId = validateId(this.getNodeParameter('slaPolicyId', i), 'SLA Policy ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.description) body.description = updateFields.description;
            if (updateFields.first_response_time_threshold) body.first_response_time_threshold = updateFields.first_response_time_threshold;
            if (updateFields.next_response_time_threshold) body.next_response_time_threshold = updateFields.next_response_time_threshold;
            if (updateFields.resolution_time_threshold) body.resolution_time_threshold = updateFields.resolution_time_threshold;
            if (updateFields.only_during_business_hours !== undefined) body.only_during_business_hours = updateFields.only_during_business_hours;
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/sla_policies/${slaPolicyId}`, body, {}, { itemIndex: i });
          } else if (operation === 'delete') {
            const slaPolicyId = validateId(this.getNodeParameter('slaPolicyId', i), 'SLA Policy ID');
            await chatwootApiRequest.call(this, 'DELETE', `/sla_policies/${slaPolicyId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: slaPolicyId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // APPLIED SLA (Enterprise)
        // =====================================================================
        else if (resource === 'appliedSla') {
          // Premium 'sla' feature + administrator. index/metrics/download share the same filters;
          // index lists only breaches (missed / active_with_misses) with meta.count, 25 per page.
          const options = this.getNodeParameter('options', i, {}) as IDataObject;
          const qs: IDataObject = {};
          const since = toUnixSeconds(options.since, 'Since');
          const until = toUnixSeconds(options.until, 'Until');
          if (since !== undefined) qs.since = since;
          if (until !== undefined) qs.until = until;
          if (options.inbox_id) qs.inbox_id = options.inbox_id;
          if (options.team_id) qs.team_id = options.team_id;
          if (options.sla_policy_id) qs.sla_policy_id = options.sla_policy_id;
          if (options.assigned_agent_id) qs.assigned_agent_id = options.assigned_agent_id;
          // Matched with LIKE '%label%' against the conversation's cached label list: a single string
          if (options.label_list) qs.label_list = String(options.label_list).trim();

          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/applied_slas', {}, qs, 'payload', {
              limit,
              pageSize: 25,
              itemIndex: i,
            });
          } else if (operation === 'metrics') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/applied_slas/metrics', {}, qs, { itemIndex: i });
          } else if (operation === 'download') {
            const csv = await chatwootApiRequest.call(this, 'GET', '/applied_slas/download', {}, qs, {
              itemIndex: i,
              json: false,
              encoding: 'text',
            });
            // Written with plain CSV.generate_line (no CSVSafe escaping)
            returnData.push(...(await buildCsvOutput.call(this, i, csv, { fileName: 'breached_conversation.csv', headerRow: 0 })));
            continue;
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // LIVE REPORT (v2 — real-time conversation metrics)
        // =====================================================================
        else if (resource === 'liveReport') {
          if (operation === 'conversationMetrics') {
            const options = this.getNodeParameter('options', i, {}) as IDataObject;
            const qs: IDataObject = {};
            if (options.team_id) qs.team_id = options.team_id;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/live_reports/conversation_metrics', {}, qs, { itemIndex: i });
          } else if (operation === 'groupedConversationMetrics') {
            const groupBy = this.getNodeParameter('groupBy', i) as string;
            const options = this.getNodeParameter('options', i, {}) as IDataObject;
            const qs: IDataObject = { group_by: groupBy };
            if (options.team_id) qs.team_id = options.team_id;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/live_reports/grouped_conversation_metrics', {}, qs, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // SUMMARY REPORT (v2 — per-entity summary metrics)
        // =====================================================================
        else if (resource === 'summaryReport') {
          // Integer Unix seconds; an empty or invalid date fails here instead of sending NaN
          const since = toUnixSeconds(this.getNodeParameter('since', i), 'Since');
          const until = toUnixSeconds(this.getNodeParameter('until', i), 'Until');
          if (since === undefined || until === undefined) {
            throw new NodeOperationError(this.getNode(), 'Since and Until are required', { itemIndex: i });
          }
          const options = this.getNodeParameter('options', i, {}) as IDataObject;
          const qs: IDataObject = { since, until };
          if (options.business_hours !== undefined) qs.business_hours = options.business_hours;

          // Operation maps directly to endpoint segment: agent, team, inbox, label, channel
          if (['agent', 'team', 'inbox', 'label', 'channel'].includes(operation)) {
            responseData = await chatwootApiV2Request.call(this, 'GET', `/summary_reports/${operation}`, {}, qs, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PLATFORM API: ACCOUNT
        // =====================================================================
        else if (resource === 'platformAccount') {
          // custom_attributes and limits replace the stored objects; features only toggle the listed keys.
          // Chatwoot enables a feature for any present value (even the string "false"), so send booleans.
          // Chatwoot silently drops a custom_attributes/limits/features value that is not an object (permit(x: {})).
          const jsonObjectFields: Record<string, string> = {
            custom_attributes: 'Custom Attributes must be a JSON object, e.g. {"plan": "pro"}',
            features: 'Features must be a JSON object of booleans, e.g. {"help_center": true, "campaigns": false}',
            limits: 'Limits must be a JSON object, e.g. {"agents": 5, "inboxes": 3}',
          };
          const toAccountBody = (fields: IDataObject): IDataObject => {
            const body: IDataObject = { ...fields };
            for (const [key, message] of Object.entries(jsonObjectFields)) {
              if (body[key] === undefined) continue;
              const value = parseJsonSafe(body[key], key) as unknown;
              if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                throw new NodeOperationError(this.getNode(), message, { itemIndex: i });
              }
              body[key] = value as IDataObject;
            }
            if (body.features !== undefined) {
              body.features = Object.fromEntries(
                Object.entries(body.features as IDataObject).map(([feature, enabled]) => [
                  feature,
                  enabled === true || enabled === 'true' || enabled === 1 || enabled === '1',
                ]),
              );
            }
            return body;
          };
          // An unknown feature name is an unhandled NoMethodError in Chatwoot (enable_features): a bare 500
          const withFeaturesHint = (error: unknown, prefix = '') => {
            if (error instanceof NodeApiError || error instanceof NodeOperationError) {
              const hint =
                getHttpStatus(error) === 500
                  ? 'Chatwoot answers 500 when a feature name does not exist in this Chatwoot version (names come from its config/features.yml, e.g. help_center, campaigns, crm).'
                  : '';
              error.description = [prefix, hint, error.description].filter(Boolean).join(' ');
            }
            return error;
          };
          const hasFeatures = (body: IDataObject) =>
            body.features !== undefined && Object.keys(body.features as IDataObject).length > 0;

          if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            // Chatwoot saves the new account BEFORE applying `features` and only links it to this Platform App
            // afterwards, so an unknown feature name in the POST would leave an account the app can never
            // read or delete. The features are therefore applied by a second request to the created account.
            const { features, ...body } = toAccountBody({ ...additionalFields, name });
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', '/accounts', body, {}, { itemIndex: i });
            if (hasFeatures({ features })) {
              const createdId = validateId((responseData as IDataObject).id, 'Created account ID');
              try {
                responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/accounts/${createdId}`, { features }, {}, { itemIndex: i });
              } catch (error) {
                throw withFeaturesHint(
                  error,
                  `Account ${createdId} was created, but its features could not be set: fix them with Update on that account.`,
                );
              }
            }
          } else if (operation === 'get') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/accounts/${accountId}`, {}, {}, { itemIndex: i });
          } else if (operation === 'getAll') {
            // Only the accounts of this Platform App; the endpoint is not paginated
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', '/accounts', {}, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body = toAccountBody(updateFields);
            try {
              responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/accounts/${accountId}`, body, {}, { itemIndex: i });
            } catch (error) {
              // Nothing is saved in that case: Chatwoot fails before save!
              throw hasFeatures(body) ? withFeaturesHint(error) : error;
            }
          } else if (operation === 'delete') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/accounts/${accountId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: accountId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PLATFORM API: USER
        // =====================================================================
        else if (resource === 'platformUser') {
          if (operation === 'create') {
            const email = this.getNodeParameter('email', i) as string;
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { email, name };
            if (additionalFields.password) body.password = additionalFields.password;
            if (additionalFields.display_name) body.display_name = additionalFields.display_name;
            if (additionalFields.custom_attributes) {
              body.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
            }
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', '/users', body, {}, { itemIndex: i });
          } else if (operation === 'get') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/users/${userId}`, {}, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            if (updateFields.custom_attributes) {
              updateFields.custom_attributes = parseJsonSafe(updateFields.custom_attributes, 'custom_attributes');
            }
            responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/users/${userId}`, updateFields, {}, { itemIndex: i });
          } else if (operation === 'delete') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/users/${userId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: userId };
          } else if (operation === 'getSsoUrl') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/users/${userId}/login`, {}, {}, { itemIndex: i });
          } else if (operation === 'getToken') {
            // Returns { access_token, expiry, user }; the existing token is returned, not rotated
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', `/users/${userId}/token`, {}, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PLATFORM API: ACCOUNT USER
        // =====================================================================
        else if (resource === 'accountUser') {
          if (operation === 'getAll') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/accounts/${accountId}/account_users`, {}, {}, { itemIndex: i });
          } else if (operation === 'create') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            const role = this.getNodeParameter('role', i) as string;

            // Upsert: an existing membership only gets its role updated
            const body: IDataObject = { user_id: userId, role };
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', `/accounts/${accountId}/account_users`, body, {}, { itemIndex: i });
          } else if (operation === 'delete') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');

            // The user_id travels in the DELETE body (collection route); Chatwoot answers 200 even for non-members
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/accounts/${accountId}/account_users`, { user_id: userId }, {}, { itemIndex: i });
            responseData = { success: true, accountId, userId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PLATFORM API: AGENT BOT (resource value kept as 'accountAgentBot')
        // =====================================================================
        else if (resource === 'accountAgentBot') {
          // Platform agent bots are top-level (/platform/api/v1/agent_bots): the account is just the bot's
          // account_id. 'accountId' filters Get Many and is an optional ownership check elsewhere (0 = none).
          // Only an explicit 0 means "no account": an expression that resolves to nothing ('', null, NaN)
          // must fail instead of silently creating a global bot (offered to every account) or listing the
          // bots, access tokens included, of every account.
          const toBotAccountId = (value: unknown, field: string): number => {
            if (value === 0 || value === '0') return 0;
            const accountId = Number(value);
            if (value === '' || value === null || !Number.isInteger(accountId) || accountId < 1) {
              throw new NodeOperationError(this.getNode(), `${field} must be a positive integer, or 0 for none`, {
                itemIndex: i,
              });
            }
            return accountId;
          };
          const expectedAccountId = toBotAccountId(this.getNodeParameter('accountId', i, 0), 'Account ID');
          const assertBotAccount = (bot: IDataObject) => {
            if (expectedAccountId > 0 && Number(bot.account_id) !== expectedAccountId) {
              const owner = bot.account_id ? `account ${bot.account_id}` : 'no account (it is a global bot)';
              throw new NodeOperationError(
                this.getNode(),
                `Agent bot ${bot.id} belongs to ${owner}, not to account ${expectedAccountId}`,
                { itemIndex: i, description: 'Set "Expected Account ID" to 0 to skip this check.' },
              );
            }
          };
          const getBot = async (agentBotId: number) =>
            (await chatwootPlatformApiRequest.call(this, 'GET', `/agent_bots/${agentBotId}`, {}, {}, { itemIndex: i })) as IDataObject;

          if (operation === 'getAll') {
            const response = await chatwootPlatformApiRequest.call(this, 'GET', '/agent_bots', {}, {}, { itemIndex: i });
            const bots = Array.isArray(response) ? response : [];
            responseData = expectedAccountId > 0 ? bots.filter((bot) => Number(bot.account_id) === expectedAccountId) : bots;
          } else if (operation === 'get') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            const bot = await getBot(agentBotId);
            assertBotAccount(bot);
            responseData = bot;
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { ...additionalFields, name };
            // 0 creates a global bot (no account_id), offered to every account of the installation
            if (expectedAccountId !== 0) body.account_id = expectedAccountId;
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', '/agent_bots', body, {}, { itemIndex: i });
          } else if (operation === 'update') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            const updateFields = { ...(this.getNodeParameter('updateFields', i) as IDataObject) };

            if (updateFields.account_id !== undefined) {
              // 0 turns the bot into a global bot
              const accountId = toBotAccountId(updateFields.account_id, 'Account ID (update field)');
              updateFields.account_id = accountId === 0 ? null : accountId;
            }
            if (expectedAccountId > 0) assertBotAccount(await getBot(agentBotId));
            responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/agent_bots/${agentBotId}`, updateFields, {}, { itemIndex: i });
          } else if (operation === 'delete') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            if (expectedAccountId > 0) assertBotAccount(await getBot(agentBotId));
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/agent_bots/${agentBotId}`, {}, {}, { itemIndex: i });
            responseData = { success: true, id: agentBotId };
          } else if (operation === 'deleteAvatar') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'DELETE', `/agent_bots/${agentBotId}/avatar`, {}, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PUBLIC API: CONTACT
        // =====================================================================
        else if (resource === 'publicContact') {
          const credentials = await this.getCredentials('chatwootPublicApi', i);
          const inboxIdentifier = encodeURIComponent(String(credentials.inboxIdentifier ?? ''));
          const hmacToken = String(credentials.hmacToken ?? '');
          // Drop empty strings and fill identifier_hash from the credential's HMAC token when needed
          const withIdentity = (fields: IDataObject): IDataObject => {
            const target = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== '')) as IDataObject;
            const problem = applyIdentifierHash(target, hmacToken);
            if (problem) throw new NodeOperationError(this.getNode(), problem, { itemIndex: i });
            if (typeof target.custom_attributes === 'string') {
              target.custom_attributes = parseJsonSafe(target.custom_attributes, 'custom_attributes');
            }
            return target;
          };

          try {
            if (operation === 'create') {
              const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
              responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts`, withIdentity(additionalFields), {}, { itemIndex: i });
            } else if (operation === 'get') {
              const contactIdentifier = contactIdentifierPath(this.getNodeParameter('contactIdentifier', i));
              const identity = withIdentity(this.getNodeParameter('identityValidation', i, {}) as IDataObject);
              responseData = await chatwootPublicApiRequest.call(this, 'GET', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}`, {}, identity, { itemIndex: i });
            } else if (operation === 'update') {
              const contactIdentifier = contactIdentifierPath(this.getNodeParameter('contactIdentifier', i));
              const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
              // Chatwoot 4.16+ answers { source_id, pubsub_token, id, name, email, phone_number } only
              responseData = await chatwootPublicApiRequest.call(this, 'PATCH', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}`, withIdentity(updateFields), {}, { itemIndex: i });
            } else {
              throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
            }
          } catch (error) {
            // A failed identity validation (HMAC) check is an unhandled exception in Chatwoot: a bare 500
            if (error instanceof NodeApiError && getHttpStatus(error) === 500) {
              error.description = [IDENTITY_VALIDATION_HINT, error.description].filter(Boolean).join(' ');
            }
            throw error;
          }
        }

        // =====================================================================
        // PUBLIC API: CONVERSATION
        // =====================================================================
        else if (resource === 'publicConversation') {
          if (operation === 'getCsatSurvey' || operation === 'submitCsatSurvey') {
            // /public/api/v1/csat_survey/{uuid}: keyed by the conversation UUID, no inbox or contact involved
            const conversationUuid = String(this.getNodeParameter('conversationUuid', i) ?? '').trim();
            if (!conversationUuid) {
              throw new NodeOperationError(this.getNode(), 'Conversation UUID is required', { itemIndex: i });
            }
            const endpoint = `/csat_survey/${encodeURIComponent(conversationUuid)}`;
            if (operation === 'getCsatSurvey') {
              responseData = await chatwootPublicApiRequest.call(this, 'GET', endpoint, {}, {}, { itemIndex: i });
            } else {
              const rating = Number(this.getNodeParameter('rating', i));
              if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                throw new NodeOperationError(this.getNode(), 'Rating must be an integer from 1 to 5', { itemIndex: i });
              }
              const feedbackMessage = this.getNodeParameter('feedbackMessage', i, '') as string;
              const csatResponse: IDataObject = { rating };
              if (feedbackMessage) csatResponse.feedback_message = feedbackMessage;
              // Same payload as Chatwoot's own survey page
              const body: IDataObject = { message: { submitted_values: { csat_survey_response: csatResponse } } };
              responseData = await chatwootPublicApiRequest.call(this, 'PUT', endpoint, body, {}, { itemIndex: i });
            }
          } else {
            const credentials = await this.getCredentials('chatwootPublicApi', i);
            const inboxIdentifier = encodeURIComponent(String(credentials.inboxIdentifier ?? ''));
            const contactIdentifier = contactIdentifierPath(this.getNodeParameter('contactIdentifier', i));
            const conversationsEndpoint = `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations`;

            if (operation === 'create') {
              const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

              if (additionalFields.custom_attributes && typeof additionalFields.custom_attributes === 'string') {
                additionalFields.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
              }

              responseData = await chatwootPublicApiRequest.call(this, 'POST', conversationsEndpoint, additionalFields, {}, { itemIndex: i });
            } else if (operation === 'get') {
              const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
              responseData = await chatwootPublicApiRequest.call(this, 'GET', `${conversationsEndpoint}/${conversationId}`, {}, {}, { itemIndex: i });
            } else if (operation === 'getAll') {
              // Not paginated: Chatwoot returns every conversation of the contact inbox (or of the contact once verified)
              responseData = await chatwootPublicApiRequest.call(this, 'GET', conversationsEndpoint, {}, {}, { itemIndex: i });
            } else if (operation === 'resolve') {
              // toggle_status only resolves (no-op when already resolved) and returns the conversation
              const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
              responseData = await chatwootPublicApiRequest.call(this, 'POST', `${conversationsEndpoint}/${conversationId}/toggle_status`, {}, {}, { itemIndex: i });
            } else if (operation === 'toggleTyping') {
              const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
              const typingStatus = this.getNodeParameter('typingStatus', i) as string;

              const body: IDataObject = { typing_status: typingStatus };
              // head :ok
              await chatwootPublicApiRequest.call(this, 'POST', `${conversationsEndpoint}/${conversationId}/toggle_typing`, body, {}, { itemIndex: i });
              responseData = { success: true, conversationId, typingStatus };
            } else if (operation === 'updateLastSeen') {
              // head :ok; also marks the agent messages as read (read receipts)
              const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
              await chatwootPublicApiRequest.call(this, 'POST', `${conversationsEndpoint}/${conversationId}/update_last_seen`, {}, {}, { itemIndex: i });
              responseData = { success: true, conversationId };
            } else {
              throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
            }
          }
        }

        // =====================================================================
        // PUBLIC API: MESSAGE
        // =====================================================================
        else if (resource === 'publicMessage') {
          const credentials = await this.getCredentials('chatwootPublicApi', i);
          const inboxIdentifier = encodeURIComponent(String(credentials.inboxIdentifier ?? ''));
          const contactIdentifier = contactIdentifierPath(this.getNodeParameter('contactIdentifier', i));
          const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
          const messagesEndpoint = `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/messages`;

          if (operation === 'create') {
            const content = this.getNodeParameter('content', i, '') as string;
            const { binaryPropertyName, ...additionalFields } = this.getNodeParameter('additionalFields', i) as IDataObject;
            const binaryPropertyNames = String(binaryPropertyName ?? '')
              .split(',')
              .map((name) => name.trim())
              .filter(Boolean);

            if (!content && binaryPropertyNames.length === 0) {
              throw new NodeOperationError(this.getNode(), 'Content is required unless attachments are sent', { itemIndex: i });
            }

            if (binaryPropertyNames.length > 0) {
              responseData = await chatwootMultipartRequest.call(
                this,
                'POST',
                messagesEndpoint,
                i,
                {
                  fields: { content: content || undefined, echo_id: (additionalFields.echo_id as string) || undefined },
                  files: binaryPropertyNames.map((name) => ({ fieldName: 'attachments[]', binaryPropertyName: name })),
                },
                { api: 'public' },
              );
            } else {
              const body: IDataObject = { content, ...additionalFields };
              responseData = await chatwootPublicApiRequest.call(this, 'POST', messagesEndpoint, body, {}, { itemIndex: i });
            }
          } else if (operation === 'getAll') {
            // Cursor pagination with `before` (20 messages per page); results are oldest first
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
            const options = this.getNodeParameter('options', i, {}) as IDataObject;
            const before = Number(options.before) > 0 ? Number(options.before) : undefined;

            responseData = await chatwootApiRequestAllMessages.call(this, conversationId, limit, {
              api: 'public',
              endpoint: messagesEndpoint,
              before,
              itemIndex: i,
            });
          } else if (operation === 'update') {
            // Chatwoot only permits submitted_values here (the answer to an interactive message)
            const messageId = validateId(this.getNodeParameter('messageId', i), 'Message ID');
            const responseType = this.getNodeParameter('responseType', i, 'option') as string;
            let submittedValues: IDataObject | IDataObject[];

            if (responseType === 'csat') {
              const rating = Number(this.getNodeParameter('csatRating', i));
              if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                throw new NodeOperationError(this.getNode(), 'Rating must be an integer from 1 to 5', { itemIndex: i });
              }
              const feedbackMessage = this.getNodeParameter('csatFeedbackMessage', i, '') as string;
              const csatResponse: IDataObject = { rating };
              if (feedbackMessage) csatResponse.feedback_message = feedbackMessage;
              submittedValues = { csat_survey_response: csatResponse };
            } else if (responseType === 'form') {
              const formValues = this.getNodeParameter('formValues', i, {}) as IDataObject;
              submittedValues = ((formValues.values as IDataObject[] | undefined) ?? [])
                .filter((entry) => entry.name)
                .map((entry) => ({ name: entry.name, value: entry.value ?? '' }));
              if (submittedValues.length === 0) {
                throw new NodeOperationError(this.getNode(), 'Add at least one form value with a field name', { itemIndex: i });
              }
            } else if (responseType === 'json') {
              const parsed = parseJsonSafe(this.getNodeParameter('submittedValues', i), 'submittedValues') as unknown;
              if (parsed === null || typeof parsed !== 'object') {
                throw new NodeOperationError(this.getNode(), 'Submitted Values must be a JSON object or array', { itemIndex: i });
              }
              submittedValues = parsed as IDataObject | IDataObject[];
            } else {
              // 'option', also the value for workflows saved before 0.9.0: their Content (always ignored by
              // Chatwoot) is now sent as the selected option, like the widget does for input_select messages
              const title = String(this.getNodeParameter('content', i) ?? '');
              if (!title) {
                throw new NodeOperationError(this.getNode(), 'Selected Option Title is required', { itemIndex: i });
              }
              const value = (this.getNodeParameter('optionValue', i, '') as string) || title;
              submittedValues = [{ title, value }];
            }

            responseData = await chatwootPublicApiRequest.call(this, 'PATCH', `${messagesEndpoint}/${messageId}`, { submitted_values: submittedValues }, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PUBLIC API: INBOX
        // =====================================================================
        else if (resource === 'publicInbox') {
          if (operation === 'get') {
            const credentials = await this.getCredentials('chatwootPublicApi', i);
            const inboxIdentifier = encodeURIComponent(String(credentials.inboxIdentifier ?? ''));
            responseData = await chatwootPublicApiRequest.call(this, 'GET', `/inboxes/${inboxIdentifier}`, {}, {}, { itemIndex: i });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        } else {
          throw new NodeOperationError(this.getNode(), `Resource "${resource}" is not supported`, { itemIndex: i });
        }

        // Format output
        const executionData = this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray(responseData as IDataObject | IDataObject[]),
          { itemData: { item: i } },
        );

        returnData.push(...executionData);
      } catch (error) {
        // Wrap plain errors (e.g. validateId) and make sure every error points at its item
        const nodeError =
          error instanceof NodeApiError || error instanceof NodeOperationError
            ? error
            : new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
        if (nodeError.context.itemIndex === undefined) nodeError.context.itemIndex = i;

        if (this.continueOnFail()) {
          const errorJson: IDataObject = { error: nodeError.message };
          if (nodeError.description) errorJson.description = nodeError.description;
          const httpStatus = getHttpStatus(nodeError);
          if (httpStatus) errorJson.httpCode = String(httpStatus);
          const executionData = this.helpers.constructExecutionMetaData(
            this.helpers.returnJsonArray(errorJson),
            { itemData: { item: i } },
          );
          returnData.push(...executionData);
          continue;
        }
        throw nodeError;
      }
    }

    return [returnData];
  }
}
