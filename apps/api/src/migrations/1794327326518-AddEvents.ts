import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEvents1794327326518 implements MigrationInterface {
    name = 'AddEvents1794327326518'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying(120) NOT NULL, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "location" character varying(200) NOT NULL, "description" character varying(2000) NOT NULL, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_1a259861a2ce114f074b366eed2" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_1a259861a2ce114f074b366eed2"`);
        await queryRunner.query(`DROP TABLE "events"`);
    }

}
