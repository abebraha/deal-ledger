import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/context";

import { Dashboard } from "@/pages/Dashboard";
import { Connections } from "@/pages/Connections";
import { Settings } from "@/pages/Settings";
import { Reports } from "@/pages/Reports";
import { ChatPage } from "@/pages/ChatPage";
import { DealsPage } from "@/pages/DealsPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/connections" component={Connections} />
      <Route path="/settings" component={Settings} />
      <Route path="/reports" component={Reports} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/deals" component={DealsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Router />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
