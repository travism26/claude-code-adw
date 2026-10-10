// Journal API queries and mutations using TanStack Query
import { ApiClient } from "../utils/api";
import type {
  JournalEntry,
  CreateJournalEntryRequest,
  UpdateJournalEntryRequest,
} from "../types";

const apiClient = ApiClient.getInstance();

export const fetchEntriesForPlant = async (
  plantId: string
): Promise<JournalEntry[]> => {
  const response = await apiClient.request<{ entries: JournalEntry[] }>(
    `/journal/plant/${plantId}`
  );
  return response.entries;
};

export const getEntry = async (id: string): Promise<JournalEntry> => {
  const response = await apiClient.request<{ entry: JournalEntry }>(
    `/journal/${id}`
  );
  return response.entry;
};

export const createEntry = async (
  entryData: CreateJournalEntryRequest
): Promise<JournalEntry> => {
  const response = await apiClient.request<{ entry: JournalEntry }>(
    "/journal",
    {
      method: "POST",
      body: JSON.stringify(entryData),
    }
  );
  return response.entry;
};

export const updateEntry = async (
  id: string,
  entryData: UpdateJournalEntryRequest
): Promise<JournalEntry> => {
  const response = await apiClient.request<{ entry: JournalEntry }>(
    `/journal/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(entryData),
    }
  );
  return response.entry;
};

export const deleteEntry = async (id: string): Promise<void> => {
  await apiClient.request(`/journal/${id}`, { method: "DELETE" });
};
