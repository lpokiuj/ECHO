import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicSubmissions1794242787286 implements MigrationInterface {
    name = 'AddPublicSubmissions1794242787286'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."prayer_request_status" AS ENUM('NEW', 'IN_PROGRESS', 'DONE')`);
        await queryRunner.query(`CREATE TABLE "prayer_requests" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100), "contact" character varying(100), "wants_follow_up" boolean NOT NULL DEFAULT false, "content" text NOT NULL, "consent_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."prayer_request_status" NOT NULL DEFAULT 'NEW', "admin_note" character varying(1000), "handled_by" uuid, "handled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_000f6743347f872383f59655a52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."volunteer_application_status" AS ENUM('NEW', 'CONTACTED', 'ACCEPTED', 'DECLINED')`);
        await queryRunner.query(`CREATE TABLE "volunteer_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "full_name" character varying(100) NOT NULL, "whatsapp" character varying(30) NOT NULL, "email" character varying(255), "availability" character varying(500), "message" character varying(1000), "consent_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."volunteer_application_status" NOT NULL DEFAULT 'NEW', "admin_note" character varying(1000), "handled_by" uuid, "handled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3a1316e1ec8f5e6ae32de980632" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "volunteer_application_bidang" ("application_id" uuid NOT NULL, "bidang_id" uuid NOT NULL, CONSTRAINT "PK_01c2adaabfa5c22bdade4bc4bcc" PRIMARY KEY ("application_id", "bidang_id"))`);
        await queryRunner.query(`ALTER TABLE "prayer_requests" ADD CONSTRAINT "FK_53ef17a4466df94b4f64dfd0dc4" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_applications" ADD CONSTRAINT "FK_09c4d73e972720fca4084ba3bb6" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_application_bidang" ADD CONSTRAINT "FK_4261252e94784a2e80f9fd37110" FOREIGN KEY ("application_id") REFERENCES "volunteer_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_application_bidang" ADD CONSTRAINT "FK_267d53fdd94d315446c825e9c33" FOREIGN KEY ("bidang_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "volunteer_application_bidang" DROP CONSTRAINT "FK_267d53fdd94d315446c825e9c33"`);
        await queryRunner.query(`ALTER TABLE "volunteer_application_bidang" DROP CONSTRAINT "FK_4261252e94784a2e80f9fd37110"`);
        await queryRunner.query(`ALTER TABLE "volunteer_applications" DROP CONSTRAINT "FK_09c4d73e972720fca4084ba3bb6"`);
        await queryRunner.query(`ALTER TABLE "prayer_requests" DROP CONSTRAINT "FK_53ef17a4466df94b4f64dfd0dc4"`);
        await queryRunner.query(`DROP TABLE "volunteer_application_bidang"`);
        await queryRunner.query(`DROP TABLE "volunteer_applications"`);
        await queryRunner.query(`DROP TYPE "public"."volunteer_application_status"`);
        await queryRunner.query(`DROP TABLE "prayer_requests"`);
        await queryRunner.query(`DROP TYPE "public"."prayer_request_status"`);
    }

}
