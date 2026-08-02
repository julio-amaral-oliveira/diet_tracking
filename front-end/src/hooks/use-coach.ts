import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useSelectedProfile } from "@/contexts/ProfileContext";
import type {
  StagnationResult,
  DietPlanResponse,
  MessageResponse,
} from "@/lib/types";

export function useCheckStagnation() {
  const profile = useSelectedProfile();

  return useMutation<StagnationResult, Error, void>({
    mutationFn: async () => {
      const { data } = await api.post("/coach/check-stagnation", {
        user_id: profile?.user_id ?? "default_user",
      });
      return data;
    },
  });
}

export function useApplySuggestion() {
  const queryClient = useQueryClient();
  const profile = useSelectedProfile();

  return useMutation<
    DietPlanResponse,
    Error,
    { calorie_adjustment: number; carb_adjustment_g: number; w_curr: number; w_prev: number }
  >({
    mutationFn: async ({ calorie_adjustment, carb_adjustment_g, w_curr, w_prev }) => {
      const { data } = await api.post("/coach/apply-suggestion", {
        user_id: profile?.user_id ?? "default_user",
        calorie_adjustment,
        carb_adjustment_g,
        w_curr,
        w_prev,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["diet-current"] });
    },
  });
}

export function useDismissSuggestion() {
  const profile = useSelectedProfile();

  return useMutation<MessageResponse, Error, { w_curr: number; w_prev: number }>({
    mutationFn: async ({ w_curr, w_prev }) => {
      const { data } = await api.post("/coach/dismiss-suggestion", {
        user_id: profile?.user_id ?? "default_user",
        w_curr,
        w_prev,
      });
      return data;
    },
  });
}
