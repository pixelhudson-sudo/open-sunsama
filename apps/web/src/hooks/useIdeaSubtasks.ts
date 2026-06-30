/**
 * React Query hooks for idea subtasks (checklist items under an idea card).
 * Mirrors useSubtasks/useSubtaskMutations with optimistic updates.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  IdeaSubtask,
  CreateIdeaSubtaskInput,
  UpdateIdeaSubtaskInput,
} from "@open-sunsama/types";
import { getApi } from "@/lib/api";
import { ideaSubtaskKeys } from "@/lib/query-keys";

export { ideaSubtaskKeys };

export function useIdeaSubtasks(
  ideaId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ideaSubtaskKeys.list(ideaId),
    queryFn: async () => {
      const api = getApi();
      return await api.ideas.subtasks.list(ideaId);
    },
    enabled: !!ideaId && options?.enabled !== false,
  });
}

export function useCreateIdeaSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ideaId,
      input,
    }: {
      ideaId: string;
      input: CreateIdeaSubtaskInput;
    }) => {
      const api = getApi();
      return await api.ideas.subtasks.create(ideaId, input);
    },
    onMutate: async ({ ideaId, input }) => {
      const key = ideaSubtaskKeys.list(ideaId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<IdeaSubtask[]>(key);
      const now = new Date();
      const optimistic: IdeaSubtask = {
        id: `temp-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
        ideaId,
        title: input.title,
        completed: false,
        position: previous?.length ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData<IdeaSubtask[]>(key, (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous, tempId: optimistic.id };
    },
    onSuccess: (created, { ideaId }, context) => {
      queryClient.setQueryData<IdeaSubtask[]>(
        ideaSubtaskKeys.list(ideaId),
        (old) =>
          (old ?? []).map((s) => (s.id === context?.tempId ? created : s))
      );
    },
    onError: (_e, { ideaId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ideaSubtaskKeys.list(ideaId),
          context.previous
        );
      }
    },
  });
}

export function useUpdateIdeaSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ideaId,
      subtaskId,
      input,
    }: {
      ideaId: string;
      subtaskId: string;
      input: UpdateIdeaSubtaskInput;
    }) => {
      const api = getApi();
      return await api.ideas.subtasks.update(ideaId, subtaskId, input);
    },
    onMutate: async ({ ideaId, subtaskId, input }) => {
      const key = ideaSubtaskKeys.list(ideaId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<IdeaSubtask[]>(key);
      queryClient.setQueryData<IdeaSubtask[]>(key, (old) =>
        (old ?? []).map((s) =>
          s.id === subtaskId ? { ...s, ...input } : s
        )
      );
      return { previous };
    },
    onError: (_e, { ideaId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ideaSubtaskKeys.list(ideaId),
          context.previous
        );
      }
    },
  });
}

export function useDeleteIdeaSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ideaId,
      subtaskId,
    }: {
      ideaId: string;
      subtaskId: string;
    }) => {
      const api = getApi();
      await api.ideas.subtasks.delete(ideaId, subtaskId);
      return subtaskId;
    },
    onMutate: async ({ ideaId, subtaskId }) => {
      const key = ideaSubtaskKeys.list(ideaId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<IdeaSubtask[]>(key);
      queryClient.setQueryData<IdeaSubtask[]>(key, (old) =>
        (old ?? []).filter((s) => s.id !== subtaskId)
      );
      return { previous };
    },
    onError: (_e, { ideaId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ideaSubtaskKeys.list(ideaId),
          context.previous
        );
      }
    },
  });
}

export function useReorderIdeaSubtasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ideaId,
      subtaskIds,
    }: {
      ideaId: string;
      subtaskIds: string[];
    }) => {
      const api = getApi();
      return await api.ideas.subtasks.reorder(ideaId, subtaskIds);
    },
    onMutate: async ({ ideaId, subtaskIds }) => {
      const key = ideaSubtaskKeys.list(ideaId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<IdeaSubtask[]>(key);
      if (previous) {
        const byId = new Map(previous.map((s) => [s.id, s]));
        const reordered = subtaskIds
          .map((id, index) => {
            const s = byId.get(id);
            return s ? { ...s, position: index } : undefined;
          })
          .filter((s): s is IdeaSubtask => !!s);
        queryClient.setQueryData<IdeaSubtask[]>(key, reordered);
      }
      return { previous };
    },
    onError: (_e, { ideaId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ideaSubtaskKeys.list(ideaId),
          context.previous
        );
      }
    },
  });
}
