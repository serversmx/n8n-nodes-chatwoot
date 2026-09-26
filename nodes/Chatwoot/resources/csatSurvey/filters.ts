import type { INodeProperties } from 'n8n-workflow';

/**
 * Filters shared by the CSAT list, metrics and download endpoints
 * (csat_survey_responses_controller#set_csat_survey_responses). The date range only applies when
 * both Since and Until are set (Chatwoot's DateRangeHelper).
 */
export const csatFilterOptions: INodeProperties[] = [
  {
    displayName: 'Agent IDs',
    name: 'user_ids',
    type: 'string',
    default: '',
    description: 'Comma-separated IDs of the agents assigned to the rated conversations',
  },
  {
    displayName: 'Inbox ID',
    name: 'inbox_id',
    type: 'number',
    default: 0,
    description: 'Only responses of conversations in this inbox',
  },
  {
    displayName: 'Ratings',
    name: 'rating',
    type: 'multiOptions',
    options: [
      { name: '1 (Worst)', value: '1' },
      { name: '2', value: '2' },
      { name: '3', value: '3' },
      { name: '4', value: '4' },
      { name: '5 (Best)', value: '5' },
    ],
    default: [],
    description: 'Only responses with these ratings',
  },
  {
    displayName: 'Since',
    name: 'since',
    type: 'dateTime',
    default: '',
    description: 'Start of the date range (applies only when Until is also set)',
  },
  {
    displayName: 'Team ID',
    name: 'team_id',
    type: 'number',
    default: 0,
    description: 'Only responses of conversations assigned to this team',
  },
  {
    displayName: 'Until',
    name: 'until',
    type: 'dateTime',
    default: '',
    description: 'End of the date range (applies only when Since is also set)',
  },
];
