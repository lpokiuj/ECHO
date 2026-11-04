import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttendance1793807625863 implements MigrationInterface {
    name = 'AddAttendance1793807625863'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "service_absences" ("service_id" uuid NOT NULL, "user_id" uuid NOT NULL, "team_id" uuid NOT NULL, "recorded_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2777e673dd5e31b346ba3b2f6da" PRIMARY KEY ("service_id", "user_id"))`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD "is_absent_taker" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE UNIQUE INDEX "service_assignments_one_taker_idx" ON "service_assignments"  ("service_id", "team_id") WHERE "is_absent_taker"`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_2777e673dd5e31b346ba3b2f6da" FOREIGN KEY ("service_id", "user_id") REFERENCES "service_assignments"("service_id","user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_b2148224ec3f5d42d809f721232" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_b2148224ec3f5d42d809f721232"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_2777e673dd5e31b346ba3b2f6da"`);
        await queryRunner.query(`DROP INDEX "public"."service_assignments_one_taker_idx"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP COLUMN "is_absent_taker"`);
        await queryRunner.query(`DROP TABLE "service_absences"`);
    }

}
