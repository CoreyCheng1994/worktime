import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { WorkService } from "./work.service";
import {
  BatchCreateInput,
  CreateItemInput,
  NormalizeWorkInput,
  TimeSlotInput,
  UpdateItemInput
} from "./work.types";

@Controller("work")
export class WorkController {
  constructor(private readonly workService: WorkService) {}

  @Get("day")
  async getDay(@Query("date") date: string) {
    return await this.workService.getDay(date);
  }

  @Get("month")
  async getMonth(@Query("month") month: string) {
    return await this.workService.getMonthReport(month);
  }

  @Put("day/:date/slots")
  async saveSlots(@Param("date") date: string, @Body() slots: TimeSlotInput[]) {
    return await this.workService.saveSlots(date, slots);
  }

  @Post("day/:date/items")
  async createItem(@Param("date") date: string, @Body() input: CreateItemInput) {
    return await this.workService.createItem(date, input);
  }

  @Put("items/:itemId")
  async updateItem(@Param("itemId") itemId: string, @Body() input: UpdateItemInput) {
    return await this.workService.updateItem(Number(itemId), input);
  }

  @Delete("items/:itemId")
  async deleteItem(@Param("itemId") itemId: string) {
    await this.workService.deleteItem(Number(itemId));
    return { ok: true };
  }

  @Post("normalize")
  async normalize(@Body() input: NormalizeWorkInput | string) {
    return await this.workService.normalizeWork(input);
  }

  @Post("batch-items")
  async createItemsBatch(@Body() input: BatchCreateInput) {
    return await this.workService.createItemsBatch(input);
  }
}
