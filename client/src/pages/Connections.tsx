import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/lib/context"; // Corrected import path
import { CheckCircle2, XCircle } from "lucide-react";

export function Connections() {
  const { isConnected, settings, toggleConnection } = useApp();

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Data Connections</h1>
          <p className="text-muted-foreground mt-2">Manage your integrations with HubSpot and Fireflies.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* HubSpot Card */}
          <Card className={`border-2 transition-all ${settings.connectedHubSpot ? "border-primary/20 bg-primary/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>HubSpot CRM</span>
                {settings.connectedHubSpot ? (
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
                <Button 
                  onClick={() => toggleConnection("hubspot")} 
                  variant={settings.connectedHubSpot ? "outline" : "default"}
                  className="w-full"
                >
                  {settings.connectedHubSpot ? "Disconnect HubSpot" : "Connect HubSpot"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Fireflies Card */}
          <Card className={`border-2 transition-all ${settings.connectedFireflies ? "border-primary/20 bg-primary/5" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Fireflies.ai</span>
                {settings.connectedFireflies ? (
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
                <Button 
                  onClick={() => toggleConnection("fireflies")} 
                  variant={settings.connectedFireflies ? "outline" : "default"}
                  className="w-full"
                >
                  {settings.connectedFireflies ? "Disconnect Fireflies" : "Connect Fireflies"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
