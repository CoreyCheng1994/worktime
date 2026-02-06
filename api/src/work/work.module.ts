import { Module } from "@nestjs/common";
import { WorkController } from "./work.controller";
import { MySqlWorkRepository } from "./mysql.repository";
import { OpenAiService } from "./openai.service";
import { WORK_REPOSITORY } from "./work.repository";
import { WorkService } from "./work.service";

@Module({
  controllers: [WorkController],
  providers: [
    WorkService,
    {
      provide: WORK_REPOSITORY,
      useClass: MySqlWorkRepository
    },
    OpenAiService
  ]
})
export class WorkModule {}
