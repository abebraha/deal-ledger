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

export interface Commitment {
  id: number;
  firefliesMeetingId: string | null;
  meetingDate: string | null;
  meetingTitle: string | null;
  type: string;
  content: string;
  owner: string | null;
  dueDate: string | null;
  status: string;
  dealId: number | null;
  firefliesUrl: string | null;
  snippet: string | null;
  createdAt: string;
}

export interface KPIs {
  revenue: { total: number; goal: number; attainment: number };
  pipeline: { total: number; weighted: number; dealCount: number };
  activity: { calls: number; emails: number; meetingsHeld: number; meetingsGoal: number; outboundGoal: number; totalOutbound: number };
  commitments: { total: number; pending: number; completed: number; overdue: number };
  deals: { total: number; closedWon: number; open: number };
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
  commitments: Commitment[];
  settings: Record<string, string>;
  kpis: KPIs | null;
  connections: ConnectionsData | null;
  isConnected: boolean;
  isLoading: boolean;
  saveSettings: (data: Record<string, string>) => void;
  isSavingSettings: boolean;
  toggleConnection: (service: "hubspot" | "fireflies") => void;
  isTogglingConnection: boolean;
  syncHubspot: () => void;
  syncFireflies: () => void;
  isSyncing: boolean;
  updateCommitmentStatus: (id: number, status: string) => void;
  refetchAll: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: commitments = [], isLoading: commitmentsLoading } = useQuery<Commitment[]>({
    queryKey: ["/api/commitments"],
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
  const isLoading = dealsLoading || commitmentsLoading || kpisLoading || settingsLoading || connectionsLoading;

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
    },
  });

  const toggleConnectionMutation = useMutation({
    mutationFn: async (service: "hubspot" | "fireflies") => {
      const conn = service === "hubspot" ? connections?.hubspot : connections?.fireflies;
      const action = conn?.connected ? "disconnect" : "connect";
      await apiRequest("POST", `/api/connections/${service}/${action}`);
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
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
      qc.invalidateQueries({ queryKey: ["/api/connections"] });
    },
  });

  const syncFirefliesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/sync/fireflies");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/commitments"] });
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
      qc.invalidateQueries({ queryKey: ["/api/connections"] });
    },
  });

  const updateCommitmentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/commitments/${id}/status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/commitments"] });
      qc.invalidateQueries({ queryKey: ["/api/kpis"] });
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/deals"] });
    qc.invalidateQueries({ queryKey: ["/api/commitments"] });
    qc.invalidateQueries({ queryKey: ["/api/kpis"] });
    qc.invalidateQueries({ queryKey: ["/api/settings"] });
    qc.invalidateQueries({ queryKey: ["/api/connections"] });
  };

  const isSyncing = syncHubspotMutation.isPending || syncFirefliesMutation.isPending;

  return (
    <AppContext.Provider value={{
      deals,
      commitments,
      settings,
      kpis,
      connections,
      isConnected,
      isLoading,
      saveSettings: (data) => saveSettingsMutation.mutate(data),
      isSavingSettings: saveSettingsMutation.isPending,
      toggleConnection: (service) => toggleConnectionMutation.mutate(service),
      isTogglingConnection: toggleConnectionMutation.isPending,
      syncHubspot: () => syncHubspotMutation.mutate(),
      syncFireflies: () => syncFirefliesMutation.mutate(),
      isSyncing,
      updateCommitmentStatus: (id, status) => updateCommitmentStatusMutation.mutate({ id, status }),
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
