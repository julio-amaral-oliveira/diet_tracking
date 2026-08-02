import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readStoredUserId, useProfiles, writeStoredUserId } from "@/hooks/use-profiles";
import type { ProfileResponse } from "@/lib/types";

interface ProfileContextValue {
  profiles: ProfileResponse[] | undefined;
  isLoading: boolean;
  selectedProfile: ProfileResponse | undefined;
  selectProfile: (profile: ProfileResponse) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profiles, isLoading } = useProfiles();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => readStoredUserId());
  const selectedProfile =
    profiles?.find((p) => p.user_id === selectedUserId) ?? profiles?.[0];

  const selectProfile = useCallback((profile: ProfileResponse) => {
    setSelectedUserId(profile.user_id);
    writeStoredUserId(profile.user_id);
  }, []);

  const value = useMemo(
    () => ({ profiles, isLoading, selectedProfile, selectProfile }),
    [profiles, isLoading, selectedProfile, selectProfile]
  );

  if (isLoading || profiles === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando perfis...</p>
      </div>
    );
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useSelectedProfile(): ProfileResponse | undefined {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useSelectedProfile must be used within a ProfileProvider");
  }
  return ctx.selectedProfile;
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }
  return ctx;
}
