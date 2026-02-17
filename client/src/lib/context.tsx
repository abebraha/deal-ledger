import { createContext, useContext, useState, ReactNode } from "react";
import { addDays, subDays, format } from "date-fns";

// Types
export interface Deal {
  id: string;
  name: string;
  amount: number;
  stage: "Discovery" | "Demo Scheduled" | "Proposal Sent" | "Contract Sent" | "Closed Won" | "Closed Lost";
  owner: string;
  closeDate: string;
  lastActivityDate: string;
  probability: number;
  companyName: string;
}

export interface Activity {
  id: string;
  dealId: string;
  type: "Call" | "Email" | "Meeting" | "Note";
  date: string;
  content: string;
}

export interface Commitment {
  id: string;
  source: "Fireflies";
  meetingDate: string;
  meetingTitle: string;
  commitment: string;
  owner: string;
  dueDate?: string;
  status: "Pending" | "Completed" | "Overdue";
  dealId?: string;
}

export interface Settings {
  monthlyRevenueGoal: number;
  weeklyMeetingsGoal: number;
  weeklyOutboundGoal: number;
  connectedHubSpot: boolean;
  connectedFireflies: boolean;
}

// Mock Data
const MOCK_DEALS: Deal[] = [
  { id: "1", name: "Enterprise License - Acme Corp", amount: 45000, stage: "Proposal Sent", owner: "Abe", closeDate: "2024-11-15", lastActivityDate: "2024-10-25", probability: 60, companyName: "Acme Corp" },
  { id: "2", name: "Q4 Expansion - Globex", amount: 12000, stage: "Discovery", owner: "Abe", closeDate: "2024-12-01", lastActivityDate: "2024-10-27", probability: 20, companyName: "Globex" },
  { id: "3", name: "New Seat Add-ons - Initech", amount: 8500, stage: "Closed Won", owner: "Abe", closeDate: "2024-10-20", lastActivityDate: "2024-10-20", probability: 100, companyName: "Initech" },
  { id: "4", name: "Platform Migration - Umb Corp", amount: 85000, stage: "Demo Scheduled", owner: "Abe", closeDate: "2025-01-15", lastActivityDate: "2024-10-26", probability: 40, companyName: "Umbrella Corp" },
  { id: "5", name: "Consulting Retainer - Stark Ind", amount: 25000, stage: "Contract Sent", owner: "Abe", closeDate: "2024-11-05", lastActivityDate: "2024-10-28", probability: 90, companyName: "Stark Industries" },
];

const MOCK_COMMITMENTS: Commitment[] = [
  { id: "101", source: "Fireflies", meetingDate: "2024-10-24", meetingTitle: "Weekly Sync w/ Acme", commitment: "Send updated pricing proposal by Friday", owner: "Abe", dueDate: "2024-10-27", status: "Completed", dealId: "1" },
  { id: "102", source: "Fireflies", meetingDate: "2024-10-26", meetingTitle: "Intro Call - Globex", commitment: "Schedule technical deep dive with engineering team", owner: "Abe", dueDate: "2024-10-30", status: "Pending", dealId: "2" },
  { id: "103", source: "Fireflies", meetingDate: "2024-10-25", meetingTitle: "Internal Pipeline Review", commitment: "Update close dates for Q4 forecast", owner: "Abe", dueDate: "2024-10-28", status: "Pending" },
];

interface AppContextType {
  deals: Deal[];
  commitments: Commitment[];
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  isConnected: boolean;
  toggleConnection: (service: "hubspot" | "fireflies") => void;
  generateReport: (type: "weekly" | "biweekly" | "custom", prompt?: string) => any;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [commitments, setCommitments] = useState<Commitment[]>(MOCK_COMMITMENTS);
  const [settings, setSettings] = useState<Settings>({
    monthlyRevenueGoal: 100000,
    weeklyMeetingsGoal: 15,
    weeklyOutboundGoal: 50,
    connectedHubSpot: false,
    connectedFireflies: false,
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleConnection = (service: "hubspot" | "fireflies") => {
    if (service === "hubspot") {
      updateSettings({ connectedHubSpot: !settings.connectedHubSpot });
    } else {
      updateSettings({ connectedFireflies: !settings.connectedFireflies });
    }
  };

  const generateReport = (type: "weekly" | "biweekly" | "custom", prompt?: string) => {
    // Mock report generation logic
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      generatedAt: new Date().toISOString(),
      content: `Generated ${type} report based on ${prompt || "standard template"}...`,
      kpis: {
        revenue: deals.reduce((acc, d) => d.stage === "Closed Won" ? acc + d.amount : acc, 0),
        pipeline: deals.reduce((acc, d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost" ? acc + d.amount : acc, 0),
        commitmentsMet: commitments.filter(c => c.status === "Completed").length,
        commitmentsTotal: commitments.length
      }
    };
  };

  const isConnected = settings.connectedHubSpot && settings.connectedFireflies;

  return (
    <AppContext.Provider value={{ deals, commitments, settings, updateSettings, isConnected, toggleConnection, generateReport }}>
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
