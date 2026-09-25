import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatwootApiRequest } from './GenericFunctions';
import type { TriggerEventType, IWebhook } from './types';

export class ChatwootTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Chatwoot Trigger',
		name: 'chatwootTrigger',
		icon: 'file:chatwoot.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Chatwoot events occur',
		defaults: {
			name: 'Chatwoot Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'chatwootApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				options: [
					{
						name: 'Contact Created',
						value: 'contact_created',
						description: 'Triggered when a new contact is created',
					},
					{
						name: 'Contact Updated',
						value: 'contact_updated',
						description: 'Triggered when a contact is updated',
					},
					{
						name: 'Conversation Created',
						value: 'conversation_created',
						description: 'Triggered when a new conversation is created',
					},
					{
						name: 'Conversation Status Changed',
						value: 'conversation_status_changed',
						description: 'Triggered when conversation status changes (open, resolved, pending, snoozed)',
					},
					{
						name: 'Conversation Typing Off',
						value: 'conversation_typing_off',
						description: 'Triggered when typing indicator stops',
					},
					{
						name: 'Conversation Typing On',
						value: 'conversation_typing_on',
						description: 'Triggered when typing indicator starts',
					},
					{
						name: 'Conversation Updated',
						value: 'conversation_updated',
						description: 'Triggered when a conversation is updated',
					},
					{
						name: 'Message Created',
						value: 'message_created',
						description: 'Triggered when a new message is sent or received',
					},
					{
						name: 'Message Updated',
						value: 'message_updated',
						description: 'Triggered when a message is updated',
					},
					{
						name: 'Webwidget Triggered',
						value: 'webwidget_triggered',
						description: 'Triggered when a web widget event occurs',
					},
				],
				description: 'The events to listen for',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Raw Body',
						name: 'includeRawBody',
						type: 'boolean',
						default: false,
						description: 'Whether to include the raw webhook body in the output',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');

				try {
					const webhooks = (await chatwootApiRequest.call(
						this,
						'GET',
						'/webhooks',
					)) as IDataObject;

					const existingWebhooks = (webhooks.payload || webhooks) as IWebhook[];

					if (Array.isArray(existingWebhooks)) {
						// If we have a stored webhook ID, check if it still exists with the right URL
						if (webhookData.webhookId) {
							const storedWebhook = existingWebhooks.find(
								(w) => w.id === webhookData.webhookId,
							);
							if (storedWebhook && storedWebhook.url === webhookUrl) {
								return true;
							}
							// Stored webhook has wrong URL or was deleted — clean up stale ID
							if (storedWebhook) {
								try {
									await chatwootApiRequest.call(this, 'DELETE', `/webhooks/${webhookData.webhookId}`);
								} catch {
									// Ignore cleanup errors
								}
							}
							delete webhookData.webhookId;
						}

						// Check if any webhook with our URL already exists
						const existingWebhook = existingWebhooks.find(
							(w) => w.url === webhookUrl,
						);
						if (existingWebhook) {
							webhookData.webhookId = existingWebhook.id;
							return true;
						}
					}
				} catch (error) {
					// Only swallow 404s — propagate auth/network errors
					const statusCode = (error as { statusCode?: number }).statusCode;
					if (statusCode && statusCode !== 404) {
						throw error;
					}
				}

				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as TriggerEventType[];
				const webhookData = this.getWorkflowStaticData('node');

				const body: IDataObject = {
					url: webhookUrl,
					subscriptions: events,
				};

				try {
					const response = (await chatwootApiRequest.call(
						this,
						'POST',
						'/webhooks',
						body,
					)) as IDataObject;

					const webhook = (response.payload || response) as IWebhook;

					if (webhook.id) {
						webhookData.webhookId = webhook.id;
						return true;
					}
				} catch (error) {
					throw new Error(
						`Could not create Chatwoot webhook: ${(error as Error).message}`,
					);
				}

				return false;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.webhookId) {
					try {
						await chatwootApiRequest.call(
							this,
							'DELETE',
							`/webhooks/${webhookData.webhookId}`,
						);
					} catch {
						// Webhook might have been deleted manually
					}
					delete webhookData.webhookId;
				}

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const body = this.getBodyData() as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const events = this.getNodeParameter('events') as TriggerEventType[];

		// Verify the event is one we're subscribed to
		const eventType = body.event as TriggerEventType;
		if (events.length > 0 && !events.includes(eventType)) {
			// Event not in subscription list, ignore it
			return {
				noWebhookResponse: true,
			};
		}

		const returnData: IDataObject = {
			event: eventType,
			...body,
		};

		// Include raw body if requested
		if (options.includeRawBody) {
			returnData.rawBody = req.body;
		}

		return {
			workflowData: [this.helpers.returnJsonArray([returnData])],
		};
	}
}
