import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export interface Deal {
  id: number;
  hubspotId: string | null;
  name: string;
  amount: number | null;
  stage: string;
  owner: string | null;
  closeDate: string | null;
  lastActivityDate: string | null;
  probability: number | null;
  companyName: string | null;
  hubspotUrl: string | null;
  pipeline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KPIs {
  revenue: { total: number; goal: number; attainment: number };
  pipeline: { total: number; weighted: number; dealCount: number };
  activity: { calls: number; emails: number; meetingsHeld: number; meetingsGoal: number; outboundGoal: number; totalOutbound: number };
  deals: { total: number; closedWon: number; open: number };
}

export interface Activity {
  id: number;
  hubspotId: string | null;
  dealId: number | null;
  type: string;
  subject: string;
  body: string | null;
  owner: string | null;
  activityDate: string | null;
  hubspotUrl: string | null;
  createdAt: string;
}

export interface ConnectionInfo {
  service: string;
  connected: boolean;
  lastSyncAt: string | null;
  config: any;
}

export interface ConnectionsData {
  hubspot: ConnectionInfo | null;
  fireflies: ConnectionInfo | null;
}

interface AppContextType {
  deals: Deal[];
  activities: Activity[];
  settings: Record<string, string>;
  kpis: KPIs | null;
  connections: ConnectionsData | null;
  isConnected: boolean;
  isLoading: boolean;
  saveSettings: (data: Record<string, string>) => void;
  isSavingSettings: boolean;
  connectService: (service: "hubspot" | "fireflies", apiKey: string) => Promise<any>;
  disconnectService: (service: "hubspot" | "fireflies") => void;
  isConnecting: boolean;
  syncHubspot: () => void;
  syncFireflies: () => void;
  isSyncing: boolean;
  refetchAll: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: kpis = null, isLoading: kpisLoading } = useQuery<KPIs>({
    queryKey: ["/api/kpis"],
  });

  const { data: settings = {}, isLoading: settingsLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const { data: connections = null, isLoading: connectionsLoading } = useQuery<ConnectionsData>({
    queryKey: ["/api/connections"],
  });

  const isConnected = !!(connections?.hubspot?.connected && connections?.fireflies?.connected);
  const isLoading = dealsLoading || activitiesLoading || kpisLoading || settingsLoading || connectionsLoading;

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
    },
  });

  const connectServiceMutation = useMutation({
    mutationFn: async ({ service, apiKey }: { service: "hubspot" | "fireflies"; apiKey: string }) => {
      const res = await fetch(`/api/connections/${service}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection failed");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/connections"] });
      qc.invalidateQueries({ queryKey: ["/api/deals"] });
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
    },
  });

  const disconnectServiceMutation = useMutation({
    mutationFn: async (service: "hubspot" | "fireflies") => {
      await apiRequest("POST", `/api/connections/${service}/disconnect`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/connections"] });
    },
  });

  const syncHubspotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/sync/hubspot");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/deals"] });
      qc.invalidateQueries({ queryKey: ["/api/activities"] });
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
      qc.invalidateQueries({ queryKey: ["/api/connections"] });
    },
  });

  const syncFirefliesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/sync/fireflies");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
      qc.invalidateQueries({ queryKey: ["/api/connections"] });
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/deals"] });
    qc.invalidateQueries({ queryKey: ["/api/activities"] });
    qc.invalidateQueries({ queryKey: ["/api/kpis"] });
    qc.invalidateQueries({ queryKey: ["/api/settings"] });
    qc.invalidateQueries({ queryKey: ["/api/connections"] });
  };

  const isSyncing = syncHubspotMutation.isPending || syncFirefliesMutation.isPending;

  return (
    <AppContext.Provider value={{
      deals,
      activities,
      settings,
      kpis,
      connections,
      isConnected,
      isLoading,
      saveSettings: (data) => saveSettingsMutation.mutate(data),
      isSavingSettings: saveSettingsMutation.isPending,
      connectService: (service, apiKey) => connectServiceMutation.mutateAsync({ service, apiKey }),
      disconnectService: (service) => disconnectServiceMutation.mutate(service),
      isConnecting: connectServiceMutation.isPending,
      syncHubspot: () => syncHubspotMutation.mutate(),
      syncFireflies: () => syncFirefliesMutation.mutate(),
      isSyncing,
      refetchAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
