import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useSelectedProfile } from "@/contexts/ProfileContext";
import type { BodyLogCreate, BodyLogResponse, MessageResponse } from "@/lib/types";

export function useBodyLogs(
  startDate?: string,
  endDate?: string,
  skip = 0,
  limit = 50
) {
  const profile = useSelectedProfile();
  const userId = profile?.user_id ?? "default_user";

  return useQuery<BodyLogResponse[]>({
    queryKey: ["body-logs", userId, startDate, endDate, skip, limit],
    queryFn: async () => {
      const { data } = await api.get("/body-logs/", {
        params: {
          user_id: userId,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          skip,
          limit,
        },
      });
      return data;
    },
    enabled: profile !== undefined,
  });
}

export function useCreateBodyLog() {
  const queryClient = useQueryClient();
  const profile = useSelectedProfile();

  return useMutation<BodyLogResponse, Error, Omit<BodyLogCreate, "user_id">>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/body-logs/", {
        ...payload,
        user_id: profile?.user_id ?? "default_user",
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateBodyLog() {
  const queryClient = useQueryClient();
  const profile = useSelectedProfile();

  return useMutation<BodyLogResponse, Error, { id: number; data: Omit<BodyLogCreate, "user_id"> }>({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.put(`/body-logs/${id}`, {
        ...payload,
        user_id: profile?.user_id ?? "default_user",
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteBodyLog() {
  const queryClient = useQueryClient();

  return useMutation<MessageResponse, Error, number>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/body-logs/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
