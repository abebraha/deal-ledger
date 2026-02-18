import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Mail, Loader2, ChevronDown, ChevronUp, Download, RefreshCw, CalendarDays, BarChart3 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useCallback, memo } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/lib/context";
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

const formatDurationHelper = (seconds: number | null) => {
  if (!seconds) return "";
  const mins = Math.round(seconds / 60);
  return `${mins}m`;
};

const MeetingSelector = memo(({
  meetings,
  loading,
  selectedIds,
  onToggle,
  onSelectAll,
  testIdPrefix,
}: {
  meetings: FirefliesMeeting[];
  loading: boolean;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  testIdPrefix: string;
}) => (
  <div className="space-y-3">
    {loading ? (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading meetings...
      </div>
    ) : meetings.length === 0 ? (
      <p className="text-sm text-muted-foreground py-4" data-testid={`text-no-meetings-${testIdPrefix}`}>
        No meetings found from the last 30 days. Sync Fireflies to pull in your recordings.
      </p>
    ) : (
      <>
        <div className="flex items-center justify-between">
          <button
            onClick={onSelectAll}
            className="text-sm text-primary hover:underline"
            data-testid={`button-select-all-${testIdPrefix}`}
          >
            {selectedIds.length === meetings.length ? "Deselect all" : "Select all"}
          </button>
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} of {meetings.length} selected
          </span>
        </div>
        <div className="border rounded-md divide-y max-h-[250px] overflow-y-auto">
          {meetings.map(meeting => (
            <div
              key={meeting.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
              data-testid={`${testIdPrefix}-meeting-item-${meeting.id}`}
              onClick={() => onToggle(meeting.id)}
            >
              <Checkbox
                checked={selectedIds.includes(meeting.id)}
                tabIndex={-1}
                data-testid={`${testIdPrefix}-checkbox-meeting-${meeting.id}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{meeting.title || "Untitled Meeting"}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {meeting.meetingDate && (
                    <span>{format(new Date(meeting.meetingDate + "T00:00:00"), "MMM d, yyyy")}</span>
                  )}
                  {meeting.duration && (
                    <>
                      <span>·</span>
                      <span>{formatDurationHelper(meeting.duration)}</span>
                    </>
                  )}
                </div>
              </div>
              {meeting.participants && (
                <span className="text-xs text-muted-foreground hidden sm:block max-w-[200px] truncate">
                  {meeting.participants}
                </span>
              )}
            </div>
          ))}
        </div>
      </>
    )}
  </div>
));

MeetingSelector.displayName = "MeetingSelector";

export function Reports() {
  const { accountId } = useApp();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [weeklyMeetingIds, setWeeklyMeetingIds] = useState<number[]>([]);
  const [biweeklyMeetingIds, setBiweeklyMeetingIds] = useState<number[]>([]);
  const base = `/api/accounts/${accountId}`;

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: [base, "reports"],
    queryFn: async () => { const r = await fetch(`${base}/reports`); return r.json(); },
  });

  const { data: firefliesMeetings = [], isLoading: meetingsLoading, refetch: refetchMeetings } = useQuery<FirefliesMeeting[]>({
    queryKey: [base, "fireflies-meetings"],
    queryFn: async () => { const r = await fetch(`${base}/fireflies-meetings`); return r.json(); },
  });

  const generateWeekly = useMutation({
    mutationFn: async (meetingIds: number[]) => {
      await apiRequest("POST", `${base}/reports/generate/weekly`, { meetingIds });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [base, "reports"] });
      setWeeklyMeetingIds([]);
      toast({ title: "Report Generated", description: "Meeting recap has been generated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateBiweekly = useMutation({
    mutationFn: async (meetingIds: number[]) => {
      await apiRequest("POST", `${base}/reports/generate/biweekly`, { meetingIds });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [base, "reports"] });
      setBiweeklyMeetingIds([]);
      toast({ title: "Report Generated", description: "Bi-weekly scorecard has been generated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markAsSent = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `${base}/reports/${id}/send`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [base, "reports"] });
      toast({ title: "Report Sent", description: "Report has been marked as sent." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isGenerating = generateWeekly.isPending || generateBiweekly.isPending;

  const handleDownloadPDF = (report: Report) => {
    window.open(`${base}/reports/${report.id}/pdf`, "_blank");
  };

  const toggleWeekly = useCallback((id: number) => {
    setWeeklyMeetingIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);
  const toggleBiweekly = useCallback((id: number) => {
    setBiweeklyMeetingIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);
  const selectAllWeekly = useCallback(() => {
    setWeeklyMeetingIds(prev => prev.length === firefliesMeetings.length ? [] : firefliesMeetings.map(m => m.id));
  }, [firefliesMeetings]);
  const selectAllBiweekly = useCallback(() => {
    setBiweeklyMeetingIds(prev => prev.length === firefliesMeetings.length ? [] : firefliesMeetings.map(m => m.id));
  }, [firefliesMeetings]);

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display" data-testid="text-reports-title">Reports</h1>
            <p className="text-muted-foreground mt-2">Generate AI-powered sales reports from your meeting recordings.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchMeetings()}
            disabled={meetingsLoading}
            data-testid="button-refresh-meetings"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${meetingsLoading ? "animate-spin" : ""}`} />
            Refresh Meetings
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Weekly Meeting Recap
              </CardTitle>
              <CardDescription>Select meetings to include, then generate a recap focused on discussions and action items.</CardDescription>
            </CardHeader>
            <CardContent>
              <MeetingSelector
                meetings={firefliesMeetings}
                loading={meetingsLoading}
                selectedIds={weeklyMeetingIds}
                onToggle={toggleWeekly}
                onSelectAll={selectAllWeekly}
                testIdPrefix="weekly"
              />
              <Button
                onClick={() => generateWeekly.mutate(weeklyMeetingIds)}
                disabled={isGenerating || weeklyMeetingIds.length === 0}
                className="w-full mt-3"
                data-testid="button-generate-weekly"
              >
                {generateWeekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Recap ({weeklyMeetingIds.length} meeting{weeklyMeetingIds.length !== 1 ? "s" : ""})
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Bi-Weekly Scorecard
              </CardTitle>
              <CardDescription>Select meetings for context, then generate a full pipeline and performance scorecard.</CardDescription>
            </CardHeader>
            <CardContent>
              <MeetingSelector
                meetings={firefliesMeetings}
                loading={meetingsLoading}
                selectedIds={biweeklyMeetingIds}
                onToggle={toggleBiweekly}
                onSelectAll={selectAllBiweekly}
                testIdPrefix="biweekly"
              />
              <Button
                onClick={() => generateBiweekly.mutate(biweeklyMeetingIds)}
                disabled={isGenerating}
                variant="outline"
                className="w-full mt-3"
                data-testid="button-generate-biweekly"
              >
                {generateBiweekly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Scorecard
                {biweeklyMeetingIds.length > 0 && ` (${biweeklyMeetingIds.length} meeting${biweeklyMeetingIds.length !== 1 ? "s" : ""})`}
              </Button>
            </CardContent>
          </Card>
        </div>

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
