import * as React from "react";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
} from "date-fns";
import type {
  Task,
  TimeBlock,
  CalendarEvent,
  CalendarViewMode,
} from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  useTasks,
  useTimeBlocksForDate,
  useTimeBlocksForDateRange,
  useCreateTimeBlock,
  useCascadeResizeTimeBlock,
} from "@/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useSavePreferences } from "@/hooks/useUserPreferences";
import { isCalendarReadOnlyForUi } from "@/lib/calendar-providers";
import {
  useCalendarEvents,
  useCalendars,
  useCalendarAccounts,
  useUpdateCalendarEvent,
} from "@/hooks/useCalendars";
import { useCalendarDnd } from "@/hooks/useCalendarDnd";
import { Timeline } from "./timeline";
import { MultiDayView } from "./multi-day-view";
import { MonthView } from "./month-view";
import { ScheduleTextPanel } from "./schedule-text-panel";
import { UnscheduledTasksPanel } from "./unscheduled-tasks";
import { DragOverlay } from "./drag-overlay";
import { CalendarViewToolbar } from "./calendar-view-toolbar";
import { CalendarEventDetailSheet } from "./calendar-event-detail-sheet";
import {
  AddTaskModal,
  prefetchAddTaskModal,
} from "@/components/kanban/add-task-modal.lazy";

/**
 * Persist the calendar view mode in localStorage so the user's choice
 * survives across reloads even before the server-side preference write
 * lands. We also seed from `user.preferences.calendarViewMode` if it's
 * set so the choice can flow across devices via the canonical
 * preferences sync path.
 */
const VIEW_MODE_STORAGE_KEY = "open_sunsama_calendar_view_mode";

/**
 * Hours-view zoom: pixels per hour. 64 is the standard day-view scale;
 * the levels give 75% / 100% / 150% / 200%. Persisted across sessions.
 */
const HOURS_ZOOM_LEVELS = [48, 64, 96, 128] as const;
const DEFAULT_HOURS_ZOOM = 64;
const HOURS_ZOOM_STORAGE_KEY = "open_sunsama_hours_zoom";
const SCHEDULE_PANEL_STORAGE_KEY = "open_sunsama_hours_schedule_panel";

function getStoredHoursZoom(): number {
  if (typeof window === "undefined") return DEFAULT_HOURS_ZOOM;
  const v = Number(window.localStorage.getItem(HOURS_ZOOM_STORAGE_KEY));
  return (HOURS_ZOOM_LEVELS as readonly number[]).includes(v) ? v : DEFAULT_HOURS_ZOOM;
}

function getStoredSchedulePanelOpen(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SCHEDULE_PANEL_STORAGE_KEY) !== "0";
}

function getStoredViewMode(): CalendarViewMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (v === "hours" || v === "day" || v === "3-day" || v === "week" || v === "month") return v;
  return null;
}

function storeViewMode(mode: CalendarViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore quota errors
  }
}

interface VisibleRange {
  start: Date;
  end: Date;
  /** Days the columns iterate over (day=1, 3-day=3, week=7, month=N) */
  days: Date[];
}

function computeRange(
  selectedDate: Date,
  viewMode: CalendarViewMode,
  weekStartsOn: 0 | 1
): VisibleRange {
  switch (viewMode) {
    case "hours":
    case "day": {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);
      return { start, end, days: [start] };
    }
    case "3-day": {
      const start = startOfDay(selectedDate);
      const end = endOfDay(addDays(start, 2));
      return {
        start,
        end,
        days: [0, 1, 2].map((i) => addDays(start, i)),
      };
    }
    case "week": {
      const start = startOfWeek(selectedDate, { weekStartsOn });
      const end = endOfWeek(selectedDate, { weekStartsOn });
      return {
        start,
        end,
        days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
      };
    }
    case "month": {
      // Server fetch should cover from the first visible cell (the prior
      // month's tail in the first row) to the last visible cell (the
      // next month's head in the last row).
      const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn });
      const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn });
      return { start, end, days: [] /* not used by month grid */ };
    }
  }
}

