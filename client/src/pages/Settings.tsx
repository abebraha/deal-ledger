import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";

interface HubSpotOwner {
  id: string;
  name: string;
  email: string | null;
}

export function Settings() {
  const { settings, saveSettings, isSavingSettings, connections } = useApp();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    weeklyMeetingsGoal: 15,
    weeklyOutboundGoal: 50,
  });

  const [repMappings, setRepMappings] = useState<Record<string, string>>({
    deb: "",
    dovi: "",
  });

  const hubspotConnected = connections?.hubspot?.connected;

  const { data: hubspotOwners = [], isLoading: ownersLoading } = useQuery<HubSpotOwner[]>({
    queryKey: ["/api/hubspot/owners"],
    enabled: !!hubspotConnected,
  });

  const hubspotRevenueGoal = settings?.hubspotRevenueGoal ? parseInt(settings.hubspotRevenueGoal, 10) : null;

  useEffect(() => {
    if (settings) {
      setFormData({
        weeklyMeetingsGoal: settings.weeklyMeetingsGoal ? parseInt(settings.weeklyMeetingsGoal, 10) : 15,
        weeklyOutboundGoal: settings.weeklyOutboundGoal ? parseInt(settings.weeklyOutboundGoal, 10) : 50,
      });
      setRepMappings({
        deb: settings.rep_hubspot_owner_deb || "",
        dovi: settings.rep_hubspot_owner_dovi || "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    saveSettings({
      weeklyMeetingsGoal: String(formData.weeklyMeetingsGoal),
      weeklyOutboundGoal: String(formData.weeklyOutboundGoal),
      rep_hubspot_owner_deb: repMappings.deb,
      rep_hubspot_owner_dovi: repMappings.dovi,
    });
    toast({
      title: "Settings Saved",
      description: "Your goals and rep mappings have been updated.",
    });
  };

  const getOwnerLabel = (ownerId: string) => {
    const owner = hubspotOwners.find(o => o.id === ownerId);
    return owner ? `${owner.name}${owner.email ? ` (${owner.email})` : ""}` : "Not mapped";
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground mt-2">Configure rep mappings, goals, and targets.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rep Mapping
            </CardTitle>
            <CardDescription>Map your sales reps to their HubSpot user accounts. This ensures the app pulls the right data for each person.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hubspotConnected ? (
              <p className="text-sm text-muted-foreground">Connect HubSpot first to map reps to their accounts.</p>
            ) : ownersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading HubSpot users...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rep-deb">Deb</Label>
                  <Select
                    value={repMappings.deb || "unmapped"}
                    onValueChange={(val) => setRepMappings({ ...repMappings, deb: val === "unmapped" ? "" : val })}
                  >
                    <SelectTrigger id="rep-deb" data-testid="select-rep-deb">
                      <SelectValue placeholder="Select HubSpot user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">Auto-detect (name matching)</SelectItem>
                      {hubspotOwners.map(owner => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}{owner.email ? ` (${owner.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {repMappings.deb && (
                    <p className="text-xs text-muted-foreground">Mapped to: {getOwnerLabel(repMappings.deb)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rep-dovi">Dovi</Label>
                  <Select
                    value={repMappings.dovi || "unmapped"}
                    onValueChange={(val) => setRepMappings({ ...repMappings, dovi: val === "unmapped" ? "" : val })}
                  >
                    <SelectTrigger id="rep-dovi" data-testid="select-rep-dovi">
                      <SelectValue placeholder="Select HubSpot user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">Auto-detect (name matching)</SelectItem>
                      {hubspotOwners.map(owner => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}{owner.email ? ` (${owner.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {repMappings.dovi && (
                    <p className="text-xs text-muted-foreground">Mapped to: {getOwnerLabel(repMappings.dovi)}</p>
                  )}
                </div>

                {hubspotOwners.length === 0 && (
                  <p className="text-sm text-amber-600">No HubSpot users found. Try syncing HubSpot first.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Goal</CardTitle>
            <CardDescription>Synced automatically from HubSpot goals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold" data-testid="text-revenue-goal">
                ${hubspotRevenueGoal ? hubspotRevenueGoal.toLocaleString() : "Not synced yet"}
              </span>
              <Badge variant="outline" className="text-xs">From HubSpot</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This goal is pulled from your HubSpot account during sync. To change it, update your goals in HubSpot.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Goals</CardTitle>
            <CardDescription>Set your weekly activity targets for the team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meetings">Weekly Meetings Goal</Label>
                <Input 
                  id="meetings" 
                  type="number" 
                  value={formData.weeklyMeetingsGoal} 
                  onChange={(e) => setFormData({...formData, weeklyMeetingsGoal: parseInt(e.target.value) || 0})}
                  data-testid="input-meetings-goal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outbound">Weekly Outbound Goal</Label>
                <Input 
                  id="outbound" 
                  type="number" 
                  value={formData.weeklyOutboundGoal} 
                  onChange={(e) => setFormData({...formData, weeklyOutboundGoal: parseInt(e.target.value) || 0})}
                  data-testid="input-outbound-goal"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full" size="lg" disabled={isSavingSettings} data-testid="button-save-settings">
          {isSavingSettings ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </Layout>
  );
}
