import { createStorageStore } from "@/lib/client/storage";

export interface SavedEventsState {
  version: 1;
  ids: number[];
}

export const savedEventsStore = createStorageStore<SavedEventsState>("scene044:savedEvents", 1, {
  version: 1,
  ids: [],
});
