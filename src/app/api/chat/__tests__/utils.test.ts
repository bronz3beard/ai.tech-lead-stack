import { isQuotaError, getErrorMessage } from '../utils';

describe('Chat API Utils', () => {
  describe('getErrorMessage', () => {
    it('should handle standard Error objects', () => {
      expect(getErrorMessage(new Error('Standard error'))).toBe('Standard error');
    });

    it('should extract message from nested AI SDK structures', () => {
      expect(getErrorMessage({ error: { message: 'Nested error' } })).toBe('Nested error');
      expect(getErrorMessage({ data: { error: { message: 'Data error' } } })).toBe('Data error');
      expect(getErrorMessage({ response: { data: { error: { message: 'Response error' } } } })).toBe('Response error');
    });

    it('should fallback to stringification for objects without message field', () => {
      expect(getErrorMessage({ someField: 'value' })).toBe('{"someField":"value"}');
    });

    it('should stringify primitive types', () => {
      expect(getErrorMessage('String error')).toBe('String error');
      expect(getErrorMessage(123)).toBe('123');
      expect(getErrorMessage(null)).toBe('null');
      expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('should handle circular structures gracefully by stringifying what it can or catching', () => {
       const circular: any = { field: 'value' };
       circular.self = circular;
       // The function should gracefully handle circular structures by falling back to String()
       expect(() => getErrorMessage(circular)).not.toThrow();
       expect(getErrorMessage(circular)).toBe('[object Object]');
    });
  });

  describe('isQuotaError', () => {
    it('should return false for falsy values', () => {
      expect(isQuotaError(null)).toBe(false);
      expect(isQuotaError(undefined)).toBe(false);
      expect(isQuotaError(false)).toBe(false);
      expect(isQuotaError('')).toBe(false);
      expect(isQuotaError(0)).toBe(false);
    });

    it('should identify direct status/code 429', () => {
      expect(isQuotaError({ status: 429 })).toBe(true);
      expect(isQuotaError({ statusCode: 429 })).toBe(true);
      expect(isQuotaError({ code: 429 })).toBe(true);
      expect(isQuotaError({ error_code: 429 })).toBe(true);
      expect(isQuotaError({ status: '429' })).toBe(true);
    });

    it('should identify Resource Exhausted string codes', () => {
      expect(isQuotaError({ code: 'RESOURCE_EXHAUSTED' })).toBe(true);
      expect(isQuotaError({ status: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
      expect(isQuotaError({ code: 'FORBIDDEN' })).toBe(true);
      expect(isQuotaError({ reason: 'resource_exhausted' })).toBe(true);
      expect(isQuotaError({ reason: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
    });

    it('should identify quota issues via deep heuristic check', () => {
      expect(isQuotaError(new Error('OpenAI API returned an error: 429 Too Many Requests'))).toBe(true);
      expect(isQuotaError({ message: 'You exceeded your current quota, please check your plan and billing details.' })).toBe(true);
      expect(isQuotaError({ error: { message: 'Rate limit reached for requests' } })).toBe(true);
      expect(isQuotaError({ response: { data: { error: { message: 'resource exhausted' } } } })).toBe(true);
    });

    it('should return false for non-quota errors', () => {
      expect(isQuotaError({ status: 500, message: 'Internal Server Error' })).toBe(false);
      expect(isQuotaError({ code: 'NOT_FOUND', message: 'The requested resource was not found' })).toBe(false);
      expect(isQuotaError(new Error('Network error'))).toBe(false);
      expect(isQuotaError({ data: { message: 'Invalid API key provided.' } })).toBe(false);
    });

    it('should handle circular objects gracefully without crashing', () => {
      const circular: any = { status: 500, message: 'some error' };
      circular.self = circular;
      // The function should gracefully handle circular structures
      expect(() => isQuotaError(circular)).not.toThrow();
      expect(isQuotaError(circular)).toBe(false);

      const circularQuota: any = { status: 429 };
      circularQuota.self = circularQuota;
      expect(() => isQuotaError(circularQuota)).not.toThrow();
      expect(isQuotaError(circularQuota)).toBe(true);
    });
  });
});
