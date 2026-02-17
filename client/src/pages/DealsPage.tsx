import { Layout } from "@/components/layout/Layout";
import { DealTable } from "@/components/dashboard/DealTable";
import { useApp } from "@/lib/context"; // Corrected import path

export function DealsPage() {
  const { deals } = useApp();
  
  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Deal Pipeline</h1>
          <p className="text-muted-foreground mt-2">Full view of all active and closed deals.</p>
        </div>
        <DealTable deals={deals} />
      </div>
    </Layout>
  );
}
