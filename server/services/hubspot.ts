import { storage } from "../storage";
import { log } from "../index";

const DEFAULT_REP_PATTERNS = ["deborah", "deb", "dov", "dovi"];

async function getRepOwnerIds(): Promise<{ patterns: string[]; hubspotOwnerIds: string[] }> {
  const allSettings = await storage.getAllSettings();
  const hubspotOwnerIds: string[] = [];
  const patterns = [...DEFAULT_REP_PATTERNS];

  for (const [key, value] of Object.entries(allSettings)) {
    if (key.startsWith("rep_hubspot_owner_") && value) {
      hubspotOwnerIds.push(value);
    }
  }

  return { patterns, hubspotOwnerIds };
}

function isRepOwner(ownerName: string | null | undefined, ownerId?: string | null, mappedOwnerIds?: string[]): boolean {
  if (mappedOwnerIds && mappedOwnerIds.length > 0 && ownerId) {
    return mappedOwnerIds.includes(ownerId);
  }
  if (!ownerName) return false;
  const lower = ownerName.toLowerCase().trim();
  return DEFAULT_REP_PATTERNS.some(rep => lower.includes(rep));
}

export async function syncHubSpot(): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  let apiKey = process.env.HUBSPOT_API_KEY;
  try {
    const conn = await storage.getConnection("hubspot");
    if (conn?.config && typeof conn.config === "object" && (conn.config as any).apiKey) {
      apiKey = (conn.config as any).apiKey;
    }
  } catch (e) {}
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "HubSpot is not connected. Please add your API key on the Connections page." };
  }

  let recordsProcessed = 0;

  try {
    // Build owner map first so we can filter by rep
    const ownerMap: Record<string, string> = {};
    try {
      const ownersResponse = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (ownersResponse.ok) {
        const ownersData = await ownersResponse.json();
        for (const owner of ownersData.results || []) {
          ownerMap[owner.id] = `${owner.firstName || ""} ${owner.lastName || ""}`.trim();
        }
      }
    } catch (e) {
      log(`Warning: Could not sync owners: ${e}`, "hubspot");
    }

    const { hubspotOwnerIds: mappedOwnerIds } = await getRepOwnerIds();

    // Sync Deals - paginate through all
    let hasMore = true;
    let after: string | undefined;
    while (hasMore) {
      const url = `https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,hubspot_owner_id,hs_lastmodifieddate,pipeline${after ? `&after=${after}` : ""}`;
      const dealsResponse = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!dealsResponse.ok) {
        const errorText = await dealsResponse.text();
        throw new Error(`HubSpot Deals API error ${dealsResponse.status}: ${errorText}`);
      }

      const dealsData = await dealsResponse.json();
      for (const deal of dealsData.results || []) {
        const ownerId = deal.properties.hubspot_owner_id || null;
        const ownerName = ownerId ? ownerMap[ownerId] : null;

        if (mappedOwnerIds.length > 0) {
          if (!ownerId || !mappedOwnerIds.includes(ownerId)) continue;
        } else if (!isRepOwner(ownerName)) {
          continue;
        }

        await storage.upsertDeal({
          hubspotId: deal.id,
          name: deal.properties.dealname || "Untitled Deal",
          amount: parseFloat(deal.properties.amount) || 0,
          stage: deal.properties.dealstage || "unknown",
          owner: ownerName || null,
          closeDate: deal.properties.closedate || null,
          lastActivityDate: deal.properties.hs_lastmodifieddate || null,
          pipeline: deal.properties.pipeline || null,
          hubspotUrl: `https://app.hubspot.com/contacts/deals/${deal.id}`,
        });
        recordsProcessed++;
      }

      if (dealsData.paging?.next?.after) {
        after = dealsData.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    // Sync Engagements (activities) - only for reps
    try {
      for (const engType of ["calls", "emails", "notes", "tasks"]) {
        const engResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/${engType}?limit=50&properties=hs_timestamp,hs_call_title,hs_email_subject,hs_note_body,hs_task_subject,hubspot_owner_id`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (engResponse.ok) {
          const engData = await engResponse.json();
          for (const eng of engData.results || []) {
            const engOwnerId = eng.properties.hubspot_owner_id || null;
            const ownerName = engOwnerId ? ownerMap[engOwnerId] : null;
            if (mappedOwnerIds.length > 0) {
              if (!engOwnerId || !mappedOwnerIds.includes(engOwnerId)) continue;
            } else if (ownerName && !isRepOwner(ownerName)) {
              continue;
            }

            const subject = eng.properties.hs_call_title || eng.properties.hs_email_subject || eng.properties.hs_task_subject || engType;
            const body = eng.properties.hs_note_body || "";
            await storage.upsertActivity({
              hubspotId: eng.id,
              type: engType.toUpperCase().replace(/S$/, ""),
              subject: subject,
              body: body,
              owner: ownerName || null,
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

    // Sync Meetings - only for reps
    try {
      const meetingsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/meetings?limit=50&properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hubspot_owner_id", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json();
        for (const mtg of meetingsData.results || []) {
          const mtgOwnerId = mtg.properties.hubspot_owner_id || null;
          const ownerName = mtgOwnerId ? ownerMap[mtgOwnerId] : null;
          if (mappedOwnerIds.length > 0) {
            if (!mtgOwnerId || !mappedOwnerIds.includes(mtgOwnerId)) continue;
          } else if (ownerName && !isRepOwner(ownerName)) {
            continue;
          }

          await storage.upsertMeeting({
            hubspotId: mtg.id,
            title: mtg.properties.hs_meeting_title || "Untitled Meeting",
            startTime: mtg.properties.hs_meeting_start_time || null,
            endTime: mtg.properties.hs_meeting_end_time || null,
            outcome: mtg.properties.hs_meeting_outcome || null,
            owner: ownerName || null,
            hubspotUrl: `https://app.hubspot.com/contacts/meetings/${mtg.id}`,
          });
          recordsProcessed++;
        }
      }
    } catch (e) {
      log(`Warning: Could not sync meetings: ${e}`, "hubspot");
    }

    // Sync Revenue Goals from HubSpot
    try {
      const goalsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/goal_targets?limit=100&properties=hs_goal_name,hs_target_amount,hs_start_datetime,hs_end_datetime", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json();
        const goals = goalsData.results || [];
        const now = new Date();

        // Find the best current-period revenue goal
        let currentGoal: any = null;
        let fallbackGoal: any = null;

        for (const goal of goals) {
          const amount = parseFloat(goal.properties.hs_target_amount) || 0;
          if (amount <= 0) continue;

          const start = goal.properties.hs_start_datetime ? new Date(goal.properties.hs_start_datetime) : null;
          const end = goal.properties.hs_end_datetime ? new Date(goal.properties.hs_end_datetime) : null;

          if (start && end && now >= start && now <= end) {
            if (!currentGoal || amount > (parseFloat(currentGoal.properties.hs_target_amount) || 0)) {
              currentGoal = goal;
            }
          } else if (!fallbackGoal) {
            fallbackGoal = goal;
          }
        }

        const selectedGoal = currentGoal || fallbackGoal;
        if (selectedGoal) {
          const targetAmount = parseFloat(selectedGoal.properties.hs_target_amount) || 0;
          if (targetAmount > 0) {
            await storage.setSetting("hubspotRevenueGoal", String(targetAmount));
            log(`Synced revenue goal from HubSpot: $${targetAmount} (${selectedGoal.properties.hs_goal_name || "unnamed"})`, "hubspot");
          }
        }
      }
    } catch (e) {
      log(`Warning: Could not sync goals: ${e}`, "hubspot");
    }

    // Clean up any non-rep data that may exist from prior syncs
    try {
      const { cleanupNonRepData } = await import("../storage");
      await cleanupNonRepData();
    } catch (e) {
      log(`Warning: Could not clean up non-rep data: ${e}`, "hubspot");
    }

    const existingConn = await storage.getConnection("hubspot");
    await storage.upsertConnection("hubspot", true, existingConn?.config, true);
    await storage.createSyncLog("hubspot", "completed", `Synced ${recordsProcessed} records (Deb & Dovi only)`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog("hubspot", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
