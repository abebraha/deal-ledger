import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail, Loader2, ChevronDown, ChevronUp, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

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

  const handleDownloadPDF = (report: Report) => {
    window.open(`/api/reports/${report.id}/pdf`, "_blank");
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display" data-testid="text-reports-title">Reports</h1>
            <p className="text-muted-foreground mt-2">Generate and download AI-powered sales reports.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateBiweekly.mutate()}
              disabled={isGenerating}
              data-testid="button-generate-biweekly"
            >
              {generateBiweekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bi-Weekly Scorecard
            </Button>
            <Button
              onClick={() => generateWeekly.mutate()}
              disabled={isGenerating}
              data-testid="button-generate-weekly"
            >
              {generateWeekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Weekly Meeting Recap
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-reports">
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
                        <span>{format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                        <span>·</span>
                        <Badge variant="outline" className="text-xs">
                          {report.type === "weekly" ? "Meeting Recap" : report.type === "biweekly" ? "Bi-Weekly Scorecard" : "Custom"}
                        </Badge>
                        {report.sentAt && (
                          <Badge variant="secondary" className="text-xs">Sent</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDownloadPDF(report); }}
                      data-testid={`button-download-pdf-${report.id}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
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
                    <div className="prose prose-sm max-w-none mt-4 dark:prose-invert" data-testid={`text-report-content-${report.id}`}>
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-2 text-primary">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-1">{children}</h4>,
                          hr: () => <hr className="my-4 border-border" />,
                          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>,
                          li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                          p: ({ children }) => <p className="text-sm leading-relaxed my-2">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
                        }}
                      >
                        {report.content}
                      </ReactMarkdown>
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
