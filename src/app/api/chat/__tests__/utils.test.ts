import { getErrorMessage } from '../utils';

describe('getErrorMessage', () => {
  it('returns error.message if the input is an Error instance', () => {
    const error = new Error('Standard error message');
    expect(getErrorMessage(error)).toBe('Standard error message');
  });

  it('extracts message from an object with error.message', () => {
    const error = { error: { message: 'Nested error.message' } };
    expect(getErrorMessage(error)).toBe('Nested error.message');
  });

  it('extracts message from an object with a direct message property', () => {
    const error = { message: 'Direct message property' };
    expect(getErrorMessage(error)).toBe('Direct message property');
  });

  it('extracts message from an object with data.error.message', () => {
    const error = { data: { error: { message: 'Data error message' } } };
    expect(getErrorMessage(error)).toBe('Data error message');
  });

  it('extracts message from an object with response.data.error.message', () => {
    const error = { response: { data: { error: { message: 'Response data error message' } } } };
    expect(getErrorMessage(error)).toBe('Response data error message');
  });

  it('stringifies an object if no matching message properties are found', () => {
    const error = { someOtherField: 'Unexpected format', code: 500 };
    expect(getErrorMessage(error)).toBe(JSON.stringify(error));
  });

  it('returns a string representation for a simple string input', () => {
    const error = 'Just a simple string error';
    expect(getErrorMessage(error)).toBe('Just a simple string error');
  });

  it('returns a string representation for a number input', () => {
    const error = 404;
    expect(getErrorMessage(error)).toBe('404');
  });

  it('returns a string representation for null input', () => {
    const error = null;
    expect(getErrorMessage(error)).toBe('null');
  });

  it('returns a string representation for undefined input', () => {
    const error = undefined;
    expect(getErrorMessage(error)).toBe('undefined');
  });
});
