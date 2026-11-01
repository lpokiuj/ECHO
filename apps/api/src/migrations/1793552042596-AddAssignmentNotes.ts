import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssignmentNotes1793552042596 implements MigrationInterface {
    name = 'AddAssignmentNotes1793552042596'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD "notes" text NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP COLUMN "notes"`);
    }

}
