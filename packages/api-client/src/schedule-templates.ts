import type {
  ScheduleTemplate,
  CreateScheduleTemplateInput,
  UpdateScheduleTemplateInput,
} from "@open-sunsama/types";
import type { OpenSunsamaClient, RequestOptions } from "./client.js";

interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
}

interface TemplateListItem {
  id: string;
  name: string;
  createdAt: string;
}

export interface ScheduleTemplatesApi {
  list(options?: RequestOptions): Promise<TemplateListItem[]>;
  get(id: string, options?: RequestOptions): Promise<ScheduleTemplate>;
  create(input: CreateScheduleTemplateInput, options?: RequestOptions): Promise<ScheduleTemplate>;
  update(id: string, input: UpdateScheduleTemplateInput, options?: RequestOptions): Promise<ScheduleTemplate>;
}

export function createScheduleTemplatesApi(client: OpenSunsamaClient): ScheduleTemplatesApi {
  return {
    async list(options?: RequestOptions): Promise<TemplateListItem[]> {
      const res = await client.get<ApiResponseWrapper<TemplateListItem[]>>("schedule-templates", options);
      return res.data;
    },

    async get(id: string, options?: RequestOptions): Promise<ScheduleTemplate> {
      const res = await client.get<ApiResponseWrapper<ScheduleTemplate>>(`schedule-templates/${id}`, options);
      return res.data;
    },

    async create(input: CreateScheduleTemplateInput, options?: RequestOptions): Promise<ScheduleTemplate> {
      const res = await client.post<ApiResponseWrapper<ScheduleTemplate>>("schedule-templates", input, options);
      return res.data;
    },

    async update(id: string, input: UpdateScheduleTemplateInput, options?: RequestOptions): Promise<ScheduleTemplate> {
      const res = await client.patch<ApiResponseWrapper<ScheduleTemplate>>(`schedule-templates/${id}`, input, options);
      return res.data;
    },
  };
}
