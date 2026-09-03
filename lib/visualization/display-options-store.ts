export interface DisplayOptions {
  extrudedSections: boolean;
  nodes: boolean;
  nodeNumbers: boolean;
  memberNumbers: boolean;
  supports: boolean;
  releases: boolean;
  grids: boolean;
  surfaces: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  extrudedSections: true,
  nodes: true,
  nodeNumbers: false,
  memberNumbers: false,
  supports: true,
  releases: true,
  grids: true,
  surfaces: true,
};

let state: DisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getDisplayOptions(): DisplayOptions {
  return state;
}

export function setDisplayOption<K extends keyof DisplayOptions>(
  key: K,
  value: DisplayOptions[K],
): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  emit();
}

export function resetDisplayOptions(): void {
  state = { ...DEFAULT_DISPLAY_OPTIONS };
  emit();
}

export function subscribeDisplayOptions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
