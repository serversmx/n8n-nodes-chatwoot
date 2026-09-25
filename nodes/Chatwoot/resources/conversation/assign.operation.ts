import type { INodeProperties } from 'n8n-workflow';

export const assignOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['assign'],
      },
    },
    description: 'ID of the conversation to assign',
  },
  {
    displayName: 'Assignment Type',
    name: 'assignmentType',
    type: 'options',
    required: true,
    options: [
      {
        name: 'Agent',
        value: 'agent',
        description: 'Assign to a specific agent. Replaces any bot assignee; on Chatwoot 4.18+ a Pending conversation handled by a bot or Captain is reopened.',
      },
      {
        name: 'Agent Bot',
        value: 'agentBot',
        description: 'Hand the conversation to an agent bot. Clears the human assignee; on Chatwoot 4.18+ the conversation also moves to Pending.',
      },
      {
        name: 'Captain Assistant',
        value: 'captainAssistant',
        description: "Hand the conversation to the Captain assistant of its inbox. Requires Chatwoot 4.18+ Enterprise with Captain enabled.",
      },
      {
        name: 'Team',
        value: 'team',
        description: 'Assign to a team',
      },
      {
        name: 'Unassign',
        value: 'unassign',
        description: 'Remove the current agent or bot assignee (the team is kept)',
      },
      {
        name: 'Unassign Team',
        value: 'unassignTeam',
        description: 'Remove the team (the agent assignee is kept)',
      },
    ],
    default: 'agent',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['assign'],
      },
    },
    description: 'Type of assignment to make',
  },
  {
    displayName: 'Agent',
    name: 'assigneeId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getAgents',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['assign'],
        assignmentType: ['agent'],
      },
    },
    description: 'Select the agent to assign. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Agent Bot',
    name: 'agentBotId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getAgentBots',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['assign'],
        assignmentType: ['agentBot'],
      },
    },
    description: 'Select the agent bot to assign. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Captain Assistant ID',
    name: 'captainAssistantId',
    type: 'number',
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['assign'],
        assignmentType: ['captainAssistant'],
      },
    },
    description:
      "ID of the Captain assistant connected to the conversation's inbox (Chatwoot rejects any other). Leave 0 to use the connected one. The node first checks that the server runs Chatwoot 4.18+ Enterprise, because older versions would assign the human agent with the same ID.",
  },
  {
    displayName: 'Team',
    name: 'teamId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getTeams',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['assign'],
        assignmentType: ['team'],
      },
    },
    description: 'Select the team to assign. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
];
