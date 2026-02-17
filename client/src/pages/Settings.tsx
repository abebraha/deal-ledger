import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/context"; // Corrected import path
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function Settings() {
  const { settings, updateSettings } = useApp();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    monthlyRevenueGoal: settings.monthlyRevenueGoal,
    weeklyMeetingsGoal: settings.weeklyMeetingsGoal,
    weeklyOutboundGoal: settings.weeklyOutboundGoal,
  });

  const handleSave = () => {
    updateSettings(formData);
    toast({
      title: "Settings Saved",
      description: "Your goals have been updated successfully.",
    });
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Target Settings</h1>
          <p className="text-muted-foreground mt-2">Define your success metrics and goals.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sales Goals</CardTitle>
            <CardDescription>These targets are used to calculate performance KPIs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="revenue">Monthly Revenue Goal ($)</Label>
              <Input 
                id="revenue" 
                type="number" 
                value={formData.monthlyRevenueGoal} 
                onChange={(e) => setFormData({...formData, monthlyRevenueGoal: parseInt(e.target.value)})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meetings">Weekly Meetings Goal</Label>
                <Input 
                  id="meetings" 
                  type="number" 
                  value={formData.weeklyMeetingsGoal} 
                  onChange={(e) => setFormData({...formData, weeklyMeetingsGoal: parseInt(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outbound">Weekly Outbound Goal</Label>
                <Input 
                  id="outbound" 
                  type="number" 
                  value={formData.weeklyOutboundGoal} 
                  onChange={(e) => setFormData({...formData, weeklyOutboundGoal: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
