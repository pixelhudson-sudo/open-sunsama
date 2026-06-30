/**
 * Ideas API methods (boards / columns / idea cards)
 * @module @open-sunsama/api-client/ideas
 */

import type {
  Idea,
  IdeaBoard,
  IdeaColumn,
  Task,
  CreateIdeaBoardInput,
  UpdateIdeaBoardInput,
  CreateIdeaColumnInput,
  UpdateIdeaColumnInput,
  CreateIdeaInput,
  UpdateIdeaInput,
  ReorderIdeasInput,
  ReorderIdeaColumnsInput,
  ReorderIdeaBoardsInput,
  PromoteIdeaInput,
  IdeaFilterInput,
} from "@open-sunsama/types";
import type { OpenSunsamaClient, RequestOptions } from "./client.js";

interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
}

/** A board returned from create, with its seeded default column. */
export type IdeaBoardWithColumns = IdeaBoard & { columns: IdeaColumn[] };

/** Boards sub-API */
export interface IdeaBoardsApi {
  list(options?: RequestOptions): Promise<IdeaBoard[]>;
  create(
    input: CreateIdeaBoardInput,
    options?: RequestOptions
  ): Promise<IdeaBoardWithColumns>;
  update(
    id: string,
    input: UpdateIdeaBoardInput,
    options?: RequestOptions
  ): Promise<IdeaBoard>;
  delete(id: string, options?: RequestOptions): Promise<void>;
  reorder(
    input: ReorderIdeaBoardsInput,
    options?: RequestOptions
  ): Promise<IdeaBoard[]>;
}

/** Columns sub-API */
export interface IdeaColumnsApi {
  list(boardId: string, options?: RequestOptions): Promise<IdeaColumn[]>;
  create(
    input: CreateIdeaColumnInput,
    options?: RequestOptions
  ): Promise<IdeaColumn>;
  update(
    id: string,
    input: UpdateIdeaColumnInput,
    options?: RequestOptions
  ): Promise<IdeaColumn>;
  delete(id: string, options?: RequestOptions): Promise<void>;
  reorder(
    input: ReorderIdeaColumnsInput,
    options?: RequestOptions
  ): Promise<IdeaColumn[]>;
}

/** Full Ideas API */
export interface IdeasApi {
  boards: IdeaBoardsApi;
  columns: IdeaColumnsApi;
  list(filters?: IdeaFilterInput, options?: RequestOptions): Promise<Idea[]>;
  create(input: CreateIdeaInput, options?: RequestOptions): Promise<Idea>;
  update(
    id: string,
    input: UpdateIdeaInput,
    options?: RequestOptions
  ): Promise<Idea>;
  delete(id: string, options?: RequestOptions): Promise<void>;
  reorder(input: ReorderIdeasInput, options?: RequestOptions): Promise<Idea[]>;
  promote(
    id: string,
    input?: PromoteIdeaInput,
    options?: RequestOptions
  ): Promise<{ idea: Idea; task: Task }>;
}

/**
 * Create ideas API methods bound to a client.
 */
