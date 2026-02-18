import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function Settings() {
  const { settings, saveSettings, isSavingSettings } = useApp();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    weeklyMeetingsGoal: 15,
    weeklyOutboundGoal: 50,
  });

  const hubspotRevenueGoal = settings?.hubspotRevenueGoal ? parseInt(settings.hubspotRevenueGoal, 10) : null;

  useEffect(() => {
    if (settings) {
      setFormData({
        weeklyMeetingsGoal: settings.weeklyMeetingsGoal ? parseInt(settings.weeklyMeetingsGoal, 10) : 15,
        weeklyOutboundGoal: settings.weeklyOutboundGoal ? parseInt(settings.weeklyOutboundGoal, 10) : 50,
      });
    }
  }, [settings]);

  const handleSave = () => {
    saveSettings({
      weeklyMeetingsGoal: String(formData.weeklyMeetingsGoal),
      weeklyOutboundGoal: String(formData.weeklyOutboundGoal),
    });
    toast({
      title: "Settings Saved",
      description: "Your goals have been updated successfully.",
    });
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display" data-testid="text-settings-title">Target Settings</h1>
          <p className="text-muted-foreground mt-2">Define your success metrics and goals.</p>
        </div>

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

            <Button onClick={handleSave} className="w-full" disabled={isSavingSettings} data-testid="button-save-settings">
              {isSavingSettings ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
