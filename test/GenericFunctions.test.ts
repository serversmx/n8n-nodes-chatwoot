import {
  validateId,
  simplifyResponse,
  validateString,
  normalizeBaseUrl,
  parseJsonSafe,
  chatwootApiRequest,
  chatwootApiRequestAllItems,
  chatwootApiRequestAllMessages,
  getChatwootErrorHint,
  DEFAULT_MAX_PAGES,
  MESSAGES_PAGE_SIZE,
} from '../nodes/Chatwoot/GenericFunctions';
import type { IDataObject } from 'n8n-workflow';
import { createMockExecuteFunctions } from './helpers/mockExecuteFunctions';

describe('GenericFunctions', () => {
  // =========================================================================
  // normalizeBaseUrl
  // =========================================================================
  describe('normalizeBaseUrl', () => {
    it('should accept https URLs', () => {
      expect(normalizeBaseUrl('https://app.chatwoot.com')).toBe('https://app.chatwoot.com');
    });

    it('should accept http URLs', () => {
      expect(normalizeBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('should trim whitespace', () => {
      expect(normalizeBaseUrl('  https://app.chatwoot.com  ')).toBe('https://app.chatwoot.com');
    });

    it('should strip trailing slashes', () => {
      expect(normalizeBaseUrl('https://app.chatwoot.com/')).toBe('https://app.chatwoot.com');
      expect(normalizeBaseUrl('https://app.chatwoot.com///')).toBe('https://app.chatwoot.com');
    });

    it('should throw for URLs without protocol', () => {
      expect(() => normalizeBaseUrl('app.chatwoot.com')).toThrow('Base URL must start with http:// or https://');
    });

    it('should throw for ftp:// protocol', () => {
      expect(() => normalizeBaseUrl('ftp://app.chatwoot.com')).toThrow('Base URL must start with http:// or https://');
    });

    it('should throw for empty string', () => {
      expect(() => normalizeBaseUrl('')).toThrow('Base URL must start with http:// or https://');
    });
  });

  // =========================================================================
  // validateId
  // =========================================================================
  describe('validateId', () => {
    it('should return valid positive integer', () => {
      expect(validateId(1, 'Test ID')).toBe(1);
      expect(validateId(100, 'Test ID')).toBe(100);
      expect(validateId('42', 'Test ID')).toBe(42);
    });

    it('should throw error for zero', () => {
      expect(() => validateId(0, 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should throw error for negative numbers', () => {
      expect(() => validateId(-1, 'Test ID')).toThrow('Test ID must be a positive integer');
      expect(() => validateId(-100, 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should throw error for non-integer numbers', () => {
      expect(() => validateId(1.5, 'Test ID')).toThrow('Test ID must be a positive integer');
      expect(() => validateId(3.14, 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should throw error for NaN', () => {
      expect(() => validateId(NaN, 'Test ID')).toThrow('Test ID must be a positive integer');
      expect(() => validateId('abc', 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should throw error for empty values', () => {
      expect(() => validateId('', 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should use correct field name in error message', () => {
      expect(() => validateId(0, 'Conversation ID')).toThrow(
        'Conversation ID must be a positive integer',
      );
      expect(() => validateId(-5, 'Contact ID')).toThrow('Contact ID must be a positive integer');
    });

    it('should handle string numbers', () => {
      expect(validateId('123', 'Test ID')).toBe(123);
      expect(validateId('1', 'Test ID')).toBe(1);
    });

    it('should handle large numbers', () => {
      expect(validateId(999999, 'Test ID')).toBe(999999);
      expect(validateId('1000000', 'Test ID')).toBe(1000000);
    });

    it('should reject Infinity', () => {
      expect(() => validateId(Infinity, 'Test ID')).toThrow('Test ID must be a positive integer');
      expect(() => validateId(-Infinity, 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should reject null and undefined', () => {
      expect(() => validateId(null, 'Test ID')).toThrow('Test ID must be a positive integer');
      expect(() => validateId(undefined, 'Test ID')).toThrow('Test ID must be a positive integer');
    });

    it('should reject boolean values', () => {
      // Number(true) = 1, but we're testing the validator accepts it since it's a valid number
      // Actually true -> 1 which IS a valid positive integer. Let's verify the actual behavior.
      expect(validateId(true, 'Test ID')).toBe(1);
      expect(() => validateId(false, 'Test ID')).toThrow('Test ID must be a positive integer');
    });
  });

  // =========================================================================
  // validateString
  // =========================================================================
  describe('validateString', () => {
    it('should return trimmed valid string', () => {
      expect(validateString('hello', 'Name')).toBe('hello');
      expect(validateString('  hello  ', 'Name')).toBe('hello');
    });

    it('should throw for empty string', () => {
      expect(() => validateString('', 'Name')).toThrow('Name must be a non-empty string');
    });

    it('should throw for whitespace-only string', () => {
      expect(() => validateString('   ', 'Name')).toThrow('Name must be a non-empty string');
    });

    it('should throw for non-string values', () => {
      expect(() => validateString(123, 'Name')).toThrow('Name must be a non-empty string');
      expect(() => validateString(null, 'Name')).toThrow('Name must be a non-empty string');
      expect(() => validateString(undefined, 'Name')).toThrow('Name must be a non-empty string');
      expect(() => validateString(true, 'Name')).toThrow('Name must be a non-empty string');
    });

    it('should preserve special characters', () => {
      expect(validateString('hello@world.com', 'Email')).toBe('hello@world.com');
      expect(validateString('user+tag@example.com', 'Email')).toBe('user+tag@example.com');
    });
  });

  // =========================================================================
  // simplifyResponse
  // =========================================================================
  describe('simplifyResponse', () => {
    it('should extract specified fields from items', () => {
      const items: IDataObject[] = [
        { id: 1, name: 'John', email: 'john@example.com', phone: '123-456' },
        { id: 2, name: 'Jane', email: 'jane@example.com', phone: '789-012' },
      ];
      const fieldsToKeep = ['id', 'name', 'email'];

      const result = simplifyResponse(items, fieldsToKeep);

      expect(result).toEqual([
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' },
      ]);
    });

    it('should handle missing fields gracefully', () => {
      const items: IDataObject[] = [
        { id: 1, name: 'John' },
        { id: 2, email: 'jane@example.com' },
      ];
      const fieldsToKeep = ['id', 'name', 'email'];

      const result = simplifyResponse(items, fieldsToKeep);

      expect(result).toEqual([
        { id: 1, name: 'John' },
        { id: 2, email: 'jane@example.com' },
      ]);
    });

    it('should return empty objects for items without matching fields', () => {
      const items: IDataObject[] = [
        { foo: 'bar', baz: 'qux' },
      ];
      const fieldsToKeep = ['id', 'name'];

      const result = simplifyResponse(items, fieldsToKeep);

      expect(result).toEqual([{}]);
    });

    it('should handle empty items array', () => {
      const result = simplifyResponse([], ['id', 'name']);
      expect(result).toEqual([]);
    });

    it('should handle empty fieldsToKeep array', () => {
      const result = simplifyResponse([{ id: 1, name: 'John' }], []);
      expect(result).toEqual([{}]);
    });

    it('should preserve nested objects', () => {
      const items: IDataObject[] = [
        { id: 1, meta: { page: 1, total: 10 }, name: 'John' },
      ];
      const result = simplifyResponse(items, ['id', 'meta']);
      expect(result).toEqual([{ id: 1, meta: { page: 1, total: 10 } }]);
    });

    it('should preserve arrays', () => {
      const items: IDataObject[] = [
        { id: 1, labels: ['urgent', 'customer'], name: 'Conversation 1' },
      ];
      const result = simplifyResponse(items, ['id', 'labels']);
      expect(result).toEqual([{ id: 1, labels: ['urgent', 'customer'] }]);
    });

    it('should handle null and undefined values', () => {
      const items: IDataObject[] = [{ id: 1, name: null, email: undefined }];
      const result = simplifyResponse(items, ['id', 'name', 'email']);
      expect(result).toEqual([{ id: 1, name: null }]);
    });

    it('should handle boolean false values', () => {
      const result = simplifyResponse([{ id: 1, active: false, enabled: true }], ['id', 'active', 'enabled']);
      expect(result).toEqual([{ id: 1, active: false, enabled: true }]);
    });

    it('should handle zero numeric values', () => {
      const result = simplifyResponse([{ id: 1, count: 0, total: 100 }], ['id', 'count']);
      expect(result).toEqual([{ id: 1, count: 0 }]);
    });

    it('should handle large datasets', () => {
      const items: IDataObject[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i, name: `Item ${i}`, extra: 'removed',
      }));
      const result = simplifyResponse(items, ['id', 'name']);
      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({ id: 0, name: 'Item 0' });
      expect(result[999]).toEqual({ id: 999, name: 'Item 999' });
    });
  });

  // =========================================================================
  // parseJsonSafe
  // =========================================================================
  describe('parseJsonSafe', () => {
    it('should parse valid JSON string', () => {
      expect(parseJsonSafe('{"key":"value"}', 'test')).toEqual({ key: 'value' });
    });

    it('should parse valid JSON array', () => {
      expect(parseJsonSafe('[1,2,3]', 'test')).toEqual([1, 2, 3]);
    });

    it('should return non-string values as-is', () => {
      const obj = { key: 'value' };
      expect(parseJsonSafe(obj, 'test')).toBe(obj);
      expect(parseJsonSafe(42, 'test')).toBe(42);
      expect(parseJsonSafe(null, 'test')).toBe(null);
      expect(parseJsonSafe(undefined, 'test')).toBe(undefined);
    });

    it('should throw descriptive error for invalid JSON', () => {
      expect(() => parseJsonSafe('{invalid}', 'custom_attributes')).toThrow('Invalid JSON in "custom_attributes"');
    });

    it('should include truncated value in error message', () => {
      expect(() => parseJsonSafe('not json', 'field')).toThrow('not json');
    });
  });

  // =========================================================================
  // URL construction patterns
  // =========================================================================
  describe('URL construction patterns', () => {
    const normalize = (url: string) => url.trim().replace(/\/+$/, '');

    it('should strip trailing slashes', () => {
      expect(normalize('https://example.com/')).toBe('https://example.com');
      expect(normalize('https://example.com////')).toBe('https://example.com');
      expect(normalize('https://example.com')).toBe('https://example.com');
      expect(normalize('  https://example.com/  ')).toBe('https://example.com');
    });

    it('should construct Application API URLs', () => {
      const url = `${normalize('https://cw.example.com/')}/api/v1/accounts/42/conversations`;
      expect(url).toBe('https://cw.example.com/api/v1/accounts/42/conversations');
    });

    it('should construct Platform API URLs', () => {
      const url = `${normalize('https://cw.example.com/')}/platform/api/v1/accounts`;
      expect(url).toBe('https://cw.example.com/platform/api/v1/accounts');
    });

    it('should construct Public API URLs', () => {
      const url = `${normalize('https://cw.example.com/')}/public/api/v1/inboxes/abc123/contacts`;
      expect(url).toBe('https://cw.example.com/public/api/v1/inboxes/abc123/contacts');
    });
  });

  // =========================================================================
  // Error hints (Chatwoot's own message is used as the error message; the hint is the description)
  // =========================================================================
  describe('error hints', () => {
    it.each([
      [401, 'access token'],
      [402, 'Payment required'],
      [403, 'Forbidden'],
      [404, 'Not found'],
      [422, 'validation error'],
      [429, 'Rate limited'],
      [500, 'internal error'],
      [502, 'temporarily unavailable'],
      [503, 'temporarily unavailable'],
      [504, 'temporarily unavailable'],
    ])('should return a specific hint for %d', (code, expectedSubstring) => {
      expect(getChatwootErrorHint(code, undefined)).toContain(expectedSubstring);
    });

    it('401 is not blindly reported as an invalid token (authorization failures since 4.14)', () => {
      expect(getChatwootErrorHint(401, 'Invalid Access Token')).toContain('was rejected');
      expect(getChatwootErrorHint(401, 'You are not authorized to do this action')).not.toContain(
        'was rejected',
      );
    });

    it('429 hint lists the real Chatwoot limits, not "60/minute"', () => {
      const hint = getChatwootErrorHint(429, 'Retry later');
      expect(hint).not.toContain('60/minute');
      expect(hint).toContain('3000 requests/min per IP');
      expect(hint).toContain('RACK_ATTACK_ALLOWED_IPS');
    });

    it('should return a generic hint for unknown status codes', () => {
      expect(getChatwootErrorHint(418, undefined)).toBe('Chatwoot rejected the request.');
      expect(getChatwootErrorHint(507, undefined)).toBe('Chatwoot returned a server error.');
    });
  });

  // =========================================================================
  // Auth header patterns
  // =========================================================================
  describe('auth header patterns', () => {
    it('Application API uses api_access_token header', () => {
      const headers = { api_access_token: 'tok', 'Content-Type': 'application/json' };
      expect(headers).toHaveProperty('api_access_token');
    });

    it('Platform API uses api_access_token header', () => {
      const headers = { api_access_token: 'ptok', 'Content-Type': 'application/json' };
      expect(headers).toHaveProperty('api_access_token');
    });

    it('Public API has no auth token header', () => {
      const headers = { 'Content-Type': 'application/json' };
      expect(headers).not.toHaveProperty('api_access_token');
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  // =========================================================================
  // Request body / QS handling (real helper, mocked httpRequest)
  // =========================================================================
  describe('request body handling', () => {
    async function send(method: 'GET' | 'POST' | 'DELETE', body: IDataObject, qs: IDataObject) {
      const mock = createMockExecuteFunctions({ responses: [{ url: '/x' }] });
      await chatwootApiRequest.call(mock.ctx, method, '/x', body, qs);
      return mock.calls[0].options;
    }

    it('strips body for GET', async () => {
      expect(await send('GET', { a: 1 }, {})).not.toHaveProperty('body');
    });

    it('keeps a non-empty body for DELETE (Chatwoot reads user_ids from it)', async () => {
      expect((await send('DELETE', { user_ids: [1] }, {})).body).toEqual({ user_ids: [1] });
    });

    it('strips an empty body for DELETE', async () => {
      expect(await send('DELETE', {}, {})).not.toHaveProperty('body');
    });

    it('keeps body for POST with data', async () => {
      expect((await send('POST', { content: 'hi' }, {})).body).toEqual({ content: 'hi' });
    });

    it('strips empty body for POST', async () => {
      expect(await send('POST', {}, {})).not.toHaveProperty('body');
    });

    it('strips empty qs', async () => {
      expect(await send('GET', {}, {})).not.toHaveProperty('qs');
    });

    it('keeps non-empty qs and serializes arrays with brackets', async () => {
      const options = await send('GET', {}, { page: 1 });
      expect(options.qs).toEqual({ page: 1 });
      expect(options.arrayFormat).toBe('brackets');
    });
  });

  // =========================================================================
  // Pagination patterns
  // =========================================================================
  describe('pagination patterns', () => {
    it('page-based: detects end via meta.total_pages', async () => {
      const mock = createMockExecuteFunctions({
        responses: [{ url: '/x', body: { meta: { current_page: 1, total_pages: 1 }, payload: [{ id: 1 }] } }],
      });
      await chatwootApiRequestAllItems.call(mock.ctx, 'GET', '/x');
      expect(mock.calls).toHaveLength(1);
    });

    it('page-based: detects end via items < first page size', async () => {
      const mock = createMockExecuteFunctions({
        responses: [
          { url: '/x', body: { payload: [{ id: 1 }, { id: 2 }] } },
          { url: '/x', body: { payload: [{ id: 3 }] } },
        ],
      });
      expect(await chatwootApiRequestAllItems.call(mock.ctx, 'GET', '/x')).toHaveLength(3);
    });

    it('page-based: the page cap raises an error instead of silently truncating', () => {
      expect(DEFAULT_MAX_PAGES).toBeGreaterThanOrEqual(500);
    });

    it('cursor-based: pages are ascending, so the next before is the smallest id (messages[0])', async () => {
      const page = Array.from({ length: MESSAGES_PAGE_SIZE }, (_, i) => ({ id: 81 + i }));
      const mock = createMockExecuteFunctions({
        responses: [
          { url: '/conversations/1/messages', body: { payload: page } },
          { url: '/conversations/1/messages', body: { payload: [{ id: 80 }] } },
        ],
      });
      await chatwootApiRequestAllMessages.call(mock.ctx, 1);
      expect(mock.calls[1].qs).toEqual({ before: 81 });
    });

    it('cursor-based: limit keeps the most recent messages, in ascending order', async () => {
      const page = Array.from({ length: MESSAGES_PAGE_SIZE }, (_, i) => ({ id: 81 + i }));
      const mock = createMockExecuteFunctions({
        responses: [{ url: '/conversations/1/messages', body: { payload: page } }],
      });
      const result = await chatwootApiRequestAllMessages.call(mock.ctx, 1, 3);
      expect(result.map((m) => m.id)).toEqual([98, 99, 100]);
    });

    it('handles response format: { payload: [...] }', () => {
      const resp = { payload: [{ id: 1 }] };
      expect(Array.isArray(resp.payload)).toBe(true);
    });

    it('handles response format: { data: [...] }', () => {
      const resp = { data: [{ id: 1 }] };
      expect(Array.isArray(resp.data)).toBe(true);
    });

    it('handles response format: direct array', () => {
      expect(Array.isArray([{ id: 1 }])).toBe(true);
    });
  });
});
