import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useSelectedProfile } from "@/contexts/ProfileContext";
import type { DashboardStats } from "@/lib/types";

export function useDashboardStats(days = 30) {
  const profile = useSelectedProfile();
  const userId = profile?.user_id ?? "default_user";

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", userId, days],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/stats", {
        params: { days, user_id: userId },
      });
      return data;
    },
    enabled: profile !== undefined,
  });
}
