import { Layout } from "@/components/layout/Layout";
import { KPICard } from "@/components/dashboard/KPICard";
import { DealTable } from "@/components/dashboard/DealTable";
import { useApp } from "@/lib/context";
import { DollarSign, Phone, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

export function Dashboard() {
  const { deals, activities, kpis, isConnected, syncHubspot, syncFireflies, isSyncing } = useApp();
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
            subtitle="Closed won deals"
            icon={DollarSign} 
          />
          <KPICard 
            title="Pipeline Value" 
            value={`$${(kpis?.pipeline?.total ?? 0).toLocaleString()}`} 
            subtitle={kpis?.pipeline?.dealCount != null ? `${kpis.pipeline.dealCount} open deals` : undefined}
            icon={Users} 
          />
          <KPICard 
            title="Meetings This Week" 
            value={kpis?.activity?.meetingsHeld ?? 0} 
            trend={kpis?.activity?.meetingsGoal ? `Goal: ${kpis.activity.meetingsGoal}` : undefined}
            trendUp={kpis?.activity ? kpis.activity.meetingsHeld >= kpis.activity.meetingsGoal : undefined} 
            icon={Phone} 
          />
          <KPICard 
            title="Outbound This Week" 
            value={kpis?.activity?.totalOutbound ?? 0} 
            trend={kpis?.activity?.outboundGoal ? `Goal: ${kpis.activity.outboundGoal}` : undefined}
            trendUp={kpis?.activity ? kpis.activity.totalOutbound >= kpis.activity.outboundGoal : undefined}
            subtitle={`${kpis?.activity?.calls ?? 0} calls · ${kpis?.activity?.emails ?? 0} emails`}
            icon={BarChart3} 
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold font-display">Active Deals</h2>
          <DealTable deals={deals.filter(d => d.stage !== "Closed Lost" && d.stage !== "Closed Won" && d.stage !== "closedlost" && d.stage !== "closedwon")} />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold font-display">Recent Activity</h2>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.slice(0, 25).map((activity) => (
                  <TableRow key={activity.id} data-testid={`row-activity-${activity.id}`}>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-activity-type-${activity.id}`}>{activity.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-activity-subject-${activity.id}`}>
                      {activity.hubspotUrl ? (
                        <a href={activity.hubspotUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {activity.subject}
                        </a>
                      ) : activity.subject}
                    </TableCell>
                    <TableCell data-testid={`text-activity-owner-${activity.id}`}>{activity.owner ?? "—"}</TableCell>
                    <TableCell className="text-right" data-testid={`text-activity-date-${activity.id}`}>
                      {activity.activityDate ? format(new Date(activity.activityDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {activities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No activities synced yet. Sync HubSpot to pull in activity data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
