import { MigrationInterface, QueryRunner } from "typeorm";

export class CascadeUserTeamDeletes1794235300560 implements MigrationInterface {
    name = 'CascadeUserTeamDeletes1794235300560'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP CONSTRAINT "FK_150a611026d4cdf26e7b3634f53"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP CONSTRAINT "FK_f0a69e478481862774c14778f98"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP CONSTRAINT "FK_61553c0ad11b34715acac09190d"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_2777e673dd5e31b346ba3b2f6da"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_b2148224ec3f5d42d809f721232"`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" DROP CONSTRAINT "FK_07ead93f043573dbecfc58069e9"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD CONSTRAINT "FK_150a611026d4cdf26e7b3634f53" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD CONSTRAINT "FK_f0a69e478481862774c14778f98" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD CONSTRAINT "FK_61553c0ad11b34715acac09190d" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_2777e673dd5e31b346ba3b2f6da" FOREIGN KEY ("service_id", "user_id") REFERENCES "service_assignments"("service_id","user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_ddd117b5c50bf2a252afa90d64a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_7c33f25440de9bee0ee109e676d" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_b2148224ec3f5d42d809f721232" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" ADD CONSTRAINT "FK_07ead93f043573dbecfc58069e9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea"`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" DROP CONSTRAINT "FK_07ead93f043573dbecfc58069e9"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_b2148224ec3f5d42d809f721232"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_7c33f25440de9bee0ee109e676d"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_ddd117b5c50bf2a252afa90d64a"`);
        await queryRunner.query(`ALTER TABLE "service_absences" DROP CONSTRAINT "FK_2777e673dd5e31b346ba3b2f6da"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP CONSTRAINT "FK_61553c0ad11b34715acac09190d"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP CONSTRAINT "FK_f0a69e478481862774c14778f98"`);
        await queryRunner.query(`ALTER TABLE "service_assignments" DROP CONSTRAINT "FK_150a611026d4cdf26e7b3634f53"`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_unavailability" ADD CONSTRAINT "FK_07ead93f043573dbecfc58069e9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_b2148224ec3f5d42d809f721232" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_absences" ADD CONSTRAINT "FK_2777e673dd5e31b346ba3b2f6da" FOREIGN KEY ("service_id", "user_id") REFERENCES "service_assignments"("service_id","user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD CONSTRAINT "FK_61553c0ad11b34715acac09190d" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD CONSTRAINT "FK_f0a69e478481862774c14778f98" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_assignments" ADD CONSTRAINT "FK_150a611026d4cdf26e7b3634f53" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
