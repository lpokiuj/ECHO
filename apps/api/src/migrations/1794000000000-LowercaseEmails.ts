import { MigrationInterface, QueryRunner } from 'typeorm';

export class LowercaseEmails1794000000000 implements MigrationInterface {
  name = 'LowercaseEmails1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dupes: { email: string }[] = await queryRunner.query(
      `SELECT lower(email) AS email FROM "users" GROUP BY lower(email) HAVING count(*) > 1`,
    );
    if (dupes.length > 0) {
      throw new Error(
        `Cannot lowercase emails, accounts differ only by case: ${dupes.map((d) => d.email).join(', ')}. Merge or rename them first.`,
      );
    }
    await queryRunner.query(`UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email")`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_email_lowercase_chk"`);
  }
}
