import * as React from "react";
import type { Task, TimeBlock } from "@open-sunsama/types";
import { CalendarView } from "@/components/calendar";
import { TaskModal } from "@/components/kanban/task-modal.lazy";
import { TimeBlockDetailSheet } from "@/components/calendar/time-block-detail-sheet";
import { QuickCreatePopup } from "@/components/calendar/quick-create-popup";
import { useTask, useCreateTimeBlock } from "@/hooks";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileCalendarView } from "@/components/mobile";

/**
 * Calendar page with time blocking functionality
 * Displays a day view with unscheduled tasks panel and timeline
 */
export default function CalendarPage() {
  const isMobile = useIsMobile();
  
  // Task detail panel state
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = React.useState(false);
  
  // Time block detail sheet state
  const [selectedTimeBlock, setSelectedTimeBlock] = React.useState<TimeBlock | null>(null);
  const [timeBlockSheetOpen, setTimeBlockSheetOpen] = React.useState(false);
  
  // Quick-create popup state
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);
  const [quickCreateDate, setQuickCreateDate] = React.useState<Date>(new Date());
  const [quickCreateStartTime, setQuickCreateStartTime] = React.useState<Date>(new Date());
  const [quickCreateEndTime, setQuickCreateEndTime] = React.useState<Date | undefined>();

  // Fetch task by ID when viewing from context menu
  const { data: fetchedTask } = useTask(selectedTaskId ?? "");

  // Update selectedTask when fetchedTask changes
  React.useEffect(() => {
    if (fetchedTask && selectedTaskId) {
      setSelectedTask(fetchedTask);
      setTaskPanelOpen(true);
      setSelectedTaskId(null); // Clear the ID after fetching
    }
  }, [fetchedTask, selectedTaskId]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskPanelOpen(true);
  };

  const handleViewTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleBlockClick = (block: TimeBlock) => {
    if (block.taskId) {
      // Open task modal directly for linked blocks
      setSelectedTaskId(block.taskId);
    } else {
      // Standalone block — edit time block details
      setSelectedTimeBlock(block);
      setTimeBlockSheetOpen(true);
    }
  };

  const handleEditBlock = (block: TimeBlock) => {
    setSelectedTimeBlock(block);
    setTimeBlockSheetOpen(true);
  };

  const handleTaskPanelOpenChange = (open: boolean) => {
    setTaskPanelOpen(open);
    if (!open) {
      setSelectedTask(null);
    }
  };

  const handleTimeBlockSheetOpenChange = (open: boolean) => {
    setTimeBlockSheetOpen(open);
    if (!open) {
      setSelectedTimeBlock(null);
    }
  };

  const handleTimeSlotClick = (date: Date, startTime: Date, endTime: Date) => {
    setQuickCreateDate(date);
    setQuickCreateStartTime(startTime);
    setQuickCreateEndTime(endTime);
    setQuickCreateOpen(true);
  };

  const handleQuickCreate = (date: Date, startTime: Date, endTime?: Date) => {
    setQuickCreateDate(date);
    setQuickCreateStartTime(startTime);
    setQuickCreateEndTime(endTime);
    setQuickCreateOpen(true);
  };

  if (isMobile) {
    // Wire the same handlers the desktop branch uses so the mobile
    // FAB, time-block taps, and drawer-task taps actually open the
    // right sheets / dialogs. Without these props the mobile surface
    // is read-only by accident — every tap is a no-op.
    return (
      <>
        <MobileCalendarView
          onTaskClick={handleTaskClick}
          onBlockClick={handleBlockClick}
          onViewTask={handleViewTask}
          onTimeSlotClick={handleTimeSlotClick}
        />
        <TaskModal
          task={selectedTask}
          open={taskPanelOpen}
          onOpenChange={handleTaskPanelOpenChange}
        />
        <TimeBlockDetailSheet
          timeBlock={selectedTimeBlock}
          open={timeBlockSheetOpen}
          onOpenChange={handleTimeBlockSheetOpenChange}
        />
        <QuickCreatePopup
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          date={quickCreateDate}
          startTime={quickCreateStartTime}
          endTime={quickCreateEndTime}
          onNextBlock={(nextStart) => {
            setQuickCreateStartTime(nextStart);
            setQuickCreateEndTime(undefined);
            setQuickCreateOpen(true);
          }}
        />
      </>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <CalendarView
        onTaskClick={handleTaskClick}
        onBlockClick={handleBlockClick}
        onEditBlock={handleEditBlock}
        onViewTask={handleViewTask}
        onTimeSlotClick={handleTimeSlotClick}
        onQuickCreate={handleQuickCreate}
      />

      {/* Task Modal - reused from kanban */}
      <TaskModal
        task={selectedTask}
        open={taskPanelOpen}
        onOpenChange={handleTaskPanelOpenChange}
      />

      {/* Time Block Detail Sheet */}
      <TimeBlockDetailSheet
        timeBlock={selectedTimeBlock}
        open={timeBlockSheetOpen}
        onOpenChange={handleTimeBlockSheetOpenChange}
      />

      {/* Quick-create popup */}
      <QuickCreatePopup
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        date={quickCreateDate}
        startTime={quickCreateStartTime}
        endTime={quickCreateEndTime}
        onNextBlock={(nextStart) => {
          setQuickCreateStartTime(nextStart);
          setQuickCreateEndTime(undefined);
          setQuickCreateOpen(true);
        }}
      />
    </div>
  );
}
