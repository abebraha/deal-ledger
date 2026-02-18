import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/context";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, RefreshCw, Eye, EyeOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export function Connections() {
  const { connections, connectService, disconnectService, isConnecting, syncHubspot, syncFireflies, isSyncing } = useApp();
  const { toast } = useToast();

  const [hubspotKey, setHubspotKey] = useState("");
  const [firefliesKey, setFirefliesKey] = useState("");
  const [showHubspotKey, setShowHubspotKey] = useState(false);
  const [showFirefliesKey, setShowFirefliesKey] = useState(false);
  const [connectingService, setConnectingService] = useState<string | null>(null);

  const hubspotConnected = connections?.hubspot?.connected ?? false;
  const firefliesConnected = connections?.fireflies?.connected ?? false;

  const handleConnect = async (service: "hubspot" | "fireflies") => {
    const key = service === "hubspot" ? hubspotKey : firefliesKey;
    if (!key.trim()) {
      toast({ title: "API Key Required", description: `Please enter your ${service === "hubspot" ? "HubSpot" : "Fireflies"} API key.`, variant: "destructive" });
      return;
    }

    setConnectingService(service);
    try {
      await connectService(service, key.trim());
      toast({ title: "Connected!", description: `${service === "hubspot" ? "HubSpot" : "Fireflies"} connected successfully. Running initial sync...` });
      if (service === "hubspot") {
        setHubspotKey("");
        syncHubspot();
      } else {
        setFirefliesKey("");
        syncFireflies();
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Connection failed. Please check your API key.";
      toast({ title: "Connection Failed", description: errorMsg, variant: "destructive" });
    } finally {
      setConnectingService(null);
    }
  };

  const handleDisconnect = (service: "hubspot" | "fireflies") => {
    disconnectService(service);
    toast({ title: "Disconnected", description: `${service === "hubspot" ? "HubSpot" : "Fireflies"} has been disconnected.` });
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Data Connections</h1>
          <p className="text-muted-foreground mt-2">Connect your HubSpot and Fireflies accounts to start syncing data.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className={`border-2 transition-all ${hubspotConnected ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>HubSpot CRM</span>
                {hubspotConnected ? (
                  <CheckCircle2 className="text-green-500 h-6 w-6" data-testid="icon-hubspot-connected" />
                ) : (
                  <XCircle className="text-muted-foreground h-6 w-6" data-testid="icon-hubspot-disconnected" />
                )}
              </CardTitle>
              <CardDescription>Source of truth for deals, activities, and revenue.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Syncs: Deals, Contacts, Emails, Calls, Meetings, Tasks.
                </div>

                {!hubspotConnected ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="hubspot-key">Private App Token</Label>
                      <div className="relative">
                        <Input
                          id="hubspot-key"
                          type={showHubspotKey ? "text" : "password"}
                          placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={hubspotKey}
                          onChange={(e) => setHubspotKey(e.target.value)}
                          data-testid="input-hubspot-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowHubspotKey(!showHubspotKey)}
                        >
                          {showHubspotKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create a Private App in HubSpot Settings &gt; Integrations &gt; Private Apps.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleConnect("hubspot")}
                      className="w-full"
                      disabled={connectingService === "hubspot" || !hubspotKey.trim()}
                      data-testid="button-connect-hubspot"
                    >
                      {connectingService === "hubspot" ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
                      ) : (
                        "Connect HubSpot"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connections?.hubspot?.lastSyncAt && (
                      <div className="text-xs text-muted-foreground" data-testid="text-hubspot-last-sync">
                        Last synced: {format(new Date(connections.hubspot.lastSyncAt), "MMM d, yyyy h:mm a")}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncHubspot()}
                        disabled={isSyncing}
                        className="flex-1"
                        data-testid="button-sync-hubspot"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Syncing..." : "Sync Now"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect("hubspot")}
                        data-testid="button-disconnect-hubspot"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 transition-all ${firefliesConnected ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Fireflies.ai</span>
                {firefliesConnected ? (
                  <CheckCircle2 className="text-green-500 h-6 w-6" data-testid="icon-fireflies-connected" />
                ) : (
                  <XCircle className="text-muted-foreground h-6 w-6" data-testid="icon-fireflies-disconnected" />
                )}
              </CardTitle>
              <CardDescription>AI notetaker for extracting meeting context and insights.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Syncs: Meeting Transcripts, Summaries, Keywords, Insights.
                </div>

                {!firefliesConnected ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="fireflies-key">API Key</Label>
                      <div className="relative">
                        <Input
                          id="fireflies-key"
                          type={showFirefliesKey ? "text" : "password"}
                          placeholder="Your Fireflies API key"
                          value={firefliesKey}
                          onChange={(e) => setFirefliesKey(e.target.value)}
                          data-testid="input-fireflies-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowFirefliesKey(!showFirefliesKey)}
                        >
                          {showFirefliesKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Find your API key at fireflies.ai/account/integrations.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleConnect("fireflies")}
                      className="w-full"
                      disabled={connectingService === "fireflies" || !firefliesKey.trim()}
                      data-testid="button-connect-fireflies"
                    >
                      {connectingService === "fireflies" ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
                      ) : (
                        "Connect Fireflies"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connections?.fireflies?.lastSyncAt && (
                      <div className="text-xs text-muted-foreground" data-testid="text-fireflies-last-sync">
                        Last synced: {format(new Date(connections.fireflies.lastSyncAt), "MMM d, yyyy h:mm a")}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncFireflies()}
                        disabled={isSyncing}
                        className="flex-1"
                        data-testid="button-sync-fireflies"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Syncing..." : "Sync Now"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect("fireflies")}
                        data-testid="button-disconnect-fireflies"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
