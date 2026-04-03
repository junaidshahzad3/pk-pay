import { describe, it, expect } from 'vitest';
import { escapeHtmlAttribute, safeCompare, sanitizeRaw } from '../../src/utils/crypto.js';
import { formatToPKT } from '../../src/utils/date.js';

describe('Security Utilities', () => {
  describe('safeCompare', () => {
    it('should return true for identical strings', () => {
      expect(safeCompare('abc', 'abc')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(safeCompare('abc', 'abd')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(safeCompare('abc', 'abcd')).toBe(false);
    });
  });

  describe('sanitizeRaw', () => {
    it('should redact sensitive keys', () => {
      const input = {
        pp_Amount: '100',
        pp_Password: 'secret123',
        nested: {
          hashKey: 'key456',
          other: 'data'
        }
      };
      
      const expected = {
        pp_Amount: '100',
        pp_Password: '[REDACTED]',
        nested: {
          hashKey: '[REDACTED]',
          other: 'data'
        }
      };
      
      expect(sanitizeRaw(input)).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = [{ password: '123' }, { other: '456' }];
      const expected = [{ password: '[REDACTED]' }, { other: '456' }];
      expect(sanitizeRaw(input)).toEqual(expected);
    });
  });

  describe('escapeHtmlAttribute', () => {
    it('should escape dangerous HTML characters', () => {
      expect(escapeHtmlAttribute(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;');
    });
  });
});

describe('Date Utilities', () => {
  describe('formatToPKT', () => {
    it('should format date to PKT (UTC+5)', () => {
      // 2024-03-29 10:00:00 UTC
      const date = new Date('2024-03-29T10:00:00Z');
      // Should be 2024-03-29 15:00:00 PKT
      expect(formatToPKT(date, 'YYYYMMDDHHmmss')).toBe('20240329150000');
    });

    it('should handle different formats', () => {
      const date = new Date('2024-03-29T10:00:00Z');
      expect(formatToPKT(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-03-29 15:00:00');
    });
  });
});
