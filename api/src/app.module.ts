import { Module } from "@nestjs/common";
import { SystemConfigModule } from "./system/system-config.module";
import { WorkModule } from "./work/work.module";

@Module({
  imports: [SystemConfigModule, WorkModule]
})
export class AppModule {}
