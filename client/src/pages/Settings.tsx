import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, Plus, Trash2, UserX } from "lucide-react";

interface HubSpotOwner {
  id: string;
  name: string;
  email: string | null;
}

interface SalesRep {
  id: number;
  name: string;
  hubspotOwnerId: string | null;
  excluded: boolean;
}

export function Settings() {
  const { settings, saveSettings, isSavingSettings, connections } = useApp();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [formData, setFormData] = useState({
    weeklyMeetingsGoal: 15,
    weeklyOutboundGoal: 50,
  });

  const [newRepName, setNewRepName] = useState("");

  const hubspotConnected = connections?.hubspot?.connected;

  const { data: hubspotOwners = [], isLoading: ownersLoading } = useQuery<HubSpotOwner[]>({
    queryKey: ["/api/hubspot/owners"],
    enabled: !!hubspotConnected,
  });

  const { data: salesReps = [], isLoading: repsLoading } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
  });

  const createRep = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/sales-reps", { name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      setNewRepName("");
      toast({ title: "Rep Added", description: "New sales rep has been added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRep = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; hubspotOwnerId?: string | null; excluded?: boolean; name?: string }) => {
      await apiRequest("PATCH", `/api/sales-reps/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-reps"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteRep = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sales-reps/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      toast({ title: "Rep Removed", description: "Sales rep has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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
      description: "Your goals have been updated.",
    });
  };

  const handleAddRep = () => {
    if (newRepName.trim()) {
      createRep.mutate(newRepName.trim());
    }
  };

  const getOwnerLabel = (ownerId: string) => {
    const owner = hubspotOwners.find(o => o.id === ownerId);
    return owner ? `${owner.name}${owner.email ? ` (${owner.email})` : ""}` : "Unknown";
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your sales reps, goals, and targets.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sales Reps
            </CardTitle>
            <CardDescription>
              Add or remove sales reps. Map each to their HubSpot account, or exclude them from data sync and reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {repsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading reps...
              </div>
            ) : (
              <>
                {salesReps.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No reps configured yet. Add your first rep below.</p>
                )}

                <div className="space-y-3">
                  {salesReps.map(rep => (
                    <div
                      key={rep.id}
                      className={`border rounded-lg p-4 space-y-3 transition-opacity ${rep.excluded ? "opacity-50 bg-muted/30" : ""}`}
                      data-testid={`rep-card-${rep.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{rep.name}</span>
                          {rep.excluded && (
                            <Badge variant="secondary" className="text-xs">
                              <UserX className="h-3 w-3 mr-1" />
                              Excluded
                            </Badge>
                          )}
                          {rep.hubspotOwnerId && !rep.excluded && (
                            <Badge variant="outline" className="text-xs">Mapped</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor={`exclude-${rep.id}`} className="text-xs text-muted-foreground cursor-pointer">
                              Exclude
                            </Label>
                            <Switch
                              id={`exclude-${rep.id}`}
                              checked={rep.excluded}
                              onCheckedChange={(checked) => updateRep.mutate({ id: rep.id, excluded: checked })}
                              data-testid={`switch-exclude-${rep.id}`}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteRep.mutate(rep.id)}
                            data-testid={`button-delete-rep-${rep.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {!rep.excluded && hubspotConnected && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">HubSpot User</Label>
                          {ownersLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading...
                            </div>
                          ) : (
                            <Select
                              value={rep.hubspotOwnerId || "unmapped"}
                              onValueChange={(val) => updateRep.mutate({ id: rep.id, hubspotOwnerId: val === "unmapped" ? null : val })}
                            >
                              <SelectTrigger className="h-9" data-testid={`select-hubspot-${rep.id}`}>
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
                          )}
                          {rep.hubspotOwnerId && (
                            <p className="text-xs text-muted-foreground">Mapped to: {getOwnerLabel(rep.hubspotOwnerId)}</p>
                          )}
                        </div>
                      )}

                      {!rep.excluded && !hubspotConnected && (
                        <p className="text-xs text-muted-foreground">Connect HubSpot to map this rep to their account.</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    placeholder="New rep name..."
                    value={newRepName}
                    onChange={(e) => setNewRepName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRep()}
                    className="flex-1"
                    data-testid="input-new-rep-name"
                  />
                  <Button
                    onClick={handleAddRep}
                    disabled={!newRepName.trim() || createRep.isPending}
                    size="sm"
                    data-testid="button-add-rep"
                  >
                    {createRep.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Add Rep
                  </Button>
                </div>
              </>
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
          {isSavingSettings ? "Saving..." : "Save Activity Goals"}
        </Button>
      </div>
    </Layout>
  );
}