export function createIdeasApi(client: OpenSunsamaClient): IdeasApi {
  return {
    boards: {
      async list(options?: RequestOptions): Promise<IdeaBoard[]> {
        const res = await client.get<ApiResponseWrapper<IdeaBoard[]>>(
          "ideas/boards",
          options
        );
        return res.data ?? [];
      },
      async create(
        input: CreateIdeaBoardInput,
        options?: RequestOptions
      ): Promise<IdeaBoardWithColumns> {
        const res = await client.post<ApiResponseWrapper<IdeaBoardWithColumns>>(
          "ideas/boards",
          input,
          options
        );
        return res.data;
      },
      async update(
        id: string,
        input: UpdateIdeaBoardInput,
        options?: RequestOptions
      ): Promise<IdeaBoard> {
        const res = await client.patch<ApiResponseWrapper<IdeaBoard>>(
          `ideas/boards/${id}`,
          input,
          options
        );
        return res.data;
      },
      async delete(id: string, options?: RequestOptions): Promise<void> {
        await client.delete<ApiResponseWrapper<void>>(
          `ideas/boards/${id}`,
          options
        );
      },
      async reorder(
        input: ReorderIdeaBoardsInput,
        options?: RequestOptions
      ): Promise<IdeaBoard[]> {
        const res = await client.post<ApiResponseWrapper<IdeaBoard[]>>(
          "ideas/boards/reorder",
          input,
          options
        );
        return res.data ?? [];
      },
    },

    columns: {
      async list(
        boardId: string,
        options?: RequestOptions
      ): Promise<IdeaColumn[]> {
        const res = await client.get<ApiResponseWrapper<IdeaColumn[]>>(
          "ideas/columns",
          {
            ...options,
            searchParams: { ...options?.searchParams, boardId },
          }
        );
        return res.data ?? [];
      },
      async create(
        input: CreateIdeaColumnInput,
        options?: RequestOptions
      ): Promise<IdeaColumn> {
        const res = await client.post<ApiResponseWrapper<IdeaColumn>>(
          "ideas/columns",
          input,
          options
        );
        return res.data;
      },
      async update(
        id: string,
        input: UpdateIdeaColumnInput,
        options?: RequestOptions
      ): Promise<IdeaColumn> {
        const res = await client.patch<ApiResponseWrapper<IdeaColumn>>(
          `ideas/columns/${id}`,
          input,
          options
        );
        return res.data;
      },
      async delete(id: string, options?: RequestOptions): Promise<void> {
        await client.delete<ApiResponseWrapper<void>>(
          `ideas/columns/${id}`,
          options
        );
      },
      async reorder(
        input: ReorderIdeaColumnsInput,
        options?: RequestOptions
      ): Promise<IdeaColumn[]> {
        const res = await client.post<ApiResponseWrapper<IdeaColumn[]>>(
          "ideas/columns/reorder",
          input,
          options
        );
        return res.data ?? [];
      },
    },

    async list(
      filters?: IdeaFilterInput,
      options?: RequestOptions
    ): Promise<Idea[]> {
      const searchParams: Record<string, string | undefined> = {
        boardId: filters?.boardId,
        columnId: filters?.columnId,
        completed:
          filters?.completed !== undefined
            ? String(filters.completed)
            : undefined,
      };
      const res = await client.get<ApiResponseWrapper<Idea[]>>("ideas", {
        ...options,
        searchParams: { ...options?.searchParams, ...searchParams },
      });
      return res.data ?? [];
    },

    async create(
      input: CreateIdeaInput,
      options?: RequestOptions
    ): Promise<Idea> {
      const res = await client.post<ApiResponseWrapper<Idea>>(
        "ideas",
        input,
        options
      );
      return res.data;
    },

    async update(
      id: string,
      input: UpdateIdeaInput,
      options?: RequestOptions
    ): Promise<Idea> {
      const res = await client.patch<ApiResponseWrapper<Idea>>(
        `ideas/${id}`,
        input,
        options
      );
      return res.data;
    },

    async delete(id: string, options?: RequestOptions): Promise<void> {
      await client.delete<ApiResponseWrapper<void>>(`ideas/${id}`, options);
    },

    async reorder(
      input: ReorderIdeasInput,
      options?: RequestOptions
    ): Promise<Idea[]> {
      const res = await client.post<ApiResponseWrapper<Idea[]>>(
        "ideas/reorder",
        input,
        options
      );
      return res.data ?? [];
    },

    async promote(
      id: string,
      input?: PromoteIdeaInput,
      options?: RequestOptions
    ): Promise<{ idea: Idea; task: Task }> {
      const res = await client.post<
        ApiResponseWrapper<{ idea: Idea; task: Task }>
      >(`ideas/${id}/promote`, input ?? {}, options);
      return res.data;
    },
  };
}
