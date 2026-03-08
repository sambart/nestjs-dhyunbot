import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlayCountOptions1774000000000 implements MigrationInterface {
    name = 'AddPlayCountOptions1774000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "newbie_config" ADD "playCountMinDurationMin" integer`);
        await queryRunner.query(`ALTER TABLE "newbie_config" ADD "playCountIntervalMin" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "playCountIntervalMin"`);
        await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "playCountMinDurationMin"`);
    }

}
