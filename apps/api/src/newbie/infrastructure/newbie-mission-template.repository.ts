import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NewbieMissionTemplateSaveDto } from '../dto/newbie-mission-template-save.dto';
import { NewbieMissionTemplateOrmEntity as NewbieMissionTemplate } from './newbie-mission-template.orm-entity';

@Injectable()
export class NewbieMissionTemplateRepository {
  constructor(
    @InjectRepository(NewbieMissionTemplate)
    private readonly repo: Repository<NewbieMissionTemplate>,
  ) {}

  /** guildId로 미션 템플릿 단건 조회. 레코드 없으면 null 반환. */
  async findByGuildId(guildId: string): Promise<NewbieMissionTemplate | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  /**
   * 미션 템플릿 생성 또는 갱신 (guildId 기준).
   * 레코드 없으면 INSERT, 있으면 UPDATE.
   */
  async upsert(guildId: string, dto: NewbieMissionTemplateSaveDto): Promise<NewbieMissionTemplate> {
    let tmpl = await this.repo.findOne({ where: { guildId } });

    if (tmpl) {
      tmpl.titleTemplate = dto.titleTemplate ?? null;
      tmpl.headerTemplate = dto.headerTemplate ?? null;
      tmpl.itemTemplate = dto.itemTemplate ?? null;
      tmpl.footerTemplate = dto.footerTemplate ?? null;
      tmpl.statusMapping = dto.statusMapping ?? null;
    } else {
      tmpl = this.repo.create({
        guildId,
        titleTemplate: dto.titleTemplate ?? null,
        headerTemplate: dto.headerTemplate ?? null,
        itemTemplate: dto.itemTemplate ?? null,
        footerTemplate: dto.footerTemplate ?? null,
        statusMapping: dto.statusMapping ?? null,
      });
    }

    return this.repo.save(tmpl);
  }
}
