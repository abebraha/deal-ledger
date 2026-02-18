import { storage } from "../storage";
import { log } from "../index";

async function getActiveRepConfig(): Promise<{ hubspotOwnerIds: string[]; repNames: string[]; ownerIdToRepName: Record<string, string> }> {
  const reps = await storage.getActiveSalesReps();
  const hubspotOwnerIds = reps.filter(r => r.hubspotOwnerId).map(r => r.hubspotOwnerId!);
  const repNames = reps.map(r => r.name.toLowerCase());
  const ownerIdToRepName: Record<string, string> = {};
  for (const rep of reps) {
    if (rep.hubspotOwnerId) {
      ownerIdToRepName[rep.hubspotOwnerId] = rep.name;
    }
  }
  return { hubspotOwnerIds, repNames, ownerIdToRepName };
}

function isRepOwnerByName(ownerName: string | null | undefined, repNames: string[]): boolean {
  if (!ownerName || repNames.length === 0) return false;
  const lower = ownerName.toLowerCase().trim();
  return repNames.some(rep => lower.includes(rep));
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

    const { hubspotOwnerIds: mappedOwnerIds, repNames, ownerIdToRepName } = await getActiveRepConfig();

    // Fetch pipeline stage labels so we can map stage IDs to readable names
    const stageMap: Record<string, string> = {};
    try {
      const pipelinesResponse = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (pipelinesResponse.ok) {
        const pipelinesData = await pipelinesResponse.json();
        for (const pipeline of pipelinesData.results || []) {
          for (const stage of pipeline.stages || []) {
            stageMap[stage.id] = stage.label;
          }
        }
      }
    } catch (e) {
      log(`Warning: Could not fetch pipeline stages: ${e}`, "hubspot");
    }

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
          if (!ownerId || !mappedOwnerIds.includes(ownerId)) {
            continue;
          }
        } else if (!isRepOwnerByName(ownerName, repNames)) {
          continue;
        }
        const resolvedOwner = (ownerId && ownerIdToRepName[ownerId]) ? ownerIdToRepName[ownerId] : ownerName;

        const rawStage = deal.properties.dealstage || "unknown";
        const stageLabel = stageMap[rawStage] || rawStage;

        await storage.upsertDeal({
          hubspotId: deal.id,
          name: deal.properties.dealname || "Untitled Deal",
          amount: parseFloat(deal.properties.amount) || 0,
          stage: stageLabel,
          owner: resolvedOwner || null,
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

    // Sync Engagements (activities) - paginate through all
    try {
      for (const engType of ["calls", "emails", "notes", "tasks"]) {
        let engHasMore = true;
        let engAfter: string | undefined;
        while (engHasMore) {
          const engUrl = `https://api.hubapi.com/crm/v3/objects/${engType}?limit=100&properties=hs_timestamp,hs_call_title,hs_email_subject,hs_note_body,hs_task_subject,hubspot_owner_id${engAfter ? `&after=${engAfter}` : ""}`;
          const engResponse = await fetch(engUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (engResponse.ok) {
            const engData = await engResponse.json();
            for (const eng of engData.results || []) {
              const engOwnerId = eng.properties.hubspot_owner_id || null;
              const ownerName = engOwnerId ? ownerMap[engOwnerId] : null;
              const resolvedEngOwner = (engOwnerId && ownerIdToRepName[engOwnerId]) ? ownerIdToRepName[engOwnerId] : ownerName;

              const subject = eng.properties.hs_call_title || eng.properties.hs_email_subject || eng.properties.hs_task_subject || engType;
              const body = eng.properties.hs_note_body || "";
              let activityType = engType.toUpperCase().replace(/S$/, "");
              if (activityType === "NOTE" && (body.toLowerCase().includes("linkedin") || subject.toLowerCase().includes("linkedin"))) {
                activityType = "LINKEDIN_MESSAGE";
              }
              await storage.upsertActivity({
                hubspotId: eng.id,
                type: activityType,
                subject: subject,
                body: body,
                owner: resolvedEngOwner || null,
                activityDate: eng.properties.hs_timestamp || eng.createdAt,
                hubspotUrl: `https://app.hubspot.com/contacts/activity/${eng.id}`,
              });
              recordsProcessed++;
            }
            if (engData.paging?.next?.after) {
              engAfter = engData.paging.next.after;
            } else {
              engHasMore = false;
            }
          } else {
            engHasMore = false;
          }
        }
      }
    } catch (e) {
      log(`Warning: Could not sync activities: ${e}`, "hubspot");
    }

    // Sync Communications (LinkedIn messages, SMS, WhatsApp) - paginate through all
    try {
      let commHasMore = true;
      let commAfter: string | undefined;
      while (commHasMore) {
        const commUrl = `https://api.hubapi.com/crm/v3/objects/communications?limit=100&properties=hs_communication_channel_type,hs_communication_body,hs_timestamp,hubspot_owner_id${commAfter ? `&after=${commAfter}` : ""}`;
        const commResponse = await fetch(commUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (commResponse.ok) {
          const commData = await commResponse.json();
          for (const comm of commData.results || []) {
            const channelType = (comm.properties.hs_communication_channel_type || "").toUpperCase();
            if (channelType !== "LINKEDIN") continue;

            const commOwnerId = comm.properties.hubspot_owner_id || null;
            if (mappedOwnerIds.length > 0 && (!commOwnerId || !mappedOwnerIds.includes(commOwnerId))) continue;
            const ownerName = commOwnerId ? ownerMap[commOwnerId] : null;
            const resolvedCommOwner = (commOwnerId && ownerIdToRepName[commOwnerId]) ? ownerIdToRepName[commOwnerId] : ownerName;
            if (!resolvedCommOwner) continue;

            await storage.upsertActivity({
              hubspotId: `comm_${comm.id}`,
              type: "LINKEDIN_MESSAGE",
              subject: "LinkedIn Message",
              body: comm.properties.hs_communication_body || "",
              owner: resolvedCommOwner || null,
              activityDate: comm.properties.hs_timestamp || comm.createdAt,
              hubspotUrl: `https://app.hubspot.com/contacts/communications/${comm.id}`,
            });
            recordsProcessed++;
          }
          if (commData.paging?.next?.after) {
            commAfter = commData.paging.next.after;
          } else {
            commHasMore = false;
          }
        } else {
          commHasMore = false;
        }
      }
    } catch (e) {
      log(`Warning: Could not sync communications: ${e}`, "hubspot");
    }

    // Sync Meetings - paginate through all
    try {
      let mtgHasMore = true;
      let mtgAfter: string | undefined;
      while (mtgHasMore) {
        const mtgUrl = `https://api.hubapi.com/crm/v3/objects/meetings?limit=100&properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hubspot_owner_id${mtgAfter ? `&after=${mtgAfter}` : ""}`;
        const meetingsResponse = await fetch(mtgUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (meetingsResponse.ok) {
          const meetingsData = await meetingsResponse.json();
          for (const mtg of meetingsData.results || []) {
            const mtgOwnerId = mtg.properties.hubspot_owner_id || null;
            const ownerName = mtgOwnerId ? ownerMap[mtgOwnerId] : null;
            const resolvedMtgOwner = (mtgOwnerId && ownerIdToRepName[mtgOwnerId]) ? ownerIdToRepName[mtgOwnerId] : ownerName;

            await storage.upsertMeeting({
              hubspotId: mtg.id,
              title: mtg.properties.hs_meeting_title || "Untitled Meeting",
              startTime: mtg.properties.hs_meeting_start_time || null,
              endTime: mtg.properties.hs_meeting_end_time || null,
              outcome: mtg.properties.hs_meeting_outcome || null,
              owner: resolvedMtgOwner || null,
              hubspotUrl: `https://app.hubspot.com/contacts/meetings/${mtg.id}`,
            });
            recordsProcessed++;
          }
          if (meetingsData.paging?.next?.after) {
            mtgAfter = meetingsData.paging.next.after;
          } else {
            mtgHasMore = false;
          }
        } else {
          mtgHasMore = false;
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
    const reps = await storage.getActiveSalesReps();
    const repNamesList = reps.map(r => r.name).join(", ") || "no reps configured";
    await storage.createSyncLog("hubspot", "completed", `Synced ${recordsProcessed} records (${repNamesList})`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog("hubspot", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
