import { MigrationInterface, QueryRunner } from "typeorm";

export class AddServiceUnavailability1793807484925 implements MigrationInterface {
    name = 'AddServiceUnavailability1793807484925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "service_unavailability" ("service_id" uuid NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e41dd3867999edac3f55ccb6a6c" PRIMARY KEY ("service_id", "user_id"))`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" ADD CONSTRAINT "FK_dc67d3bda3727ba69ce9eb882b7" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" ADD CONSTRAINT "FK_07ead93f043573dbecfc58069e9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service_unavailability" DROP CONSTRAINT "FK_07ead93f043573dbecfc58069e9"`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" DROP CONSTRAINT "FK_dc67d3bda3727ba69ce9eb882b7"`);
        await queryRunner.query(`DROP TABLE "service_unavailability"`);
    }

}
