import { Module } from "@nestjs/common";
import { SystemConfigController } from "./system-config.controller";
import { SystemMcpController } from "./system-mcp.controller";
import { SystemMcpService } from "./system-mcp.service";

@Module({
  controllers: [SystemConfigController, SystemMcpController],
  providers: [SystemMcpService]
})
export class SystemConfigModule {}
