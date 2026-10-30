// Tests truncate tables, so they must never run against echo_dev or anything else.
export function assertTestDatabase(name: string | undefined): void {
  if (!name?.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${name}": database name must end with "_test"`,
    );
  }
}
