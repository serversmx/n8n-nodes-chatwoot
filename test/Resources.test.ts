import { macroOperations, macroFields } from '../nodes/Chatwoot/resources/macro';
import { notificationOperations, notificationFields } from '../nodes/Chatwoot/resources/notification';
import { campaignOperations, campaignFields } from '../nodes/Chatwoot/resources/campaign';
import { contactNoteOperations, contactNoteFields } from '../nodes/Chatwoot/resources/contactNote';
import { conversationParticipantOperations, conversationParticipantFields } from '../nodes/Chatwoot/resources/conversationParticipant';
import { companyOperations, companyFields } from '../nodes/Chatwoot/resources/company';
import { searchOperations, searchFields } from '../nodes/Chatwoot/resources/search';
import { slaPolicyOperations, slaPolicyFields } from '../nodes/Chatwoot/resources/slaPolicy';
import { conversationOperations, conversationFields } from '../nodes/Chatwoot/resources/conversation';
import { contactOperations, contactFields } from '../nodes/Chatwoot/resources/contact';
import { helpCenterOperations, helpCenterFields } from '../nodes/Chatwoot/resources/helpCenter';
import { csatSurveyOperations, csatSurveyFields } from '../nodes/Chatwoot/resources/csatSurvey';
import { profileOperations, profileFields } from '../nodes/Chatwoot/resources/profile';
import { appliedSlaOperations, appliedSlaFields } from '../nodes/Chatwoot/resources/appliedSla';
import { reportOperations, reportFields } from '../nodes/Chatwoot/resources/report';
import { liveReportOperations, liveReportFields } from '../nodes/Chatwoot/resources/liveReport';
import { summaryReportOperations, summaryReportFields } from '../nodes/Chatwoot/resources/summaryReport';
import type { INodeProperties } from 'n8n-workflow';

const allResources: Array<{
  name: string;
  operations: INodeProperties;
  fields: INodeProperties[];
}> = [
  { name: 'macro', operations: macroOperations, fields: macroFields },
  { name: 'notification', operations: notificationOperations, fields: notificationFields },
  { name: 'campaign', operations: campaignOperations, fields: campaignFields },
  { name: 'contactNote', operations: contactNoteOperations, fields: contactNoteFields },
  { name: 'conversationParticipant', operations: conversationParticipantOperations, fields: conversationParticipantFields },
  { name: 'company', operations: companyOperations, fields: companyFields },
  { name: 'search', operations: searchOperations, fields: searchFields },
  { name: 'slaPolicy', operations: slaPolicyOperations, fields: slaPolicyFields },
  { name: 'conversation', operations: conversationOperations, fields: conversationFields },
  { name: 'contact', operations: contactOperations, fields: contactFields },
  { name: 'helpCenter', operations: helpCenterOperations, fields: helpCenterFields },
  { name: 'csatSurvey', operations: csatSurveyOperations, fields: csatSurveyFields },
  { name: 'profile', operations: profileOperations, fields: profileFields },
  { name: 'appliedSla', operations: appliedSlaOperations, fields: appliedSlaFields },
  { name: 'report', operations: reportOperations, fields: reportFields },
  { name: 'liveReport', operations: liveReportOperations, fields: liveReportFields },
  { name: 'summaryReport', operations: summaryReportOperations, fields: summaryReportFields },
];

describe('Resource Definitions', () => {
  describe.each(allResources)('$name resource', ({ name, operations, fields }) => {
    it('should have correct operations structure', () => {
      expect(operations.displayName).toBe('Operation');
      expect(operations.name).toBe('operation');
      expect(operations.type).toBe('options');
      expect(operations.noDataExpression).toBe(true);
    });

    it('should target the correct resource in displayOptions', () => {
      expect(operations.displayOptions?.show?.resource).toContain(name);
    });

    it('should have at least one operation option', () => {
      const opts = operations.options as Array<{ name: string; value: string; description: string; action: string }>;
      expect(opts.length).toBeGreaterThan(0);
    });

    it('should have complete operation options (name, value, description, action)', () => {
      const opts = operations.options as Array<{ name: string; value: string; description: string; action: string }>;
      for (const opt of opts) {
        expect(opt.name).toBeTruthy();
        expect(opt.value).toBeTruthy();
        expect(opt.description).toBeTruthy();
        expect(opt.action).toBeTruthy();
      }
    });

    it('should have no duplicate operation values', () => {
      const opts = operations.options as Array<{ value: string }>;
      const values = opts.map((o) => o.value);
      const unique = [...new Set(values)];
      expect(values).toEqual(unique);
    });

    it('should have alphabetically sorted operation options', () => {
      const opts = operations.options as Array<{ name: string }>;
      const names = opts.map((o) => o.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('should have a valid default operation', () => {
      const opts = operations.options as Array<{ value: string }>;
      const values = opts.map((o) => o.value);
      expect(values).toContain(operations.default);
    });

    it('should have fields array', () => {
      expect(Array.isArray(fields)).toBe(true);
    });

    it('should have fields that target this resource', () => {
      for (const field of fields) {
        if (field.displayOptions?.show?.resource) {
          expect(field.displayOptions.show.resource).toContain(name);
        }
      }
    });
  });
});

describe('Resource Operation Counts', () => {
  it('macro should have 6 operations', () => {
    expect((macroOperations.options as unknown[]).length).toBe(6);
  });

  it('notification should have 10 operations', () => {
    expect((notificationOperations.options as unknown[]).length).toBe(10);
  });

  it('campaign should have 7 operations', () => {
    expect((campaignOperations.options as unknown[]).length).toBe(7);
  });

  it('contactNote should have 4 operations', () => {
    expect((contactNoteOperations.options as unknown[]).length).toBe(4);
  });

  it('conversationParticipant should have 3 operations', () => {
    expect((conversationParticipantOperations.options as unknown[]).length).toBe(3);
  });

  it('company should have 14 operations', () => {
    expect((companyOperations.options as unknown[]).length).toBe(14);
  });

  it('search should have 4 operations', () => {
    expect((searchOperations.options as unknown[]).length).toBe(4);
  });

  it('slaPolicy should have 5 operations', () => {
    expect((slaPolicyOperations.options as unknown[]).length).toBe(5);
  });

  it('conversation should have 18 operations', () => {
    expect((conversationOperations.options as unknown[]).length).toBe(18);
  });

  it('contact should have 14 operations', () => {
    expect((contactOperations.options as unknown[]).length).toBe(14);
  });

  it('helpCenter should have 18 operations', () => {
    expect((helpCenterOperations.options as unknown[]).length).toBe(18);
  });

  it('csatSurvey should have 5 operations', () => {
    expect((csatSurveyOperations.options as unknown[]).length).toBe(5);
  });

  it('profile should have 3 operations', () => {
    expect((profileOperations.options as unknown[]).length).toBe(3);
  });

  it('appliedSla should have 3 operations', () => {
    expect((appliedSlaOperations.options as unknown[]).length).toBe(3);
  });

  it('report should have 19 operations', () => {
    expect((reportOperations.options as unknown[]).length).toBe(19);
  });

  it('liveReport should have 2 operations', () => {
    expect((liveReportOperations.options as unknown[]).length).toBe(2);
  });

  it('summaryReport should have 5 operations', () => {
    expect((summaryReportOperations.options as unknown[]).length).toBe(5);
  });
});
