import { Injectable, MessageEvent } from "@nestjs/common";
import { Observable, Subject, interval, map, merge } from "rxjs";

export interface WorkChangedEventPayload {
  type: "task_changed";
  action: "create_item" | "update_item" | "delete_item" | "batch_create_items";
  date?: string;
  source: "api" | "mcp";
  at: string;
}

@Injectable()
export class WorkEventsService {
  private readonly taskChangedSubject = new Subject<WorkChangedEventPayload>();

  emitTaskChanged(payload: Omit<WorkChangedEventPayload, "type" | "at">) {
    this.taskChangedSubject.next({
      type: "task_changed",
      at: new Date().toISOString(),
      ...payload
    });
  }

  stream(): Observable<MessageEvent> {
    const keepAlive$ = interval(25000).pipe(
      map(
        () =>
          ({
            type: "ping",
            data: { at: new Date().toISOString() }
          }) satisfies MessageEvent
      )
    );

    const taskChanged$ = this.taskChangedSubject.pipe(
      map(
        (event) =>
          ({
            type: "work_changed",
            data: event
          }) satisfies MessageEvent
      )
    );

    return merge(keepAlive$, taskChanged$);
  }
}
