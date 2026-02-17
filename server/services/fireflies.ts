import { storage } from "../storage";
import { log } from "../index";

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

export async function syncFireflies(): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "FIREFLIES_API_KEY not set" };
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

      // Extract action items as commitments
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

      // Extract key decisions from summary
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

    await storage.upsertConnection("fireflies", true);
    await storage.createSyncLog("fireflies", "completed", `Synced ${recordsProcessed} records`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog("fireflies", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
