import { storage } from "../storage";
import { log } from "../index";

export async function syncHubSpot(): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "HUBSPOT_API_KEY not set" };
  }

  let recordsProcessed = 0;

  try {
    // Sync Deals
    const dealsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,hubspot_owner_id,hs_lastmodifieddate,pipeline", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!dealsResponse.ok) {
      const errorText = await dealsResponse.text();
      throw new Error(`HubSpot Deals API error ${dealsResponse.status}: ${errorText}`);
    }

    const dealsData = await dealsResponse.json();
    for (const deal of dealsData.results || []) {
      await storage.upsertDeal({
        hubspotId: deal.id,
        name: deal.properties.dealname || "Untitled Deal",
        amount: parseFloat(deal.properties.amount) || 0,
        stage: deal.properties.dealstage || "unknown",
        closeDate: deal.properties.closedate || null,
        lastActivityDate: deal.properties.hs_lastmodifieddate || null,
        pipeline: deal.properties.pipeline || null,
        hubspotUrl: `https://app.hubspot.com/contacts/deals/${deal.id}`,
      });
      recordsProcessed++;
    }

    // Sync owner names for deals
    try {
      const ownersResponse = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (ownersResponse.ok) {
        const ownersData = await ownersResponse.json();
        const ownerMap: Record<string, string> = {};
        for (const owner of ownersData.results || []) {
          ownerMap[owner.id] = `${owner.firstName || ""} ${owner.lastName || ""}`.trim();
        }
        // Update deal owners
        const allDeals = await storage.getDeals();
        for (const deal of allDeals) {
          if (deal.hubspotId) {
            const hubspotDeal = (dealsData.results || []).find((d: any) => d.id === deal.hubspotId);
            if (hubspotDeal?.properties?.hubspot_owner_id) {
              const ownerName = ownerMap[hubspotDeal.properties.hubspot_owner_id];
              if (ownerName) {
                await storage.upsertDeal({ ...deal, owner: ownerName, hubspotId: deal.hubspotId });
              }
            }
          }
        }
      }
    } catch (e) {
      log(`Warning: Could not sync owners: ${e}`, "hubspot");
    }

    // Sync Engagements (activities)
    try {
      for (const engType of ["calls", "emails", "notes", "tasks"]) {
        const engResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/${engType}?limit=50&properties=hs_timestamp,hs_call_title,hs_email_subject,hs_note_body,hs_task_subject,hubspot_owner_id`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (engResponse.ok) {
          const engData = await engResponse.json();
          for (const eng of engData.results || []) {
            const subject = eng.properties.hs_call_title || eng.properties.hs_email_subject || eng.properties.hs_task_subject || engType;
            const body = eng.properties.hs_note_body || "";
            await storage.upsertActivity({
              hubspotId: eng.id,
              type: engType.toUpperCase().replace(/S$/, ""),
              subject: subject,
              body: body,
              activityDate: eng.properties.hs_timestamp || eng.createdAt,
              hubspotUrl: `https://app.hubspot.com/contacts/activity/${eng.id}`,
            });
            recordsProcessed++;
          }
        }
      }
    } catch (e) {
      log(`Warning: Could not sync activities: ${e}`, "hubspot");
    }

    // Sync Meetings
    try {
      const meetingsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/meetings?limit=50&properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hubspot_owner_id", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json();
        for (const mtg of meetingsData.results || []) {
          await storage.upsertMeeting({
            hubspotId: mtg.id,
            title: mtg.properties.hs_meeting_title || "Untitled Meeting",
            startTime: mtg.properties.hs_meeting_start_time || null,
            endTime: mtg.properties.hs_meeting_end_time || null,
            outcome: mtg.properties.hs_meeting_outcome || null,
            hubspotUrl: `https://app.hubspot.com/contacts/meetings/${mtg.id}`,
          });
          recordsProcessed++;
        }
      }
    } catch (e) {
      log(`Warning: Could not sync meetings: ${e}`, "hubspot");
    }

    await storage.upsertConnection("hubspot", true);
    await storage.createSyncLog("hubspot", "completed", `Synced ${recordsProcessed} records`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog("hubspot", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
