import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { MessageResponse, ProfileCreate, ProfileResponse, ProfileUpdate } from "@/lib/types";

export function useProfiles() {
  return useQuery<ProfileResponse[]>({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await api.get("/profiles/");
      return data;
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation<ProfileResponse, Error, ProfileCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/profiles/", payload);
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData<ProfileResponse[]>(["profiles"], (old) =>
        old ? [...old, profile] : [profile]
      );
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useRenameProfile() {
  const queryClient = useQueryClient();

  return useMutation<ProfileResponse, Error, { id: number; name: string }>({
    mutationFn: async ({ id, name }) => {
      const { data } = await api.patch(`/profiles/${id}`, { name } satisfies ProfileUpdate);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation<MessageResponse, Error, number>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/profiles/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

const STORAGE_KEY = "selected_profile_user_id";

export function readStoredUserId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredUserId(userId: string | null): void {
  try {
    if (userId === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, userId);
    }
  } catch {
    // localStorage unavailable — profile selection stays in memory only
  }
}
