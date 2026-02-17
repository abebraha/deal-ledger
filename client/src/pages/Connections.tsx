import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/lib/context";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export function Connections() {
  const { connections, isConnected, toggleConnection, isTogglingConnection, syncHubspot, syncFireflies, isSyncing } = useApp();

  const hubspotConnected = connections?.hubspot?.connected ?? false;
  const firefliesConnected = connections?.fireflies?.connected ?? false;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Data Connections</h1>
          <p className="text-muted-foreground mt-2">Manage your integrations with HubSpot and Fireflies.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className={`border-2 transition-all ${hubspotConnected ? "border-primary/20 bg-primary/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>HubSpot CRM</span>
                {hubspotConnected ? (
                  <CheckCircle2 className="text-green-500 h-6 w-6" />
                ) : (
                  <XCircle className="text-muted-foreground h-6 w-6" />
                )}
              </CardTitle>
              <CardDescription>Source of truth for deals, activities, and revenue.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Includes: Deals, Companies, Contacts, Emails, Calls, Meetings.
                </div>
                {hubspotConnected && connections?.hubspot?.lastSyncAt && (
                  <div className="text-xs text-muted-foreground" data-testid="text-hubspot-last-sync">
                    Last synced: {format(new Date(connections.hubspot.lastSyncAt), "MMM d, yyyy h:mm a")}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => toggleConnection("hubspot")} 
                    variant={hubspotConnected ? "outline" : "default"}
                    className="flex-1"
                    disabled={isTogglingConnection}
                    data-testid="button-toggle-hubspot"
                  >
                    {hubspotConnected ? "Disconnect HubSpot" : "Connect HubSpot"}
                  </Button>
                  {hubspotConnected && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => syncHubspot()}
                      disabled={isSyncing}
                      data-testid="button-sync-hubspot"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 transition-all ${firefliesConnected ? "border-primary/20 bg-primary/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Fireflies.ai</span>
                {firefliesConnected ? (
                  <CheckCircle2 className="text-green-500 h-6 w-6" />
                ) : (
                  <XCircle className="text-muted-foreground h-6 w-6" />
                )}
              </CardTitle>
              <CardDescription>AI notetaker for extracting commitments and action items.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Includes: Meeting Transcripts, Action Items, Decisions, Due Dates.
                </div>
                {firefliesConnected && connections?.fireflies?.lastSyncAt && (
                  <div className="text-xs text-muted-foreground" data-testid="text-fireflies-last-sync">
                    Last synced: {format(new Date(connections.fireflies.lastSyncAt), "MMM d, yyyy h:mm a")}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => toggleConnection("fireflies")} 
                    variant={firefliesConnected ? "outline" : "default"}
                    className="flex-1"
                    disabled={isTogglingConnection}
                    data-testid="button-toggle-fireflies"
                  >
                    {firefliesConnected ? "Disconnect Fireflies" : "Connect Fireflies"}
                  </Button>
                  {firefliesConnected && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => syncFireflies()}
                      disabled={isSyncing}
                      data-testid="button-sync-fireflies"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
