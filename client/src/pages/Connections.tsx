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

const serviceLabels: Record<string, string> = {
  hubspot: "HubSpot",
  fireflies: "Fireflies",
  close: "Close CRM",
};

export function Connections() {
  const { connections, connectService, disconnectService, isConnecting, syncHubspot, syncFireflies, syncClose, isSyncing } = useApp();
  const { toast } = useToast();

  const [hubspotKey, setHubspotKey] = useState("");
  const [firefliesKey, setFirefliesKey] = useState("");
  const [closeKey, setCloseKey] = useState("");
  const [showHubspotKey, setShowHubspotKey] = useState(false);
  const [showFirefliesKey, setShowFirefliesKey] = useState(false);
  const [showCloseKey, setShowCloseKey] = useState(false);
  const [connectingService, setConnectingService] = useState<string | null>(null);

  const hubspotConnected = connections?.hubspot?.connected ?? false;
  const firefliesConnected = connections?.fireflies?.connected ?? false;
  const closeConnected = connections?.close?.connected ?? false;

  const handleConnect = async (service: "hubspot" | "fireflies" | "close") => {
    const key = service === "hubspot" ? hubspotKey : service === "fireflies" ? firefliesKey : closeKey;
    if (!key.trim()) {
      toast({ title: "API Key Required", description: `Please enter your ${serviceLabels[service]} API key.`, variant: "destructive" });
      return;
    }

    setConnectingService(service);
    try {
      await connectService(service, key.trim());
      toast({ title: "Connected!", description: `${serviceLabels[service]} connected successfully. Running initial sync...` });
      if (service === "hubspot") {
        setHubspotKey("");
        syncHubspot();
      } else if (service === "fireflies") {
        setFirefliesKey("");
        syncFireflies();
      } else {
        setCloseKey("");
        syncClose();
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Connection failed. Please check your API key.";
      toast({ title: "Connection Failed", description: errorMsg, variant: "destructive" });
    } finally {
      setConnectingService(null);
    }
  };

  const handleDisconnect = (service: "hubspot" | "fireflies" | "close") => {
    disconnectService(service);
    toast({ title: "Disconnected", description: `${serviceLabels[service]} has been disconnected.` });
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Data Connections</h1>
          <p className="text-muted-foreground mt-2">Connect your CRM and meeting tools to start syncing data.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

          <Card className={`border-2 transition-all ${closeConnected ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Close CRM</span>
                {closeConnected ? (
                  <CheckCircle2 className="text-green-500 h-6 w-6" data-testid="icon-close-connected" />
                ) : (
                  <XCircle className="text-muted-foreground h-6 w-6" data-testid="icon-close-disconnected" />
                )}
              </CardTitle>
              <CardDescription>Alternative CRM for deals, activities, and sales tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Syncs: Opportunities, Calls, Emails, Notes, Meetings.
                </div>

                {!closeConnected ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="close-key">API Key</Label>
                      <div className="relative">
                        <Input
                          id="close-key"
                          type={showCloseKey ? "text" : "password"}
                          placeholder="api_xxxxxxxxxxxxxxxxxxxxxxxx"
                          value={closeKey}
                          onChange={(e) => setCloseKey(e.target.value)}
                          data-testid="input-close-key"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowCloseKey(!showCloseKey)}
                        >
                          {showCloseKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Find your API key in Close Settings &gt; Integrations &gt; API Keys.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleConnect("close")}
                      className="w-full"
                      disabled={connectingService === "close" || !closeKey.trim()}
                      data-testid="button-connect-close"
                    >
                      {connectingService === "close" ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</>
                      ) : (
                        "Connect Close CRM"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connections?.close?.lastSyncAt && (
                      <div className="text-xs text-muted-foreground" data-testid="text-close-last-sync">
                        Last synced: {format(new Date(connections.close.lastSyncAt), "MMM d, yyyy h:mm a")}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncClose()}
                        disabled={isSyncing}
                        className="flex-1"
                        data-testid="button-sync-close"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Syncing..." : "Sync Now"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect("close")}
                        data-testid="button-disconnect-close"
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
