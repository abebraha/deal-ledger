import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: number;
  type: string;
  title: string;
  content: string;
  kpis: any;
  periodStart: string | null;
  periodEnd: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function Reports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
  });

  const generateWeekly = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reports/generate/weekly");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report Generated", description: "Weekly report has been generated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateBiweekly = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reports/generate/biweekly");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report Generated", description: "Bi-weekly report has been generated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markAsSent = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/reports/${id}/send`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report Sent", description: "Report has been marked as sent." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isGenerating = generateWeekly.isPending || generateBiweekly.isPending;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Reports Archive</h1>
            <p className="text-muted-foreground mt-2">View past AI-generated reports and scorecards.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateBiweekly.mutate()}
              disabled={isGenerating}
              data-testid="button-generate-biweekly"
            >
              {generateBiweekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bi-Weekly Report
            </Button>
            <Button
              onClick={() => generateWeekly.mutate()}
              disabled={isGenerating}
              data-testid="button-generate-weekly"
            >
              {generateWeekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Weekly Report
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No reports yet. Generate your first report above.
          </div>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-report-${report.id}`}>
                <div
                  className="flex flex-row items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{report.title}</h3>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{format(new Date(report.createdAt), "MMM d, yyyy")}</span>
                        <span>•</span>
                        <Badge variant="outline" className="text-xs">{report.type}</Badge>
                        {report.sentAt && (
                          <Badge variant="secondary" className="text-xs">Sent</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!report.sentAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); markAsSent.mutate(report.id); }}
                        disabled={markAsSent.isPending}
                        data-testid={`button-send-report-${report.id}`}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Mark Sent
                      </Button>
                    )}
                    {expandedId === report.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                {expandedId === report.id && (
                  <CardContent className="pt-0 border-t">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap mt-4" data-testid={`text-report-content-${report.id}`}>
                      {report.content}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
