/**
 * Hook for the "where do new tasks land" preference.
 *
 * The choice (top vs. bottom of the day's to-do list) is persisted to the
 * database via the user's preferences, so it is remembered globally across
 * accounts, devices, and logins. Defaults to "top".
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_PREFERENCES } from "@/lib/themes";
import type { User, UserPreferences } from "@open-sunsama/types";

export type AddTaskPosition = "top" | "bottom";

const AUTH_USER_KEY = "open_sunsama_user";

interface UseAddTaskPositionResult {
  /** Current preferred insert position (defaults to "top"). */
  addPosition: AddTaskPosition;
  /** Persist a new preferred insert position to the database. */
  setAddPosition: (position: AddTaskPosition) => void;
}

export function useAddTaskPosition(): UseAddTaskPositionResult {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const addPosition: AddTaskPosition =
    user?.preferences?.addTaskPosition ?? "top";

  const setAddPosition = React.useCallback(
    (position: AddTaskPosition) => {
      if (!user) return;

      const merged: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        ...(user.preferences ?? {}),
        addTaskPosition: position,
      };

      // Optimistically update the cached user so the toggle flips instantly,
      // then persist to the database in the background.
      const optimisticUser: User = { ...user, preferences: merged };
      queryClient.setQueryData(["auth", "me"], optimisticUser);
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(optimisticUser));
      } catch {
        // ignore quota errors
      }

      void updateUser({ preferences: merged });
    },
    [user, updateUser, queryClient]
  );

  return { addPosition, setAddPosition };
}
