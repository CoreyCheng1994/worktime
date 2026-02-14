import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskCalendar } from "./TaskCalendar";

describe("TaskCalendar", () => {
  it("renders month title based on value", () => {
    render(<TaskCalendar value="2026-02-10" onChange={() => {}} statusItems={[]} />);
    expect(screen.getByText("2026年2月")).toBeInTheDocument();
  });

  it("calls onChange when clicking a day", async () => {
    const onChange = vi.fn<(date: string) => void>();
    const user = userEvent.setup();

    render(<TaskCalendar value="2026-02-10" onChange={onChange} statusItems={[]} />);

    await user.click(screen.getByRole("button", { name: "1" }));
    expect(onChange).toHaveBeenCalledWith("2026-02-01");
  });

  it("calls onMonthChange when navigating months", async () => {
    const onMonthChange = vi.fn<(month: string) => void>();
    const user = userEvent.setup();

    render(
      <TaskCalendar
        value="2026-02-10"
        onChange={() => {}}
        statusItems={[]}
        onMonthChange={onMonthChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "›" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-03");
    expect(screen.getByText("2026年3月")).toBeInTheDocument();
  });

  it("renders statutory holiday and makeup workday markers", () => {
    render(
      <TaskCalendar
        value="2026-02-10"
        onChange={() => {}}
        statusItems={[]}
        holidayItems={[
          {
            date: "2026-02-14",
            type: "makeupWorkday",
            label: "班",
            name: "春节前补班（调休补班）"
          },
          {
            date: "2026-02-15",
            type: "statutoryHoliday",
            label: "春节",
            name: "春节（法定节假日）"
          }
        ]}
      />
    );

    const makeupButton = screen.getByRole("button", { name: "14" });
    const holidayButton = screen.getByRole("button", { name: "15" });
    const makeupTag = within(makeupButton).getByText("班");
    const holidayTag = within(holidayButton).getByText("春节");

    expect(makeupTag).toHaveAttribute("title", "春节前补班（调休补班）");
    expect(holidayTag).toHaveAttribute("title", "春节（法定节假日）");
  });
});
