import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
  chatwootApiRequest,
  chatwootApiV2Request,
  chatwootApiRequestAllItems,
  chatwootApiRequestAllMessages,
  chatwootPlatformApiRequest,
  chatwootPublicApiRequest,
  getHttpStatus,
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
import { reportOperations, reportFields } from './resources/report';
import { profileOperations, profileFields } from './resources/profile';
import { helpCenterOperations, helpCenterFields } from './resources/helpCenter';
import { integrationOperations, integrationFields } from './resources/integration';
import { auditLogOperations, auditLogFields } from './resources/auditLog';
import { csatSurveyOperations, csatSurveyFields } from './resources/csatSurvey';
import { macroOperations, macroFields } from './resources/macro';
import { notificationOperations, notificationFields } from './resources/notification';
import { campaignOperations, campaignFields } from './resources/campaign';
import { contactNoteOperations, contactNoteFields } from './resources/contactNote';
import { conversationParticipantOperations, conversationParticipantFields } from './resources/conversationParticipant';
import { companyOperations, companyFields } from './resources/company';
import { searchOperations as globalSearchOperations, searchFields as globalSearchFields } from './resources/search';
import { slaPolicyOperations, slaPolicyFields } from './resources/slaPolicy';
import { appliedSlaOperations, appliedSlaFields } from './resources/appliedSla';
import { liveReportOperations, liveReportFields } from './resources/liveReport';
import { summaryReportOperations, summaryReportFields } from './resources/summaryReport';

// Platform API Resource imports
import { platformAccountOperations, platformAccountFields } from './resources/platformAccount';
import { platformUserOperations, platformUserFields } from './resources/platformUser';
import { accountUserOperations, accountUserFields } from './resources/accountUser';
import { accountAgentBotOperations, accountAgentBotFields } from './resources/accountAgentBot';

