import { Switch, Route } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppProvider } from "@/lib/context";

import { Dashboard } from "@/pages/Dashboard";
import { Connections } from "@/pages/Connections";
import { Settings } from "@/pages/Settings";
import { Reports } from "@/pages/Reports";
import { ChatPage } from "@/pages/ChatPage";
import { DealsPage } from "@/pages/DealsPage";
import NotFound from "@/pages/not-found";

interface Account {
  id: number;
  name: string;
  createdAt: string;
}

export function AccountApp({ accountId }: { accountId: number }) {
  const { data: account, isLoading, isError } = useQuery<Account>({
    queryKey: ["/api/accounts", accountId],
    queryFn: async () => {
      const r = await fetch(`/api/accounts/${accountId}`);
      if (!r.ok) throw new Error("Account not found");
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-destructive">Account not found</div>
      </div>
    );
  }

  return (
    <AppProvider accountId={accountId} accountName={account.name}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/connections" component={Connections} />
        <Route path="/settings" component={Settings} />
        <Route path="/reports" component={Reports} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/deals" component={DealsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppProvider>
  );
}