interface CalendarViewProps {
  initialDate?: Date;
  onTaskClick?: (task: Task) => void;
  onBlockClick?: (block: TimeBlock) => void;
  onEditBlock?: (block: TimeBlock) => void;
  onViewTask?: (taskId: string) => void;
  onTimeSlotClick?: (date: Date, startTime: Date, endTime: Date) => void;
  className?: string;
}

/**
 * CalendarView - Main calendar view container with two-panel layout
 */
export function CalendarView({
  initialDate = new Date(),
  onTaskClick,
  onBlockClick,
  onEditBlock,
  onViewTask,
  onTimeSlotClick,
  className,
}: CalendarViewProps) {
  const { user } = useAuth();
  const weekStartsOn = (user?.preferences?.weekStartsOn ?? 0) as 0 | 1;

  // Selected date state — anchors the visible range
  const [selectedDate, setSelectedDate] = React.useState<Date>(() =>
    startOfDay(initialDate)
  );

  // Hours-view zoom (px per hour) + schedule panel visibility.
  const [hoursZoom, setHoursZoom] = React.useState<number>(getStoredHoursZoom);
  const [schedulePanelOpen, setSchedulePanelOpen] = React.useState<boolean>(
    getStoredSchedulePanelOpen
  );
  const setHoursZoomPersisted = React.useCallback((zoom: number) => {
    setHoursZoom(zoom);
    try {
      window.localStorage.setItem(HOURS_ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      // ignore quota errors
    }
  }, []);
  const toggleSchedulePanel = React.useCallback(() => {
    setSchedulePanelOpen((open) => {
      try {
        window.localStorage.setItem(SCHEDULE_PANEL_STORAGE_KEY, open ? "0" : "1");
      } catch {
        // ignore quota errors
      }
      return !open;
    });
  }, []);
  const zoomStep = React.useCallback(
    (direction: 1 | -1) => {
      const idx = (HOURS_ZOOM_LEVELS as readonly number[]).indexOf(hoursZoom);
      const next = Math.min(
        HOURS_ZOOM_LEVELS.length - 1,
        Math.max(0, (idx === -1 ? 1 : idx) + direction)
      );
      setHoursZoomPersisted(HOURS_ZOOM_LEVELS[next]!);
    },
    [hoursZoom, setHoursZoomPersisted]
  );
  const zoomIn = React.useCallback(() => zoomStep(1), [zoomStep]);
  const zoomOut = React.useCallback(() => zoomStep(-1), [zoomStep]);
  const zoomPercent = Math.round((hoursZoom / DEFAULT_HOURS_ZOOM) * 100);
  const canZoomIn = hoursZoom < HOURS_ZOOM_LEVELS[HOURS_ZOOM_LEVELS.length - 1]!;
  const canZoomOut = hoursZoom > HOURS_ZOOM_LEVELS[0]!;

  // View mode: prefer server-synced preference; fall back to localStorage,
  // then to "day".
  const [viewMode, setViewModeRaw] = React.useState<CalendarViewMode>(() => {
    return (
      user?.preferences?.calendarViewMode ?? getStoredViewMode() ?? "day"
    );
  });
  // If the server preference loads *after* mount (typical: /auth/me
  // resolves shortly after the first paint), seed it into local state
  // exactly once. The server is the source of truth for cross-device
  // sync — if you picked "week" on desktop and open the phone, the
  // phone's view should update to "week" even if its localStorage
  // happens to remember a different value from a prior session.
  // (PR #42 was supposed to enable this but the server schema was
  // dropping the field; once that's fixed, we also need to drop the
  // localStorage gate that the original effect had — which silently
  // pinned each device to whatever it last had.)
  // We use a ref to ensure subsequent server pushes (e.g. another
  // tab updating prefs) don't fight with the user's local picks
  // after mount — first arrival wins, then local state owns.
  const didSeedFromServerRef = React.useRef(false);
  const viewModeRef = React.useRef(viewMode);
  viewModeRef.current = viewMode;
  // Tracks whether the user has interacted with the view-mode toggle
  // since mount. If they have, we never seed from a late-arriving
  // server value — their explicit pick beats a stale server value
  // that happened to lose the race. (First-login-on-device case:
  // no cached user → lazy init falls back to "day" → user picks
  // "month" → /auth/me arrives 2s later with "week" → without this
  // gate the user's pick gets silently clobbered.)
  const userInteractedRef = React.useRef(false);
  React.useEffect(() => {
    if (didSeedFromServerRef.current) return;
    if (userInteractedRef.current) return;
    const remote = user?.preferences?.calendarViewMode;
    if (!remote) return;
    didSeedFromServerRef.current = true;
    if (remote !== viewModeRef.current) {
      setViewModeRaw(remote);
    }
  }, [user?.preferences?.calendarViewMode]);

  const savePreferences = useSavePreferences();
  const setViewMode = React.useCallback(
    (mode: CalendarViewMode) => {
      // No-op short-circuit: pressing the same view's key (e.g. "d"
      // when already on day) shouldn't fire a redundant PATCH.
      if (mode === viewModeRef.current) return;
      // Mark the user as having interacted so a late /auth/me push
      // can't clobber this pick (see the seed effect for context).
      userInteractedRef.current = true;
      setViewModeRaw(mode);
      storeViewMode(mode);
      // Also write the preference back to the server so the choice
      // syncs across devices. We send the full preferences object
      // (server replaces it wholesale) by spreading the current
      // user.preferences and overriding calendarViewMode. The hook
      // is a no-op for unauthenticated users and swallows errors —
      // the local change still sticks via setViewModeRaw +
      // storeViewMode, so a transient API failure doesn't break UX.
      if (user?.preferences) {
        savePreferences.mutate({
          ...user.preferences,
          calendarViewMode: mode,
        });
      } else if (user) {
        // Authenticated but no prefs object yet — seed with safe
        // defaults for the required theme fields plus the chosen
        // view mode. Future writes will preserve siblings.
        savePreferences.mutate({
          themeMode: "system" as const,
          colorTheme: "default",
          fontFamily: "geist",
          calendarViewMode: mode,
        });
      }
    },
    [savePreferences, user]
  );

  // The window of days currently visible.
  const range = React.useMemo(
    () => computeRange(selectedDate, viewMode, weekStartsOn),
    [selectedDate, viewMode, weekStartsOn]
  );

  // Format date for API calls
  const dateString = format(selectedDate, "yyyy-MM-dd");

  // Fetch tasks for selected date (only used for unscheduled-tasks panel
  // in day view). For multi-day / month we don't show that panel.
  const { data: allTasks = [], isLoading: isLoadingTasks } = useTasks({
    scheduledDate: dateString,
    limit: 200,
  });

  // Fetch time blocks for the visible range. Day view stays on the
  // single-day endpoint to avoid changing its cache key shape; multi-day
  // and month use the range endpoint.
  const { data: dayTimeBlocks = [], isLoading: isLoadingDayBlocks } =
    useTimeBlocksForDate(dateString);
  const { data: rangeTimeBlocks = [], isLoading: isLoadingRangeBlocks } =
    useTimeBlocksForDateRange(range.start, range.end);
  const isSingleDayView = viewMode === "day" || viewMode === "hours";
  const timeBlocks = isSingleDayView ? dayTimeBlocks : rangeTimeBlocks;
  const isLoadingBlocks =
    isSingleDayView ? isLoadingDayBlocks : isLoadingRangeBlocks;

  // Fetch external calendar events for the visible range. `.toISOString()`
  // encodes the user's local-day boundary as a real UTC instant so the
  // server parses it back to the same instant.
  const fromDate = range.start.toISOString();
  const toDate = range.end.toISOString();
  const { data: calendarEvents = [] } = useCalendarEvents(fromDate, toDate);

  // Intervals for the adjacency snap: when dragging or creating a block
  // near the end of another event, the start snaps to that end while
  // keeping the block's own duration. Anchored on the selected (single)
  // day — the snap only runs on the day/hours timeline path.
  const snapIntervals = React.useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const intervals: { id: string; start: Date; end: Date }[] = [];
    for (const block of dayTimeBlocks) {
      const start = new Date(block.startTime);
      if (isSameDay(start, selectedDate)) {
        intervals.push({ id: block.id, start, end: new Date(block.endTime) });
      }
    }
    for (const event of calendarEvents) {
      if (event.isAllDay) continue;
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      if (start < dayEnd && end > dayStart) {
        intervals.push({ id: event.id, start, end });
      }
    }
    return intervals;
  }, [dayTimeBlocks, calendarEvents, selectedDate]);

  // Per-calendar capability map — used by the detail sheet to gate the
  // edit / delete affordances. A calendar is editable if (a) the
  // provider supports write-back AND (b) the calendar isn't flagged
  // read-only by the provider itself (subscriptions, holidays, etc.).
  // Provider info lives on the account; we resolve via accountId.
  const { data: calendarsList = [] } = useCalendars();
  const { data: calendarAccounts = [] } = useCalendarAccounts();
  const accountProviderById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const a of calendarAccounts) m.set(a.id, a.provider);
    return m;
  }, [calendarAccounts]);
  const calendarReadOnlyById = React.useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of calendarsList) {
      const provider = accountProviderById.get(c.accountId);
      m.set(c.id, isCalendarReadOnlyForUi(provider, c.isReadOnly));
    }
    return m;
  }, [calendarsList, accountProviderById]);

  // Per-calendar provider map — passed to the detail sheet so the
  // recurring-event disclosure copy can branch on provider (iCloud
  // edits hit the entire series; Google/Outlook hit one instance).
  const calendarProviderById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of calendarsList) {
      const provider = accountProviderById.get(c.accountId);
      if (provider) m.set(c.id, provider);
    }
    return m;
  }, [calendarsList, accountProviderById]);

  // Mutations
  const createTimeBlock = useCreateTimeBlock();
  const cascadeResizeTimeBlock = useCascadeResizeTimeBlock();

  // Filter tasks that don't have a time block on this day
  const unscheduledTasks = React.useMemo(() => {
    const blockedTaskIds = new Set(
      timeBlocks.filter((b) => b.taskId).map((b) => b.taskId)
    );
    return allTasks.filter(
      (task) => !task.completedAt && !blockedTaskIds.has(task.id)
    );
  }, [allTasks, timeBlocks]);

  // Calendar DnD hook
  const updateCalendarEvent = useUpdateCalendarEvent();

  const {
    dragState,
    dropPreview,
    isDragging,
    justEndedDrag,
    timelineRef,
    startTaskDrag,
    startBlockDrag,
    startBlockResize,
    startEventDrag,
    startEventResize,
    updateDrag,
    endDrag,
    cancelDrag,
  } = useCalendarDnd(selectedDate, {
    snapIntervals,
    // Drag previews must match the rendered zoom or the ghost detaches
    // from the cursor in the hours view.
    hourHeight: viewMode === "hours" ? hoursZoom : undefined,
    onTaskDrop: (taskId, startTime, endTime) => {
      const task = unscheduledTasks.find((t) => t.id === taskId);
      if (task) {
        createTimeBlock.mutate({
          taskId,
          title: task.title,
          startTime,
          endTime,
        });
      }
    },
    onBlockMove: (blockId, startTime, endTime) => {
      // Moves cascade through blocks connected by touching boundaries
      // (same endpoint as resizes) — the whole back-to-back chain
      // follows, each block keeping its own duration.
      cascadeResizeTimeBlock.mutate({ id: blockId, startTime, endTime });
    },
    onBlockResize: (blockId, startTime, endTime) => {
      // Use cascade resize to automatically shift blocks below (server-side)
      cascadeResizeTimeBlock.mutate({
        id: blockId,
        startTime,
        endTime,
      });
    },
    onEventMove: (eventId, startTime, endTime) => {
      // Write the new times back to the provider via the same path
      // that the detail-sheet edit uses. The hook handles optimistic
      // cache update + rollback + cross-range invalidation.
      updateCalendarEvent.mutate({
        id: eventId,
        rangeFrom: fromDate,
        rangeTo: toDate,
        patch: {
          startTime,
          endTime,
          // Preserve the user's local TZ on the round-trip; without it
          // Google would default to UTC and the displayed time would
          // shift on re-render.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
    },
    onEventResize: (eventId, startTime, endTime) => {
      updateCalendarEvent.mutate({
        id: eventId,
        rangeFrom: fromDate,
        rangeTo: toDate,
        patch: {
          startTime,
          endTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
    },
  });

  // Navigation handlers — step size depends on view mode.
  // Hours/Day → ±1 day; 3-Day → ±3 days; Week → ±1 week; Month → ±1 month.
  const goToPreviousDay = React.useCallback(() => {
    setSelectedDate((d) => {
      if (viewMode === "day" || viewMode === "hours") return subDays(d, 1);
      if (viewMode === "3-day") return subDays(d, 3);
      if (viewMode === "week") return subWeeks(d, 1);
      return subMonths(d, 1); // "month"
    });
  }, [viewMode]);
  const goToNextDay = React.useCallback(() => {
    setSelectedDate((d) => {
      if (viewMode === "day" || viewMode === "hours") return addDays(d, 1);
      if (viewMode === "3-day") return addDays(d, 3);
      if (viewMode === "week") return addWeeks(d, 1);
      return addMonths(d, 1); // "month"
    });
  }, [viewMode]);
  const goToToday = () => setSelectedDate(startOfDay(new Date()));

  // Keyboard shortcuts — match Google Calendar's defaults so the muscle
  // memory transfers cleanly:
  //   H = Hours, D = Day, X = 3 days (their "4 days" key, near enough),
  //   W = Week, M = Month, T = Today, J = previous range, K = next range.
  //   +/= = zoom in, -/_ = zoom out (hours view only).
  // Skip when focus is in a form field OR when ANY modal/popover is
  // open — without the second guard, pressing "M" while an event
  // detail sheet is open silently switches the calendar view behind
  // the overlay because the focused dialog body doesn't match
  // INPUT/TEXTAREA/SELECT/contentEditable.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Radix open overlays are tagged with `data-state="open"`. If
      // any modal-style overlay is mounted-and-open, swallow the
      // shortcut. We cover dialog (Sheet/Dialog), alertdialog
      // (confirm prompts), AND menu (ContextMenu / DropdownMenu) —
      // without the menu match, right-clicking a time block to open
      // its context menu and then pressing a letter shortcut would
      // silently switch the calendar view behind the open menu.
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], ' +
          '[role="alertdialog"][data-state="open"], ' +
          '[role="menu"][data-state="open"]'
        )
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "h":
          setViewMode("hours");
          break;
        case "d":
          setViewMode("day");
          break;
        case "x":
          setViewMode("3-day");
          break;
        case "w":
          setViewMode("week");
          break;
        case "m":
          setViewMode("month");
          break;
        case "t":
          goToToday();
          break;
        case "j":
          goToPreviousDay();
          break;
        case "k":
          goToNextDay();
          break;
        case "=":
        case "+":
          if (viewModeRef.current === "hours") zoomIn();
          break;
        case "-":
        case "_":
          if (viewModeRef.current === "hours") zoomOut();
          break;
        default:
          return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setViewMode, goToPreviousDay, goToNextDay, zoomIn, zoomOut]);

  // Mouse handlers for drag
  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateDrag(e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());
    }
  };

  const handleTimelineMouseUp = () => {
    if (isDragging) {
      endDrag();
    }
  };

  const handleTimelineMouseLeave = () => {
    // Don't cancel drag on mouse leave - let it continue
  };

  // Global mouse and touch events for drag
  React.useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseUp = () => endDrag();
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (timelineRef.current) {
        updateDrag(e.clientY, timelineRef.current.getBoundingClientRect());
      }
    };
    
    // Touch event handlers for mobile
    const handleGlobalTouchEnd = () => endDrag();
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (timelineRef.current && e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
          updateDrag(touch.clientY, timelineRef.current.getBoundingClientRect());
          // Prevent page scrolling while dragging
          e.preventDefault();
        }
      }
    };
    const handleGlobalTouchCancel = () => cancelDrag();
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrag();
    };

    // Mouse events
    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("mousemove", handleGlobalMouseMove);
    
    // Touch events with passive: false to allow preventDefault
    document.addEventListener("touchend", handleGlobalTouchEnd);
    document.addEventListener("touchmove", handleGlobalTouchMove, { passive: false });
    document.addEventListener("touchcancel", handleGlobalTouchCancel);
    
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("touchend", handleGlobalTouchEnd);
      document.removeEventListener("touchmove", handleGlobalTouchMove);
      document.removeEventListener("touchcancel", handleGlobalTouchCancel);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDragging, endDrag, cancelDrag, updateDrag, timelineRef]);

  // Task drag handlers
  const handleTaskDragStart = (task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    startTaskDrag(task, e.clientY);
  };

  // Block drag handlers
  const handleBlockDragStart = (block: TimeBlock, e: React.MouseEvent) => {
    e.preventDefault();
    startBlockDrag(block, e.clientY);
  };

  const handleBlockResizeStart = (
    block: TimeBlock,
    edge: "top" | "bottom",
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    startBlockResize(block, edge, e.clientY);
  };

  const isLoading = isLoadingTasks || isLoadingBlocks;

  // External calendar event interaction. Clicking an event opens an
  // in-app detail sheet — replacing the previous (broken) behaviour
  // where the click both opened the provider's web UI in a new tab AND
  // bubbled to the timeline's create-time-block dialog.
  const [selectedExternalEvent, setSelectedExternalEvent] =
    React.useState<CalendarEvent | null>(null);
  const [externalEventSheetOpen, setExternalEventSheetOpen] =
    React.useState(false);

  const handleExternalEventClick = React.useCallback((event: CalendarEvent) => {
    setSelectedExternalEvent(event);
    setExternalEventSheetOpen(true);
  }, []);

  const handleExternalEventSheetOpenChange = React.useCallback(
    (next: boolean) => {
      setExternalEventSheetOpen(next);
      if (!next) {
        // Defer the state clear so the closing animation can finish.
        setTimeout(() => setSelectedExternalEvent(null), 200);
      }
    },
    []
  );

  // "Create task from event" hands the user off to the AddTaskModal
  // pre-filled with the event's title and date.
  const [taskFromEventOpen, setTaskFromEventOpen] = React.useState(false);
  const [taskFromEventSeed, setTaskFromEventSeed] = React.useState<{
    title: string;
    scheduledDate: string;
  } | null>(null);

  const handleCreateTaskFromEvent = React.useCallback(
    (event: CalendarEvent) => {
      const start = new Date(event.startTime);
      setTaskFromEventSeed({
        title: event.title,
        scheduledDate: format(start, "yyyy-MM-dd"),
      });
      void prefetchAddTaskModal();
      setTaskFromEventOpen(true);
    },
    []
  );

  // When the user clicks a day cell in month view, switch to day view
  // anchored on that date — common UX pattern (Google / Outlook).
  const handleDayCellClick = React.useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setViewMode("day");
  }, [setViewMode]);

  // Drag handlers for external events — start the move/resize, then
  // useCalendarDnd's `onEventMove` / `onEventResize` callbacks fire on
  // mouseup with the new times.
  const handleExternalEventDragStart = React.useCallback(
    (event: CalendarEvent, e: React.MouseEvent) => {
      e.preventDefault();
      startEventDrag(event, e.clientY);
    },
    [startEventDrag]
  );
  const handleExternalEventResizeStart = React.useCallback(
    (event: CalendarEvent, edge: "top" | "bottom", e: React.MouseEvent) => {
      e.preventDefault();
      startEventResize(event, edge, e.clientY);
    },
    [startEventResize]
  );

  // Editability check — used to gate drag handles. Same shape as the
  // detail-sheet read-only check.
  const externalEventCanEdit = React.useCallback(
    (event: CalendarEvent) => {
      // Don't allow drag for all-day events from the timeline path —
      // they live in the banner row and have different semantics.
      if (event.isAllDay) return false;
      const isReadOnly =
        calendarReadOnlyById.get(event.calendarId) ?? true;
      return !isReadOnly;
    },
    [calendarReadOnlyById]
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header / Toolbar */}
      <CalendarViewToolbar
        selectedDate={selectedDate}
        rangeStart={range.start}
        rangeEnd={range.end}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        timeBlocks={timeBlocks}
        zoomPercent={zoomPercent}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        schedulePanelOpen={schedulePanelOpen}
        onToggleSchedulePanel={toggleSchedulePanel}
        onPreviousDay={goToPreviousDay}
        onNextDay={goToNextDay}
        onToday={goToToday}
        onAddBreak={() => {
          const dayBlocks = dayTimeBlocks.slice().sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
          let start: Date;
          if (dayBlocks.length > 0) {
            const last = dayBlocks[dayBlocks.length - 1];
            start = last ? new Date(last.endTime) : new Date();
          } else {
            const now = new Date();
            const mins = now.getMinutes();
            const roundedMins = Math.ceil(mins / 15) * 15;
            start = new Date(now.setMinutes(roundedMins, 0, 0));
          }
          const end = new Date(start.getTime() + 15 * 60 * 1000);
          createTimeBlock.mutate({
            title: "Break",
            startTime: start,
            endTime: end,
            color: "#9CA3AF",
            isBreak: true,
          });
        }}
        onPrintSchedule={() => {
          const dayBlocks = dayTimeBlocks.slice().sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
          const lines: string[] = [];
          lines.push(format(selectedDate, "EEEE, MMMM d, yyyy"));
          lines.push("");
          if (dayBlocks.length === 0) {
            lines.push("No scheduled blocks.");
          } else {
            for (const block of dayBlocks) {
              const start = format(new Date(block.startTime), "h:mm a");
              const end = format(new Date(block.endTime), "h:mm a");
              lines.push(`${start} – ${end}  ${block.title}`);
            }
          }
          const text = lines.join("\n");
          const printWindow = window.open("", "_blank");
          if (!printWindow) return;
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Daily Schedule</title>
                <style>
                  body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding: 2rem; color: #111; }
                  pre { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
                  @media print { body { padding: 0; } }
                </style>
              </head>
              <body>
                <pre>${text.replace(/</g, "&lt;")}</pre>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 100);
        }}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Single-day views (day + hours) keep the unscheduled-tasks
            side panel + DnD-aware Timeline. The "hours" view renders
            the same Timeline with fineGrained quarter/half-hour grid
            lines. Multi-day and month views drop the panel — they're
            read-mostly so the extra real estate goes to the calendar. */}
        {(viewMode === "day" || viewMode === "hours") && (
          <>
            <UnscheduledTasksPanel
              tasks={unscheduledTasks}
              isLoading={isLoading}
              scheduledDate={dateString}
              onTaskDragStart={handleTaskDragStart}
              {...(onTaskClick ? { onTaskClick } : {})}
            />
            <Timeline
              date={selectedDate}
              fineGrained={viewMode === "hours"}
              {...(viewMode === "hours" ? { hourHeight: hoursZoom } : {})}
              timeBlocks={timeBlocks}
              calendarEvents={calendarEvents}
              isLoading={isLoading}
              dragState={dragState}
              dropPreview={dropPreview}
              justEndedDrag={justEndedDrag}
              timelineRef={timelineRef}
              onBlockDragStart={handleBlockDragStart}
              onBlockResizeStart={handleBlockResizeStart}
              onTimelineMouseMove={handleTimelineMouseMove}
              onTimelineMouseUp={handleTimelineMouseUp}
              onTimelineMouseLeave={handleTimelineMouseLeave}
              onExternalEventClick={handleExternalEventClick}
              onExternalEventDragStart={handleExternalEventDragStart}
              onExternalEventResizeStart={handleExternalEventResizeStart}
              externalEventCanEdit={externalEventCanEdit}
              {...(onBlockClick ? { onBlockClick } : {})}
              {...(onEditBlock ? { onEditBlock } : {})}
              {...(onViewTask ? { onViewTask } : {})}
              {...(onTimeSlotClick
                ? {
                    onTimeSlotClick: (startTime: Date, endTime: Date) =>
                      onTimeSlotClick(selectedDate, startTime, endTime),
                  }
                : {})}
            />
            {/* Hours view: plain-text schedule panel (breaks excluded),
                toggleable from the toolbar. */}
            {viewMode === "hours" && schedulePanelOpen && (
              <ScheduleTextPanel timeBlocks={timeBlocks} date={selectedDate} />
            )}
          </>
        )}

        {(viewMode === "3-day" || viewMode === "week") && (
          <MultiDayView
            days={range.days}
            calendarEvents={calendarEvents}
            timeBlocks={timeBlocks}
            isLoading={isLoading}
            onExternalEventClick={handleExternalEventClick}
            onExternalEventReschedule={(eventId, startTime, endTime) => {
              // Same write-back path as the day-view drag — the
              // mutation hook handles optimistic update + rollback +
              // cross-range invalidation. Browser local TZ preserved
              // so the round-trip doesn't shift the displayed time.
              updateCalendarEvent.mutate({
                id: eventId,
                rangeFrom: fromDate,
                rangeTo: toDate,
                patch: {
                  startTime,
                  endTime,
                  timezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
              });
            }}
            externalEventCanEdit={externalEventCanEdit}
            {...(onBlockClick ? { onBlockClick } : {})}
          />
        )}

        {viewMode === "month" && (
          <MonthView
            month={selectedDate}
            weekStartsOn={weekStartsOn}
            calendarEvents={calendarEvents}
            timeBlocks={timeBlocks}
            isLoading={isLoading}
            onDayClick={handleDayCellClick}
            onExternalEventClick={handleExternalEventClick}
            {...(onBlockClick ? { onBlockClick } : {})}
          />
        )}
      </div>

      {/* Drag Overlay (only meaningful in single-day views) */}
      {(viewMode === "day" || viewMode === "hours") && (
        <DragOverlay dragState={dragState} dropPreview={dropPreview} />
      )}

      {/* External calendar event detail sheet (shared across views) */}
      <CalendarEventDetailSheet
        event={selectedExternalEvent}
        open={externalEventSheetOpen}
        onOpenChange={handleExternalEventSheetOpenChange}
        onCreateTask={handleCreateTaskFromEvent}
        rangeFrom={fromDate}
        rangeTo={toDate}
        calendarReadOnly={
          selectedExternalEvent
            ? (calendarReadOnlyById.get(
                selectedExternalEvent.calendarId
              ) ?? true)
            : true
        }
        calendarProvider={
          selectedExternalEvent
            ? calendarProviderById.get(selectedExternalEvent.calendarId)
            : undefined
        }
      />

      {/* Add task modal pre-filled from a calendar event */}
      <AddTaskModal
        open={taskFromEventOpen}
        onOpenChange={(next) => {
          setTaskFromEventOpen(next);
          if (!next) setTaskFromEventSeed(null);
        }}
        scheduledDate={taskFromEventSeed?.scheduledDate}
        initialTitle={taskFromEventSeed?.title}
      />
    </div>
  );
}
