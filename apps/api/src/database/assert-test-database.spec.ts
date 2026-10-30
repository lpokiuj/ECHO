import { assertTestDatabase } from './assert-test-database.js';

describe('assertTestDatabase', () => {
  it('accepts a database whose name ends with _test', () => {
    expect(() => assertTestDatabase('echo_test')).not.toThrow();
  });

  it('rejects the dev database', () => {
    expect(() => assertTestDatabase('echo_dev')).toThrow(
      'Refusing to run tests against "echo_dev"',
    );
  });

  it('rejects a missing name', () => {
    expect(() => assertTestDatabase(undefined)).toThrow('must end with "_test"');
  });

  it('rejects a name that only contains test', () => {
    expect(() => assertTestDatabase('test_echo')).toThrow();
  });
});
