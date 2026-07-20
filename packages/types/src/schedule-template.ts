export interface ScheduleTemplateItem {
  title: string;
  startTime: string;
  endTime: string;
  color: string | null;
  isBreak: boolean;
  isDurationLocked: boolean;
}

export interface ScheduleTemplate {
  id: string;
  userId: string;
  name: string;
  items: ScheduleTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleTemplateInput {
  name: string;
  items: ScheduleTemplateItem[];
}

export interface UpdateScheduleTemplateInput {
  name?: string;
  items?: ScheduleTemplateItem[];
}
