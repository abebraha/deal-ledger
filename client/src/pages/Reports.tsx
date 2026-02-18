import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Mail, Loader2, ChevronDown, ChevronUp, Download, RefreshCw, CalendarDays } from "lucide-react";
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

interface FirefliesMeeting {
  id: number;
  firefliesId: string | null;
  title: string | null;
  meetingDate: string | null;
  duration: number | null;
  participants: string | null;
}

export function Reports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<number[]>([]);

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
  });

  const { data: firefliesMeetings = [], isLoading: meetingsLoading, refetch: refetchMeetings } = useQuery<FirefliesMeeting[]>({
    queryKey: ["/api/fireflies-meetings"],
  });

  const generateWeekly = useMutation({
    mutationFn: async (meetingIds: number[]) => {
      await apiRequest("POST", "/api/reports/generate/weekly", { meetingIds });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      setSelectedMeetingIds([]);
      toast({ title: "Report Generated", description: "Meeting recap has been generated." });
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
      toast({ title: "Report Generated", description: "Bi-weekly scorecard has been generated." });
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

  const toggleMeeting = (id: number) => {
    setSelectedMeetingIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedMeetingIds.length === firefliesMeetings.length) {
      setSelectedMeetingIds([]);
    } else {
      setSelectedMeetingIds(firefliesMeetings.map(m => m.id));
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.round(seconds / 60);
    return `${mins}m`;
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display" data-testid="text-reports-title">Reports</h1>
            <p className="text-muted-foreground mt-2">Generate AI-powered sales reports from your meeting recordings.</p>
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
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Weekly Meeting Recap
                </CardTitle>
                <CardDescription className="mt-1">Select which meetings to include in the recap, then generate.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchMeetings()}
                disabled={meetingsLoading}
                data-testid="button-refresh-meetings"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${meetingsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {meetingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading meetings...
              </div>
            ) : firefliesMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="text-no-meetings">
                No meetings found from the last 30 days. Sync Fireflies to pull in your recordings.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={selectAll}
                    className="text-sm text-primary hover:underline"
                    data-testid="button-select-all-meetings"
                  >
                    {selectedMeetingIds.length === firefliesMeetings.length ? "Deselect all" : "Select all"}
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {selectedMeetingIds.length} of {firefliesMeetings.length} selected
                  </span>
                </div>
                <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                  {firefliesMeetings.map(meeting => (
                    <label
                      key={meeting.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                      data-testid={`meeting-item-${meeting.id}`}
                    >
                      <Checkbox
                        checked={selectedMeetingIds.includes(meeting.id)}
                        onCheckedChange={() => toggleMeeting(meeting.id)}
                        data-testid={`checkbox-meeting-${meeting.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{meeting.title || "Untitled Meeting"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {meeting.meetingDate && (
                            <span>{format(new Date(meeting.meetingDate), "MMM d, yyyy 'at' h:mm a")}</span>
                          )}
                          {meeting.duration && (
                            <>
                              <span>·</span>
                              <span>{formatDuration(meeting.duration)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {meeting.participants && (
                        <span className="text-xs text-muted-foreground hidden sm:block max-w-[200px] truncate">
                          {meeting.participants}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <Button
                  onClick={() => generateWeekly.mutate(selectedMeetingIds)}
                  disabled={isGenerating || selectedMeetingIds.length === 0}
                  className="w-full"
                  data-testid="button-generate-weekly"
                >
                  {generateWeekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate Meeting Recap ({selectedMeetingIds.length} meeting{selectedMeetingIds.length !== 1 ? "s" : ""})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-semibold font-display mb-4">Past Reports</h2>
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
      </div>
    </Layout>
  );
}
