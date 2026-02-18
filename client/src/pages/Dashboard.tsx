import { Layout } from "@/components/layout/Layout";
import { KPICard } from "@/components/dashboard/KPICard";
import { DealTable } from "@/components/dashboard/DealTable";
import { useApp } from "@/lib/context";
import { DollarSign, Phone, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export function Dashboard() {
  const { deals, kpis, isConnected, syncHubspot, syncFireflies, isSyncing } = useApp();
  const [, navigate] = useLocation();

  const handleRefresh = () => {
    syncHubspot();
    syncFireflies();
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold">Welcome to DealFlow</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect your data sources to start generating insights and tracking performance.
            </p>
          </div>
          <Button size="lg" data-testid="button-connect-sources" onClick={() => navigate("/connections")}>Connect Data Sources</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight font-display">Executive Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isSyncing} data-testid="button-refresh-data">
              {isSyncing ? "Syncing..." : "Refresh Data"}
            </Button>
            <Button onClick={() => navigate("/reports")} data-testid="button-generate-report">Generate Report</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard 
            title="Total Revenue" 
            value={`$${(kpis?.revenue?.total ?? 0).toLocaleString()}`} 
            trend={kpis?.revenue?.attainment != null ? `${kpis.revenue.attainment.toFixed(1)}% of goal` : undefined}
            trendUp={kpis?.revenue?.attainment != null ? kpis.revenue.attainment >= 100 : undefined} 
            icon={DollarSign} 
          />
          <KPICard 
            title="Pipeline Value" 
            value={`$${(kpis?.pipeline?.total ?? 0).toLocaleString()}`} 
            trend={kpis?.pipeline?.dealCount != null ? `${kpis.pipeline.dealCount} deals` : undefined}
            trendUp={true} 
            icon={Users} 
          />
          <KPICard 
            title="Meetings Held" 
            value={kpis?.activity?.meetingsHeld ?? 0} 
            trend={kpis?.activity?.meetingsGoal ? `Goal: ${kpis.activity.meetingsGoal}` : undefined}
            trendUp={kpis?.activity ? kpis.activity.meetingsHeld >= kpis.activity.meetingsGoal : undefined} 
            icon={Phone} 
          />
          <KPICard 
            title="Outbound Activity" 
            value={kpis?.activity?.totalOutbound ?? 0} 
            trend={kpis?.activity?.outboundGoal ? `Goal: ${kpis.activity.outboundGoal}` : undefined}
            trendUp={kpis?.activity ? kpis.activity.totalOutbound >= kpis.activity.outboundGoal : undefined}
            icon={BarChart3} 
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold font-display">Active Deals</h2>
          <DealTable deals={deals.filter(d => d.stage !== "Closed Lost" && d.stage !== "Closed Won" && d.stage !== "closedlost" && d.stage !== "closedwon")} />
        </div>
      </div>
    </Layout>
  );
}
