import { Layout } from "@/components/layout/Layout";
import { KPICard } from "@/components/dashboard/KPICard";
import { DealTable } from "@/components/dashboard/DealTable";
import { CommitmentList } from "@/components/dashboard/CommitmentList";
import { useApp } from "@/lib/context"; // Corrected import path
import { DollarSign, Phone, Users, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Dashboard() {
  const { deals, commitments, settings, isConnected } = useApp();

  const totalRevenue = deals.reduce((acc, deal) => deal.stage === "Closed Won" ? acc + deal.amount : acc, 0);
  const pipelineValue = deals.reduce((acc, deal) => deal.stage !== "Closed Won" && deal.stage !== "Closed Lost" ? acc + deal.amount : acc, 0);
  const meetingsHeld = 12; // Mock metric from HubSpot

  if (!isConnected) {
    return (
      <Layout>
        <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold">Welcome to DealFlow</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect your data sources to start generating insights and tracking commitments.
            </p>
          </div>
          <Link href="/connections">
            <Button size="lg">Connect Data Sources</Button>
          </Link>
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
            <Button variant="outline">Refresh Data</Button>
            <Button>Generate Report</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard 
            title="Total Revenue" 
            value={`$${totalRevenue.toLocaleString()}`} 
            trend="+12.5%" 
            trendUp={true} 
            icon={DollarSign} 
          />
          <KPICard 
            title="Pipeline Value" 
            value={`$${pipelineValue.toLocaleString()}`} 
            trend="+2.1%" 
            trendUp={true} 
            icon={Users} 
          />
          <KPICard 
            title="Meetings Held" 
            value={meetingsHeld} 
            trend="-4.5%" 
            trendUp={false} 
            icon={Phone} 
          />
          <KPICard 
            title="Open Commitments" 
            value={commitments.filter(c => c.status !== "Completed").length} 
            icon={CheckSquare} 
          />
        </div>

        <div className="grid gap-4 md:grid-cols-7">
          <div className="col-span-4 space-y-4">
            <h2 className="text-xl font-semibold font-display">Active Deals</h2>
            <DealTable deals={deals.filter(d => d.stage !== "Closed Lost" && d.stage !== "Closed Won")} />
          </div>
          <div className="col-span-3 space-y-4">
            <h2 className="text-xl font-semibold font-display">Commitment Ledger</h2>
            <CommitmentList commitments={commitments} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
