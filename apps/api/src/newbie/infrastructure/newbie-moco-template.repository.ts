import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NewbieMocoTemplate } from '../domain/newbie-moco-template.entity';
import { NewbieMocoTemplateSaveDto } from '../dto/newbie-moco-template-save.dto';

@Injectable()
export class NewbieMocoTemplateRepository {
  constructor(
    @InjectRepository(NewbieMocoTemplate)
    private readonly repo: Repository<NewbieMocoTemplate>,
  ) {}

  /** guildId로 모코코 템플릿 단건 조회. 레코드 없으면 null 반환. */
  async findByGuildId(guildId: string): Promise<NewbieMocoTemplate | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  /**
   * 모코코 템플릿 생성 또는 갱신 (guildId 기준).
   * 레코드 없으면 INSERT, 있으면 UPDATE.
   */
  async upsert(guildId: string, dto: NewbieMocoTemplateSaveDto): Promise<NewbieMocoTemplate> {
    let tmpl = await this.repo.findOne({ where: { guildId } });

    if (tmpl) {
      tmpl.titleTemplate = dto.titleTemplate ?? null;
      tmpl.bodyTemplate = dto.bodyTemplate ?? null;
      tmpl.itemTemplate = dto.itemTemplate ?? null;
      tmpl.footerTemplate = dto.footerTemplate ?? null;
    } else {
      tmpl = this.repo.create({
        guildId,
        titleTemplate: dto.titleTemplate ?? null,
        bodyTemplate: dto.bodyTemplate ?? null,
        itemTemplate: dto.itemTemplate ?? null,
        footerTemplate: dto.footerTemplate ?? null,
      });
    }

    return this.repo.save(tmpl);
  }
}
