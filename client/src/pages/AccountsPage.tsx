import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Building2, Trash2, ArrowRight } from "lucide-react";

interface Account {
  id: number;
  name: string;
  createdAt: string;
}

export function AccountsPage() {
  const [, setLocation] = useLocation();
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/accounts", { name });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
      setNewName("");
      setShowCreate(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  const handleCreate = () => {
    if (newName.trim()) {
      createMutation.mutate(newName.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl py-16 px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-app-title">DealFlow</h1>
          </div>
          <p className="text-muted-foreground text-lg">Sales intelligence for your clients</p>
        </div>

        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="group cursor-pointer hover:border-primary/50 transition-colors"
              data-testid={`card-account-${account.id}`}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div
                  className="flex items-center gap-4 flex-1"
                  onClick={() => setLocation(`/accounts/${account.id}`)}
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg" data-testid={`text-account-name-${account.id}`}>{account.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${account.name}" and all its data?`)) {
                        deleteMutation.mutate(account.id);
                      }
                    }}
                    data-testid={`button-delete-account-${account.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation(`/accounts/${account.id}`)}
                    data-testid={`button-open-account-${account.id}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {showCreate ? (
            <Card data-testid="card-create-account">
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <Input
                    placeholder="Client name (e.g., Acme Corp)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                    data-testid="input-account-name"
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={!newName.trim() || createMutation.isPending}
                    data-testid="button-save-account"
                  >
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setShowCreate(false); setNewName(""); }}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="h-20 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => setShowCreate(true)}
              data-testid="button-add-account"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Client
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
