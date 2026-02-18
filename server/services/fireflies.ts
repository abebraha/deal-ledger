import { storage } from "../storage";
import { log } from "../index";

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

export async function syncFireflies(): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  let apiKey = process.env.FIREFLIES_API_KEY;
  try {
    const conn = await storage.getConnection("fireflies");
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
          action_items
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
      const meetingDate = transcript.date ? new Date(transcript.date * 1000).toISOString().split("T")[0] : null;
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
        firefliesId: transcript.id,
        title: transcript.title || "Untitled Meeting",
        meetingDate,
        duration: transcript.duration || null,
        participants,
        summary: summaryText,
        outline: typeof outline === "string" ? outline : JSON.stringify(outline),
        keywords,
        transcript: transcriptSnippet || null,
      });
      recordsProcessed++;

      const actionItems = transcript.action_items || transcript.summary?.action_items || [];
      
      if (Array.isArray(actionItems)) {
        for (const item of actionItems) {
          const content = typeof item === "string" ? item : item.text || JSON.stringify(item);
          await storage.upsertCommitment({
            firefliesMeetingId: transcript.id,
            meetingDate: meetingDate,
            meetingTitle: transcript.title || "Untitled Meeting",
            type: "action_item",
            content: content,
            owner: typeof item === "object" ? item.assignee : null,
            dueDate: typeof item === "object" ? item.due_date : null,
            status: "pending",
            firefliesUrl: `https://app.fireflies.ai/view/${transcript.id}`,
          });
          recordsProcessed++;
        }
      }

      if (transcript.summary?.overview) {
        await storage.upsertCommitment({
          firefliesMeetingId: transcript.id,
          meetingDate: meetingDate,
          meetingTitle: transcript.title || "Untitled Meeting",
          type: "decision",
          content: transcript.summary.overview,
          status: "completed",
          firefliesUrl: `https://app.fireflies.ai/view/${transcript.id}`,
        });
        recordsProcessed++;
      }
    }

    const existingConn = await storage.getConnection("fireflies");
    await storage.upsertConnection("fireflies", true, existingConn?.config, true);
    await storage.createSyncLog("fireflies", "completed", `Synced ${recordsProcessed} records (${transcripts.length} meetings)`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog("fireflies", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
