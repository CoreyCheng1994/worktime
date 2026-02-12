import { Body, Controller, Delete, Get, Headers, MessageEvent, Param, Post, Put, Query, Sse } from "@nestjs/common";
import { Observable } from "rxjs";
import { WorkService } from "./work.service";
import { WorkEventsService } from "./work-events.service";
import {
  BatchCreateInput,
  CreateItemInput,
  NormalizeWorkInput,
  TimeSlotInput,
  UpdateItemInput
} from "./work.types";

@Controller("work")
export class WorkController {
  constructor(
    private readonly workService: WorkService,
    private readonly workEventsService: WorkEventsService
  ) {}

  @Get("day")
  async getDay(@Query("date") date: string) {
    return await this.workService.getDay(date);
  }

  @Get("month")
  async getMonth(@Query("month") month: string) {
    return await this.workService.getMonthReport(month);
  }

  @Get("month-overview")
  async getMonthOverview(@Query("month") month: string) {
    return await this.workService.getMonthOverview(month);
  }

  @Sse("events")
  events(): Observable<MessageEvent> {
    return this.workEventsService.stream();
  }

  @Put("day/:date/slots")
  async saveSlots(@Param("date") date: string, @Body() slots: TimeSlotInput[]) {
    return await this.workService.saveSlots(date, slots);
  }

  @Post("day/:date/items")
  async createItem(
    @Param("date") date: string,
    @Body() input: CreateItemInput,
    @Headers("x-worktime-source") source?: string
  ) {
    return await this.workService.createItem(date, input, source);
  }

  @Put("items/:itemId")
  async updateItem(
    @Param("itemId") itemId: string,
    @Body() input: UpdateItemInput,
    @Headers("x-worktime-source") source?: string
  ) {
    return await this.workService.updateItem(Number(itemId), input, source);
  }

  @Delete("items/:itemId")
  async deleteItem(@Param("itemId") itemId: string, @Headers("x-worktime-source") source?: string) {
    await this.workService.deleteItem(Number(itemId), source);
    return { ok: true };
  }

  @Post("normalize")
  async normalize(@Body() input: NormalizeWorkInput | string) {
    return await this.workService.normalizeWork(input);
  }

  @Post("batch-items")
  async createItemsBatch(@Body() input: BatchCreateInput, @Headers("x-worktime-source") source?: string) {
    return await this.workService.createItemsBatch(input, source);
  }
}
