import * as React from "react";

interface UndoEntry {
  label: string;
  restore: () => Promise<void>;
}

const MAX_UNDOS = 10;

// Module-level stack — shared across all components
let undoStack: UndoEntry[] = [];
let listeners: Array<() => void> = [];

function notify() {
  for (const fn of listeners) fn();
}

export function pushUndo(label: string, restore: () => Promise<void>) {
  undoStack.push({ label, restore });
  if (undoStack.length > MAX_UNDOS) {
    undoStack.shift();
  }
  notify();
}

export async function popUndo(): Promise<boolean> {
  const entry = undoStack.pop();
  if (!entry) return false;
  notify();
  try {
    await entry.restore();
    return true;
  } catch {
    return false;
  }
}

export function peekUndo(): UndoEntry | undefined {
  return undoStack[undoStack.length - 1];
}

export function undoCount(): number {
  return undoStack.length;
}

export function useUndoStack() {
  const [, forceUpdate] = React.useState(0);

  React.useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((fn) => fn !== handler);
    };
  }, []);

  return {
    count: undoStack.length,
    latest: peekUndo(),
    undo: popUndo,
    push: pushUndo,
  };
}
