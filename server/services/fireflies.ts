import { storage } from "../storage";
import { log } from "../index";

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

export async function syncFireflies(accountId: number): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  let apiKey: string | undefined;
  try {
    const conn = await storage.getConnection(accountId, "fireflies");
    if (conn?.config && typeof conn.config === "object" && (conn.config as any).apiKey) {
      apiKey = (conn.config as any).apiKey;
    }
  } catch (e) {}
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "Fireflies is not connected. Please add your API key on the Connections page." };
  }

  let recordsProcessed = 0;

  try {
    const query = `
      query {
        transcripts {
          id
          title
          date
          duration
          organizer_email
          participants
          sentences {
            text
            speaker_name
          }
          summary {
            action_items
            keywords
            outline
            overview
            shorthand_bullet
          }
        }
      }
    `;

    const response = await fetch(FIREFLIES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Fireflies API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const transcripts = data.data?.transcripts || [];

    for (const transcript of transcripts) {
      let meetingDate: string | null = null;
      if (transcript.date) {
        const ts = Number(transcript.date);
        const dateObj = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
        meetingDate = dateObj.toISOString().split("T")[0];
      }
      const participants = Array.isArray(transcript.participants)
        ? transcript.participants.join(", ")
        : transcript.participants || "";

      const summaryText = transcript.summary?.overview || "";
      const outline = transcript.summary?.outline || transcript.summary?.shorthand_bullet || "";
      const keywords = Array.isArray(transcript.summary?.keywords)
        ? transcript.summary.keywords.join(", ")
        : transcript.summary?.keywords || "";

      const transcriptSnippet = (transcript.sentences || [])
        .slice(0, 100)
        .map((s: any) => `${s.speaker_name}: ${s.text}`)
        .join("\n");

      await storage.upsertFirefliesMeeting({
        accountId,
        firefliesId: transcript.id,
        title: transcript.title || "Untitled Meeting",
        meetingDate,
        duration: transcript.duration ? Math.round(transcript.duration) : null,
        participants,
        summary: summaryText,
        outline: typeof outline === "string" ? outline : JSON.stringify(outline),
        keywords,
        transcript: transcriptSnippet || null,
      });
      recordsProcessed++;

      const actionItems = transcript.summary?.action_items || [];
      const actionItemsList = Array.isArray(actionItems) 
        ? actionItems.map((item: any) => typeof item === "string" ? item : item.text || JSON.stringify(item))
        : [];
      if (actionItemsList.length > 0) {
        const existingMeeting = await storage.getFirefliesMeetings(accountId);
        const match = existingMeeting.find(m => m.firefliesId === transcript.id);
        if (match) {
          const enrichedSummary = (match.summary || "") + "\n\nAction Items:\n" + actionItemsList.map((a: string) => `- ${a}`).join("\n");
          await storage.upsertFirefliesMeeting({
            ...match,
            summary: enrichedSummary,
          });
        }
      }
    }

    const existingConn = await storage.getConnection(accountId, "fireflies");
    await storage.upsertConnection(accountId, "fireflies", true, existingConn?.config, true);
    await storage.createSyncLog(accountId, "fireflies", "completed", `Synced ${recordsProcessed} records (${transcripts.length} meetings)`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog(accountId, "fireflies", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