// Public API Resource imports
import { publicContactOperations, publicContactFields } from './resources/publicContact';
import { publicConversationOperations, publicConversationFields } from './resources/publicConversation';
import { publicMessageOperations, publicMessageFields } from './resources/publicMessage';

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
            resource: ['publicContact', 'publicConversation', 'publicMessage'],
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
            responseData = await chatwootApiRequest.call(this, 'GET', '');
          } else if (operation === 'update') {
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const body: IDataObject = {};

            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.locale) body.locale = updateFields.locale;
            if (updateFields.domain) body.domain = updateFields.domain;
            if (updateFields.support_email) body.support_email = updateFields.support_email;
            if (updateFields.auto_resolve_duration !== undefined) {
              body.auto_resolve_duration = updateFields.auto_resolve_duration;
            }

            responseData = await chatwootApiRequest.call(this, 'PATCH', '', body);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AGENT
        // =====================================================================
        else if (resource === 'agent') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/agents');
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const email = this.getNodeParameter('email', i) as string;
            const role = this.getNodeParameter('role', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name, email, role };

            if (additionalFields.availability_status) {
              body.availability_status = additionalFields.availability_status;
            }
            if (additionalFields.auto_offline !== undefined) {
              body.auto_offline = additionalFields.auto_offline;
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/agents', body);
          } else if (operation === 'update') {
            const agentId = validateId(this.getNodeParameter('agentId', i), 'Agent ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.role) body.role = updateFields.role;
            if (updateFields.availability_status) body.availability_status = updateFields.availability_status;
            if (updateFields.auto_offline !== undefined) body.auto_offline = updateFields.auto_offline;

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/agents/${agentId}`, body);
          } else if (operation === 'delete') {
            const agentId = validateId(this.getNodeParameter('agentId', i), 'Agent ID');
            await chatwootApiRequest.call(this, 'DELETE', `/agents/${agentId}`);
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
            responseData = await chatwootApiRequest.call(this, 'GET', '/teams');
          } else if (operation === 'get') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/teams/${teamId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.allow_auto_assign !== undefined) {
              body.allow_auto_assign = additionalFields.allow_auto_assign;
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/teams', body);
          } else if (operation === 'update') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.description) body.description = updateFields.description;
            if (updateFields.allow_auto_assign !== undefined) body.allow_auto_assign = updateFields.allow_auto_assign;

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/teams/${teamId}`, body);
          } else if (operation === 'delete') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            await chatwootApiRequest.call(this, 'DELETE', `/teams/${teamId}`);
            responseData = { success: true, id: teamId };
          } else if (operation === 'addAgent') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'POST', `/teams/${teamId}/team_members`, body);
          } else if (operation === 'deleteAgent') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'DELETE', `/teams/${teamId}/team_members`, body);
          } else if (operation === 'getMembers') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/teams/${teamId}/team_members`);
          } else if (operation === 'updateAgents') {
            const teamId = validateId(this.getNodeParameter('teamId', i), 'Team ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/teams/${teamId}/team_members`, body);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // INBOX
        // =====================================================================
        else if (resource === 'inbox') {
          if (operation === 'getAll') {
            const response = await chatwootApiRequest.call(this, 'GET', '/inboxes');
            responseData = ((response as IDataObject).payload || response) as IDataObject[];
          } else if (operation === 'get') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/inboxes/${inboxId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const channelType = this.getNodeParameter('channelType', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name };
            const channel: IDataObject = { type: channelType };

            if (channelType === 'web_widget') {
              if (additionalFields.website_url) channel.website_url = additionalFields.website_url;
              if (additionalFields.welcome_title) channel.welcome_title = additionalFields.welcome_title;
              if (additionalFields.welcome_tagline) channel.welcome_tagline = additionalFields.welcome_tagline;
            }

            body.channel = channel;
            responseData = await chatwootApiRequest.call(this, 'POST', '/inboxes', body);
          } else if (operation === 'update') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = { ...updateFields };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/inboxes/${inboxId}`, body);
          } else if (operation === 'addAgent') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'POST', `/inbox_members/${inboxId}`, body);
          } else if (operation === 'deleteAgent') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const userIdsStr = this.getNodeParameter('userIds', i) as string;
            const userIds = userIdsStr.split(',').map((id) => parseInt(id.trim(), 10));

            const body: IDataObject = { user_ids: userIds };
            responseData = await chatwootApiRequest.call(this, 'DELETE', `/inbox_members/${inboxId}`, body);
          } else if (operation === 'getMembers') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/inbox_members/${inboxId}`);
          } else if (operation === 'getAgentBot') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/inboxes/${inboxId}/agent_bot`);
          } else if (operation === 'setAgentBot') {
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const agentBotId = this.getNodeParameter('agentBotId', i) as number;

            const body: IDataObject = { agent_bot: agentBotId || null };
            responseData = await chatwootApiRequest.call(this, 'POST', `/inboxes/${inboxId}/set_agent_bot`, body);
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
          if (operation === 'getAll') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.search) qs.search = options.search;

            responseData = await chatwootApiRequest.call(this, 'GET', '/canned_responses', {}, qs);
          } else if (operation === 'create') {
            const shortCode = this.getNodeParameter('shortCode', i) as string;
            const content = this.getNodeParameter('content', i) as string;

            const body: IDataObject = { short_code: shortCode, content };
            responseData = await chatwootApiRequest.call(this, 'POST', '/canned_responses', body);
          } else if (operation === 'update') {
            const cannedResponseId = validateId(this.getNodeParameter('cannedResponseId', i), 'Canned Response ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = { ...updateFields };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/canned_responses/${cannedResponseId}`, body);
          } else if (operation === 'delete') {
            const cannedResponseId = validateId(this.getNodeParameter('cannedResponseId', i), 'Canned Response ID');
            await chatwootApiRequest.call(this, 'DELETE', `/canned_responses/${cannedResponseId}`);
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
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/webhooks');
          } else if (operation === 'create') {
            const url = this.getNodeParameter('url', i) as string;
            const subscriptions = this.getNodeParameter('subscriptions', i) as string[];

            const body: IDataObject = { url, subscriptions };
            responseData = await chatwootApiRequest.call(this, 'POST', '/webhooks', body);
          } else if (operation === 'update') {
            const webhookId = validateId(this.getNodeParameter('webhookId', i), 'Webhook ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = { ...updateFields };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/webhooks/${webhookId}`, body);
          } else if (operation === 'delete') {
            const webhookId = validateId(this.getNodeParameter('webhookId', i), 'Webhook ID');
            await chatwootApiRequest.call(this, 'DELETE', `/webhooks/${webhookId}`);
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
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/agent_bots');
          } else if (operation === 'get') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/agent_bots/${agentBotId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.outgoing_url) body.outgoing_url = additionalFields.outgoing_url;

            responseData = await chatwootApiRequest.call(this, 'POST', '/agent_bots', body);
          } else if (operation === 'update') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = { ...updateFields };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/agent_bots/${agentBotId}`, body);
          } else if (operation === 'delete') {
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            await chatwootApiRequest.call(this, 'DELETE', `/agent_bots/${agentBotId}`);
            responseData = { success: true, id: agentBotId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AUTOMATION RULE
        // =====================================================================
        else if (resource === 'automationRule') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/automation_rules');
          } else if (operation === 'get') {
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/automation_rules/${automationRuleId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const eventName = this.getNodeParameter('eventName', i) as string;
            const conditions = parseJsonSafe(this.getNodeParameter('conditions', i), 'conditions');
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

            responseData = await chatwootApiRequest.call(this, 'POST', '/automation_rules', body);
          } else if (operation === 'update') {
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.description) body.description = updateFields.description;
            if (updateFields.active !== undefined) body.active = updateFields.active;
            if (updateFields.conditions) body.conditions = parseJsonSafe(updateFields.conditions, 'conditions');
            if (updateFields.actions) body.actions = parseJsonSafe(updateFields.actions, 'actions');

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/automation_rules/${automationRuleId}`, body);
          } else if (operation === 'delete') {
            const automationRuleId = validateId(this.getNodeParameter('automationRuleId', i), 'Automation Rule ID');
            await chatwootApiRequest.call(this, 'DELETE', `/automation_rules/${automationRuleId}`);
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
          // Helper: convert dateTime to unix timestamp
          const toUnix = (val: string): number => Math.floor(new Date(val).getTime() / 1000);

          // Helper: build qs from since/until + options collection
          const buildQs = (extra: IDataObject = {}): IDataObject => {
            const qs: IDataObject = { ...extra };
            const sinceVal = this.getNodeParameter('since', i, '') as string;
            const untilVal = this.getNodeParameter('until', i, '') as string;
            if (sinceVal) qs.since = toUnix(sinceVal);
            if (untilVal) qs.until = toUnix(untilVal);
            const opts = this.getNodeParameter('options', i, {}) as IDataObject;
            if (opts.id) qs.id = opts.id;
            if (opts.group_by) qs.group_by = opts.group_by;
            if (opts.timezone_offset !== undefined) qs.timezone_offset = opts.timezone_offset;
            if (opts.business_hours !== undefined) qs.business_hours = opts.business_hours;
            if (opts.days_before) qs.days_before = opts.days_before;
            if (opts.user_id) qs.user_id = opts.user_id;
            if (opts.inbox_ids) qs['inbox_ids[]'] = (opts.inbox_ids as string).split(',').map((v) => parseInt(v.trim(), 10));
            if (opts.label_ids) qs['label_ids[]'] = (opts.label_ids as string).split(',').map((v) => parseInt(v.trim(), 10));
            return qs;
          };

          if (operation === 'accountSummary') {
            const type = this.getNodeParameter('type', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/summary', {}, buildQs({ type }));
          } else if (operation === 'timeseries') {
            const type = this.getNodeParameter('type', i) as string;
            const metric = this.getNodeParameter('metric', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports', {}, buildQs({ type, metric }));
          } else if (operation === 'botSummary') {
            const type = this.getNodeParameter('type', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/bot_summary', {}, buildQs({ type }));
          } else if (operation === 'botMetrics') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/bot_metrics', {}, buildQs());
          } else if (operation === 'agentStatistics') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/agents', {}, buildQs());
          } else if (operation === 'inboxStatistics') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/inboxes', {}, buildQs());
          } else if (operation === 'labelStatistics') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/labels', {}, buildQs());
          } else if (operation === 'teamStatistics') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/teams', {}, buildQs());
          } else if (operation === 'conversationStatistics') {
            const conversationType = this.getNodeParameter('conversationType', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/conversations', {}, buildQs({ type: conversationType }));
          } else if (operation === 'conversationsSummary') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/conversations_summary', {}, buildQs());
          } else if (operation === 'conversationTraffic') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/conversation_traffic', {}, buildQs());
          } else if (operation === 'inboxLabelMatrix') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/inbox_label_matrix', {}, buildQs());
          } else if (operation === 'firstResponseTimeDistribution') {
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/first_response_time_distribution', {}, buildQs());
          } else if (operation === 'outgoingMessagesCount') {
            const groupBy = this.getNodeParameter('groupBy', i) as string;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/reports/outgoing_messages_count', {}, buildQs({ group_by: groupBy }));
          } else if (operation === 'yearInReview') {
            const year = this.getNodeParameter('year', i) as number;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/year_in_review', {}, { year });
          } else if (operation === 'conversationCounts') {
            // Note: this stays on v1 because /conversations/meta is a v1 endpoint
            responseData = await chatwootApiRequest.call(this, 'GET', '/conversations/meta');
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PROFILE
        // =====================================================================
        else if (resource === 'profile') {
          if (operation === 'fetch') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/profile');
          } else if (operation === 'update') {
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.email) body.email = updateFields.email;
            if (updateFields.availability) body.availability = updateFields.availability;
            if (updateFields.auto_offline !== undefined) body.auto_offline = updateFields.auto_offline;
            responseData = await chatwootApiRequest.call(this, 'PUT', '/profile', body);
          } else if (operation === 'availability') {
            const availability = this.getNodeParameter('availability', i) as string;
            responseData = await chatwootApiRequest.call(this, 'POST', '/profile/availability', { availability });
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
          if (operation === 'createPortal') {
            const name = this.getNodeParameter('name', i) as string;
            const slug = this.getNodeParameter('slug', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { portal: { name, slug, ...additionalFields } };
            responseData = await chatwootApiRequest.call(this, 'POST', '/portals', body);
          } else if (operation === 'getPortal') {
            const portalSlug = this.getNodeParameter('portalSlug', i) as string;
            responseData = await chatwootApiRequest.call(this, 'GET', `/portals/${portalSlug}`);
          } else if (operation === 'updatePortal') {
            const portalSlug = this.getNodeParameter('portalSlug', i) as string;
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = { portal: updateFields };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/portals/${portalSlug}`, body);
          } else if (operation === 'createCategory') {
            const portalSlug = this.getNodeParameter('portalSlug', i) as string;
            const name = this.getNodeParameter('name', i) as string;
            const slug = this.getNodeParameter('slug', i) as string;
            const locale = this.getNodeParameter('locale', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { category: { name, slug, locale, ...additionalFields } };
            responseData = await chatwootApiRequest.call(this, 'POST', `/portals/${portalSlug}/categories`, body);
          } else if (operation === 'createArticle') {
            const portalSlug = this.getNodeParameter('portalSlug', i) as string;
            const title = this.getNodeParameter('title', i) as string;
            const content = this.getNodeParameter('content', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { article: { title, content, ...additionalFields } };
            responseData = await chatwootApiRequest.call(this, 'POST', `/portals/${portalSlug}/articles`, body);
          } else if (operation === 'listPortals') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/portals');
          } else if (operation === 'listCategories') {
            const portalSlug = this.getNodeParameter('portalSlug', i) as string;
            const locale = this.getNodeParameter('locale', i, 'en') as string;
            const qs: IDataObject = {};
            if (locale) qs.locale = locale;
            responseData = await chatwootApiRequest.call(this, 'GET', `/portals/${portalSlug}/categories`, {}, qs);
          } else if (operation === 'listArticles') {
            const portalSlug = this.getNodeParameter('portalSlug', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const options = this.getNodeParameter('options', i) as IDataObject;

            const qs: IDataObject = {};
            if (options.locale) qs.locale = options.locale;
            if (options.category_slug) qs.category_slug = options.category_slug;
            if (options.status) qs.status = options.status;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', `/portals/${portalSlug}/articles`, {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', `/portals/${portalSlug}/articles`, {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
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
            responseData = await chatwootApiRequest.call(this, 'GET', '/integrations/apps');
          } else if (operation === 'createHook') {
            const appId = this.getNodeParameter('appId', i) as string;
            const inboxId = validateId(this.getNodeParameter('inboxId', i), 'Inbox ID');
            const settings = parseJsonSafe(this.getNodeParameter('settings', i), 'settings');

            const body: IDataObject = { app_id: appId, inbox_id: inboxId, settings };
            responseData = await chatwootApiRequest.call(this, 'POST', '/integrations/hooks', body);
          } else if (operation === 'updateHook') {
            const hookId = validateId(this.getNodeParameter('hookId', i), 'Hook ID');
            const settings = parseJsonSafe(this.getNodeParameter('settings', i), 'settings');

            const body: IDataObject = { settings };
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/integrations/hooks/${hookId}`, body);
          } else if (operation === 'deleteHook') {
            const hookId = validateId(this.getNodeParameter('hookId', i), 'Hook ID');
            await chatwootApiRequest.call(this, 'DELETE', `/integrations/hooks/${hookId}`);
            responseData = { success: true, id: hookId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // AUDIT LOG
        // =====================================================================
        else if (resource === 'auditLog') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const filters = this.getNodeParameter('filters', i) as IDataObject;
            const qs: IDataObject = {};

            if (filters.auditable_type) qs.auditable_type = filters.auditable_type;
            if (filters.user_id) qs.user_id = filters.user_id;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/audit_logs', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/audit_logs', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CSAT SURVEY
        // =====================================================================
        else if (resource === 'csatSurvey') {
          if (operation === 'get') {
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootApiRequest.call(this, 'GET', '/csat_survey_responses', {}, { conversation_id: conversationId });
          } else if (operation === 'metrics') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.since) qs.since = new Date(options.since as string).getTime() / 1000;
            if (options.until) qs.until = new Date(options.until as string).getTime() / 1000;
            responseData = await chatwootApiRequest.call(this, 'GET', '/csat_survey_responses/metrics', {}, qs);
          } else if (operation === 'download') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.since) qs.since = new Date(options.since as string).getTime() / 1000;
            if (options.until) qs.until = new Date(options.until as string).getTime() / 1000;
            responseData = await chatwootApiRequest.call(this, 'GET', '/csat_survey_responses/download', {}, qs);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // MACRO
        // =====================================================================
        else if (resource === 'macro') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/macros');
          } else if (operation === 'get') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/macros/${macroId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const actions = this.getNodeParameter('actions', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = {
              name,
              actions: parseJsonSafe(actions, 'actions'),
            };
            if (additionalFields.visibility) body.visibility = additionalFields.visibility;

            responseData = await chatwootApiRequest.call(this, 'POST', '/macros', body);
          } else if (operation === 'update') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.visibility) body.visibility = updateFields.visibility;
            if (updateFields.actions) {
              body.actions = parseJsonSafe(updateFields.actions, 'actions');
            }

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/macros/${macroId}`, body);
          } else if (operation === 'delete') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            await chatwootApiRequest.call(this, 'DELETE', `/macros/${macroId}`);
            responseData = { success: true, id: macroId };
          } else if (operation === 'execute') {
            const macroId = validateId(this.getNodeParameter('macroId', i), 'Macro ID');
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');

            const body: IDataObject = { conversation_ids: [conversationId] };
            responseData = await chatwootApiRequest.call(this, 'POST', `/macros/${macroId}/execute`, body);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // NOTIFICATION
        // =====================================================================
        else if (resource === 'notification') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const options = this.getNodeParameter('options', i) as IDataObject;

            const qs: IDataObject = {};
            const includes: string[] = [];
            if (options.includes_read) includes.push('read');
            if (options.includes_snoozed) includes.push('snoozed');
            if (includes.length > 0) qs['includes[]'] = includes;
            if (options.sort_order) qs.sort_order = options.sort_order;

            if (returnAll) {
              const allItems: IDataObject[] = [];
              let page = 1;
              let hasMore = true;
              while (hasMore) {
                qs.page = page;
                const result = (await chatwootApiRequest.call(this, 'GET', '/notifications', {}, qs)) as IDataObject;
                const data = result.data as IDataObject;
                const payload = (data?.payload || []) as IDataObject[];
                allItems.push(...payload);
                // Chatwoot notifications are 15/page — stop when we get fewer than a full page
                hasMore = payload.length >= 15;
                page += 1;
                if (page > 100) break;
              }
              responseData = allItems;
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/notifications', {}, qs)) as IDataObject;
              const data = result.data as IDataObject;
              const payload = (data?.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'markRead') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/notifications/${notificationId}`);
          } else if (operation === 'delete') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            await chatwootApiRequest.call(this, 'DELETE', `/notifications/${notificationId}`);
            responseData = { success: true, id: notificationId };
          } else if (operation === 'readAll') {
            responseData = await chatwootApiRequest.call(this, 'POST', '/notifications/read_all');
          } else if (operation === 'unreadCount') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/notifications/unread_count');
          } else if (operation === 'markUnread') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            responseData = await chatwootApiRequest.call(this, 'POST', `/notifications/${notificationId}/unread`);
          } else if (operation === 'snooze') {
            const notificationId = validateId(this.getNodeParameter('notificationId', i), 'Notification ID');
            const snoozedUntil = this.getNodeParameter('snoozedUntil', i) as string;
            responseData = await chatwootApiRequest.call(this, 'POST', `/notifications/${notificationId}/snooze`, {
              snoozed_until: snoozedUntil,
            });
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // CAMPAIGN
        // =====================================================================
        else if (resource === 'campaign') {
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/campaigns');
          } else if (operation === 'get') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/campaigns/${campaignId}`);
          } else if (operation === 'create') {
            const title = this.getNodeParameter('title', i) as string;
            const message = this.getNodeParameter('message', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { title, message };
            if (additionalFields.inbox_id) body.inbox_id = additionalFields.inbox_id;
            if (additionalFields.scheduled_at) body.scheduled_at = additionalFields.scheduled_at;
            if (additionalFields.audience) {
              body.audience = parseJsonSafe(additionalFields.audience, 'audience');
            }

            responseData = await chatwootApiRequest.call(this, 'POST', '/campaigns', body);
          } else if (operation === 'update') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            const body: IDataObject = {};
            if (updateFields.title) body.title = updateFields.title;
            if (updateFields.message) body.message = updateFields.message;
            if (updateFields.scheduled_at) body.scheduled_at = updateFields.scheduled_at;

            responseData = await chatwootApiRequest.call(this, 'PATCH', `/campaigns/${campaignId}`, body);
          } else if (operation === 'delete') {
            const campaignId = validateId(this.getNodeParameter('campaignId', i), 'Campaign ID');
            await chatwootApiRequest.call(this, 'DELETE', `/campaigns/${campaignId}`);
            responseData = { success: true, id: campaignId };
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
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.sort) qs.sort = options.sort;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/companies', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/companies', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'get') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/companies/${companyId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
            const body: IDataObject = { name };
            if (additionalFields.domain) body.domain = additionalFields.domain;
            if (additionalFields.description) body.description = additionalFields.description;
            responseData = await chatwootApiRequest.call(this, 'POST', '/companies', body);
          } else if (operation === 'update') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
            const body: IDataObject = {};
            if (updateFields.name) body.name = updateFields.name;
            if (updateFields.domain) body.domain = updateFields.domain;
            if (updateFields.description) body.description = updateFields.description;
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/companies/${companyId}`, body);
          } else if (operation === 'delete') {
            const companyId = validateId(this.getNodeParameter('companyId', i), 'Company ID');
            await chatwootApiRequest.call(this, 'DELETE', `/companies/${companyId}`);
            responseData = { success: true, id: companyId };
          } else if (operation === 'search') {
            const query = this.getNodeParameter('query', i) as string;
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const qs: IDataObject = { q: query };

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/companies/search', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/companies/search', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
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
          if (operation === 'getAll') {
            responseData = await chatwootApiRequest.call(this, 'GET', '/sla_policies');
          } else if (operation === 'get') {
            const slaPolicyId = validateId(this.getNodeParameter('slaPolicyId', i), 'SLA Policy ID');
            responseData = await chatwootApiRequest.call(this, 'GET', `/sla_policies/${slaPolicyId}`);
          } else if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
            const body: IDataObject = { name };
            if (additionalFields.description) body.description = additionalFields.description;
            if (additionalFields.first_response_time_threshold) body.first_response_time_threshold = additionalFields.first_response_time_threshold;
            if (additionalFields.next_response_time_threshold) body.next_response_time_threshold = additionalFields.next_response_time_threshold;
            if (additionalFields.resolution_time_threshold) body.resolution_time_threshold = additionalFields.resolution_time_threshold;
            if (additionalFields.only_during_business_hours !== undefined) body.only_during_business_hours = additionalFields.only_during_business_hours;
            responseData = await chatwootApiRequest.call(this, 'POST', '/sla_policies', body);
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
            responseData = await chatwootApiRequest.call(this, 'PATCH', `/sla_policies/${slaPolicyId}`, body);
          } else if (operation === 'delete') {
            const slaPolicyId = validateId(this.getNodeParameter('slaPolicyId', i), 'SLA Policy ID');
            await chatwootApiRequest.call(this, 'DELETE', `/sla_policies/${slaPolicyId}`);
            responseData = { success: true, id: slaPolicyId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // APPLIED SLA (Enterprise)
        // =====================================================================
        else if (resource === 'appliedSla') {
          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.since) qs.since = new Date(options.since as string).getTime() / 1000;
            if (options.until) qs.until = new Date(options.until as string).getTime() / 1000;
            if (options.inbox_id) qs.inbox_id = options.inbox_id;
            if (options.team_id) qs.team_id = options.team_id;
            if (options.sla_policy_id) qs.sla_policy_id = options.sla_policy_id;
            if (options.assigned_agent_id) qs.assigned_agent_id = options.assigned_agent_id;

            if (returnAll) {
              responseData = await chatwootApiRequestAllItems.call(this, 'GET', '/applied_slas', {}, qs, 'payload');
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              qs.page = 1;
              const result = (await chatwootApiRequest.call(this, 'GET', '/applied_slas', {}, qs)) as IDataObject;
              const payload = (result.payload || []) as IDataObject[];
              responseData = payload.slice(0, limit);
            }
          } else if (operation === 'metrics') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.since) qs.since = new Date(options.since as string).getTime() / 1000;
            if (options.until) qs.until = new Date(options.until as string).getTime() / 1000;
            responseData = await chatwootApiRequest.call(this, 'GET', '/applied_slas/metrics', {}, qs);
          } else if (operation === 'download') {
            const options = this.getNodeParameter('options', i) as IDataObject;
            const qs: IDataObject = {};
            if (options.since) qs.since = new Date(options.since as string).getTime() / 1000;
            if (options.until) qs.until = new Date(options.until as string).getTime() / 1000;
            responseData = await chatwootApiRequest.call(this, 'GET', '/applied_slas/download', {}, qs);
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
            responseData = await chatwootApiV2Request.call(this, 'GET', '/live_reports/conversation_metrics', {}, qs);
          } else if (operation === 'groupedConversationMetrics') {
            const groupBy = this.getNodeParameter('groupBy', i) as string;
            const options = this.getNodeParameter('options', i, {}) as IDataObject;
            const qs: IDataObject = { group_by: groupBy };
            if (options.team_id) qs.team_id = options.team_id;
            responseData = await chatwootApiV2Request.call(this, 'GET', '/live_reports/grouped_conversation_metrics', {}, qs);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // SUMMARY REPORT (v2 — per-entity summary metrics)
        // =====================================================================
        else if (resource === 'summaryReport') {
          const since = Math.floor(new Date(this.getNodeParameter('since', i) as string).getTime() / 1000);
          const until = Math.floor(new Date(this.getNodeParameter('until', i) as string).getTime() / 1000);
          const options = this.getNodeParameter('options', i, {}) as IDataObject;
          const qs: IDataObject = { since, until };
          if (options.business_hours !== undefined) qs.business_hours = options.business_hours;

          // Operation maps directly to endpoint segment: agent, team, inbox, label, channel
          if (['agent', 'team', 'inbox', 'label', 'channel'].includes(operation)) {
            responseData = await chatwootApiV2Request.call(this, 'GET', `/summary_reports/${operation}`, {}, qs);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PLATFORM API: ACCOUNT
        // =====================================================================
        else if (resource === 'platformAccount') {
          if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name, ...additionalFields };
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', '/accounts', body);
          } else if (operation === 'get') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/accounts/${accountId}`);
          } else if (operation === 'update') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/accounts/${accountId}`, updateFields);
          } else if (operation === 'delete') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/accounts/${accountId}`);
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
            if (additionalFields.custom_attributes) {
              body.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
            }
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', '/users', body);
          } else if (operation === 'get') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/users/${userId}`);
          } else if (operation === 'update') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            if (updateFields.custom_attributes) {
              updateFields.custom_attributes = parseJsonSafe(updateFields.custom_attributes, 'custom_attributes');
            }
            responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/users/${userId}`, updateFields);
          } else if (operation === 'delete') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/users/${userId}`);
            responseData = { success: true, id: userId };
          } else if (operation === 'getSsoUrl') {
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/users/${userId}/login`);
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
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/accounts/${accountId}/account_users`);
          } else if (operation === 'create') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');
            const role = this.getNodeParameter('role', i) as string;

            const body: IDataObject = { user_id: userId, role };
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', `/accounts/${accountId}/account_users`, body);
          } else if (operation === 'delete') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const userId = validateId(this.getNodeParameter('userId', i), 'User ID');

            await chatwootPlatformApiRequest.call(this, 'DELETE', `/accounts/${accountId}/account_users`, { user_id: userId });
            responseData = { success: true, accountId, userId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PLATFORM API: ACCOUNT AGENT BOT
        // =====================================================================
        else if (resource === 'accountAgentBot') {
          if (operation === 'getAll') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/accounts/${accountId}/agent_bots`);
          } else if (operation === 'get') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            responseData = await chatwootPlatformApiRequest.call(this, 'GET', `/accounts/${accountId}/agent_bots/${agentBotId}`);
          } else if (operation === 'create') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const name = this.getNodeParameter('name', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { name, ...additionalFields };
            responseData = await chatwootPlatformApiRequest.call(this, 'POST', `/accounts/${accountId}/agent_bots`, body);
          } else if (operation === 'update') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            responseData = await chatwootPlatformApiRequest.call(this, 'PATCH', `/accounts/${accountId}/agent_bots/${agentBotId}`, updateFields);
          } else if (operation === 'delete') {
            const accountId = validateId(this.getNodeParameter('accountId', i), 'Account ID');
            const agentBotId = validateId(this.getNodeParameter('agentBotId', i), 'Agent Bot ID');
            await chatwootPlatformApiRequest.call(this, 'DELETE', `/accounts/${accountId}/agent_bots/${agentBotId}`);
            responseData = { success: true, id: agentBotId };
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PUBLIC API: CONTACT
        // =====================================================================
        else if (resource === 'publicContact') {
          const credentials = await this.getCredentials('chatwootPublicApi');
          const inboxIdentifier = credentials.inboxIdentifier as string;

          if (operation === 'create') {
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            if (additionalFields.custom_attributes && typeof additionalFields.custom_attributes === 'string') {
              additionalFields.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
            }

            responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts`, additionalFields);
          } else if (operation === 'get') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            responseData = await chatwootPublicApiRequest.call(this, 'GET', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}`);
          } else if (operation === 'update') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

            if (updateFields.custom_attributes && typeof updateFields.custom_attributes === 'string') {
              updateFields.custom_attributes = parseJsonSafe(updateFields.custom_attributes, 'custom_attributes');
            }

            responseData = await chatwootPublicApiRequest.call(this, 'PATCH', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}`, updateFields);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PUBLIC API: CONVERSATION
        // =====================================================================
        else if (resource === 'publicConversation') {
          const credentials = await this.getCredentials('chatwootPublicApi');
          const inboxIdentifier = credentials.inboxIdentifier as string;

          if (operation === 'create') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            if (additionalFields.custom_attributes && typeof additionalFields.custom_attributes === 'string') {
              additionalFields.custom_attributes = parseJsonSafe(additionalFields.custom_attributes, 'custom_attributes');
            }

            responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations`, additionalFields);
          } else if (operation === 'get') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootPublicApiRequest.call(this, 'GET', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}`);
          } else if (operation === 'getAll') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            responseData = await chatwootPublicApiRequest.call(this, 'GET', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations`);
          } else if (operation === 'resolve') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/toggle_status`);
          } else if (operation === 'toggleTyping') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const typingStatus = this.getNodeParameter('typingStatus', i) as string;

            const body: IDataObject = { typing_status: typingStatus };
            responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/toggle_typing`, body);
          } else if (operation === 'updateLastSeen') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/update_last_seen`);
          } else {
            throw new NodeOperationError(this.getNode(), `Operation "${operation}" not supported`, { itemIndex: i });
          }
        }

        // =====================================================================
        // PUBLIC API: MESSAGE
        // =====================================================================
        else if (resource === 'publicMessage') {
          const credentials = await this.getCredentials('chatwootPublicApi');
          const inboxIdentifier = credentials.inboxIdentifier as string;

          if (operation === 'create') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const content = this.getNodeParameter('content', i) as string;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const body: IDataObject = { content, ...additionalFields };
            responseData = await chatwootPublicApiRequest.call(this, 'POST', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/messages`, body);
          } else if (operation === 'getAll') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            responseData = await chatwootPublicApiRequest.call(this, 'GET', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/messages`);
          } else if (operation === 'update') {
            const contactIdentifier = this.getNodeParameter('contactIdentifier', i) as string;
            const conversationId = validateId(this.getNodeParameter('conversationId', i), 'Conversation ID');
            const messageId = validateId(this.getNodeParameter('messageId', i), 'Message ID');
            const content = this.getNodeParameter('content', i) as string;

            const body: IDataObject = { content };
            responseData = await chatwootPublicApiRequest.call(this, 'PATCH', `/inboxes/${inboxIdentifier}/contacts/${contactIdentifier}/conversations/${conversationId}/messages/${messageId}`, body);
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
