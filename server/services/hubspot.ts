import { storage } from "../storage";
import { log } from "../index";

async function getActiveRepConfig(accountId: number): Promise<{ hubspotOwnerIds: string[]; repNames: string[]; ownerIdToRepName: Record<string, string> }> {
  const reps = await storage.getActiveSalesReps(accountId);
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
  return repNames.some(rep => {
    if (lower === rep) return true;
    const ownerParts = lower.split(/\s+/);
    const repParts = rep.split(/\s+/);
    if (ownerParts.length >= 2 && repParts.length >= 2) {
      return ownerParts[0] === repParts[0] && ownerParts[ownerParts.length - 1] === repParts[repParts.length - 1];
    }
    if (repParts.length === 1 && ownerParts.length >= 2) {
      return ownerParts[0] === repParts[0] || ownerParts[ownerParts.length - 1] === repParts[0];
    }
    return false;
  });
}

async function fetchContactInfo(contactId: string, apiKey: string, contactCache: Record<string, { name: string; company: string | null }>): Promise<{ name: string; company: string | null }> {
  if (contactCache[contactId]) return contactCache[contactId];
  try {
    const resp = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,company`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      const first = data.properties?.firstname || "";
      const last = data.properties?.lastname || "";
      const name = `${first} ${last}`.trim() || "Unknown Contact";
      const company = data.properties?.company || null;
      contactCache[contactId] = { name, company };
      return { name, company };
    }
  } catch (e) {}
  return { name: "Unknown Contact", company: null };
}

export async function syncHubSpot(accountId: number): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  let apiKey: string | undefined;
  try {
    const conn = await storage.getConnection(accountId, "hubspot");
    if (conn?.config && typeof conn.config === "object" && (conn.config as any).apiKey) {
      apiKey = (conn.config as any).apiKey;
    }
  } catch (e) {}
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "HubSpot is not connected. Please add your API key on the Connections page." };
  }

  let recordsProcessed = 0;

  try {
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

    const { hubspotOwnerIds: mappedOwnerIds, repNames, ownerIdToRepName } = await getActiveRepConfig(accountId);

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

    const companyNameCache: Record<string, string> = {};
    const contactCache: Record<string, { name: string; company: string | null }> = {};

    // ─── Sync Deals ───
    let hasMore = true;
    let after: string | undefined;
    while (hasMore) {
      const url = `https://api.hubapi.com/crm/v3/objects/deals?limit=100&associations=companies,contacts&properties=dealname,amount,dealstage,closedate,hubspot_owner_id,hs_lastmodifieddate,pipeline,hs_deal_stage_probability,createdate,description,notes_last_updated,num_associated_contacts${after ? `&after=${after}` : ""}`;
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

        let companyName: string | null = null;
        const companyAssociations = deal.associations?.companies?.results;
        if (companyAssociations && companyAssociations.length > 0) {
          const companyId = companyAssociations[0].id;
          if (companyNameCache[companyId]) {
            companyName = companyNameCache[companyId];
          } else {
            try {
              const companyResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=name`, {
                headers: { Authorization: `Bearer ${apiKey}` },
              });
              if (companyResponse.ok) {
                const companyData = await companyResponse.json();
                companyName = companyData.properties?.name || null;
                if (companyName) companyNameCache[companyId] = companyName;
              }
            } catch (e) {
            }
          }
        }

        const probability = parseFloat(deal.properties.hs_deal_stage_probability) || 0;

        await storage.upsertDeal({
          accountId,
          hubspotId: deal.id,
          name: deal.properties.dealname || "Untitled Deal",
          amount: parseFloat(deal.properties.amount) || 0,
          stage: stageLabel,
          owner: resolvedOwner || null,
          closeDate: deal.properties.closedate || null,
          lastActivityDate: deal.properties.hs_lastmodifieddate || null,
          probability,
          companyName,
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

    // ─── Sync Activities (calls, emails, notes, tasks) with contact associations ───
    try {
      for (const engType of ["calls", "emails", "notes", "tasks"]) {
        let engHasMore = true;
        let engAfter: string | undefined;
        while (engHasMore) {
          const engUrl = `https://api.hubapi.com/crm/v3/objects/${engType}?limit=100&associations=contacts&properties=hs_timestamp,hs_call_title,hs_email_subject,hs_note_body,hs_task_subject,hubspot_owner_id,hs_body_preview${engAfter ? `&after=${engAfter}` : ""}`;
          const engResponse = await fetch(engUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (engResponse.ok) {
            const engData = await engResponse.json();
            for (const eng of engData.results || []) {
              const engOwnerId = eng.properties.hubspot_owner_id || null;
              const ownerName = engOwnerId ? ownerMap[engOwnerId] : null;

              if (mappedOwnerIds.length > 0) {
                if (!engOwnerId || !mappedOwnerIds.includes(engOwnerId)) continue;
              } else if (!isRepOwnerByName(ownerName, repNames)) {
                continue;
              }

              const resolvedEngOwner = (engOwnerId && ownerIdToRepName[engOwnerId]) ? ownerIdToRepName[engOwnerId] : ownerName;

              const subject = eng.properties.hs_call_title || eng.properties.hs_email_subject || eng.properties.hs_task_subject || engType;
              const body = eng.properties.hs_note_body || eng.properties.hs_body_preview || "";
              const activityType = engType.toUpperCase().replace(/S$/, "");

              let contactName: string | null = null;
              let contactCompany: string | null = null;
              const contactAssocs = eng.associations?.contacts?.results;
              if (contactAssocs && contactAssocs.length > 0) {
                const info = await fetchContactInfo(contactAssocs[0].id, apiKey, contactCache);
                contactName = info.name;
                contactCompany = info.company;
              }

              await storage.upsertActivity({
                accountId,
                hubspotId: eng.id,
                type: activityType,
                subject: subject,
                body: body,
                owner: resolvedEngOwner || null,
                contactName,
                companyName: contactCompany,
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

    // ─── Sync LinkedIn Messages ───
    try {
      let commHasMore = true;
      let commAfter: string | undefined;
      while (commHasMore) {
        const commUrl = `https://api.hubapi.com/crm/v3/objects/communications?limit=100&associations=contacts&properties=hs_communication_channel_type,hs_communication_body,hs_timestamp,hubspot_owner_id${commAfter ? `&after=${commAfter}` : ""}`;
        const commResponse = await fetch(commUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (commResponse.ok) {
          const commData = await commResponse.json();
          for (const comm of commData.results || []) {
            const channelType = (comm.properties.hs_communication_channel_type || "").toUpperCase();
            if (channelType !== "LINKEDIN_MESSAGE") continue;

            const commOwnerId = comm.properties.hubspot_owner_id || null;
            if (mappedOwnerIds.length > 0 && (!commOwnerId || !mappedOwnerIds.includes(commOwnerId))) continue;
            const ownerName = commOwnerId ? ownerMap[commOwnerId] : null;
            const resolvedCommOwner = (commOwnerId && ownerIdToRepName[commOwnerId]) ? ownerIdToRepName[commOwnerId] : ownerName;

            let contactName: string | null = null;
            let contactCompany: string | null = null;
            const contactAssocs = comm.associations?.contacts?.results;
            if (contactAssocs && contactAssocs.length > 0) {
              const info = await fetchContactInfo(contactAssocs[0].id, apiKey, contactCache);
              contactName = info.name;
              contactCompany = info.company;
            }

            await storage.upsertActivity({
              accountId,
              hubspotId: `comm_${comm.id}`,
              type: "LINKEDIN_MESSAGE",
              subject: contactName ? `LinkedIn Message to ${contactName}` : "LinkedIn Message",
              body: comm.properties.hs_communication_body || "",
              owner: resolvedCommOwner || null,
              contactName,
              companyName: contactCompany,
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

    // ─── Sync Meetings with contact/company associations ───
    try {
      let mtgHasMore = true;
      let mtgAfter: string | undefined;
      while (mtgHasMore) {
        const mtgUrl = `https://api.hubapi.com/crm/v3/objects/meetings?limit=100&associations=contacts,companies&properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hubspot_owner_id,hs_internal_meeting_notes,hs_meeting_body${mtgAfter ? `&after=${mtgAfter}` : ""}`;
        const meetingsResponse = await fetch(mtgUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (meetingsResponse.ok) {
          const meetingsData = await meetingsResponse.json();
          for (const mtg of meetingsData.results || []) {
            const mtgOwnerId = mtg.properties.hubspot_owner_id || null;
            const ownerName = mtgOwnerId ? ownerMap[mtgOwnerId] : null;

            if (mappedOwnerIds.length > 0) {
              if (!mtgOwnerId || !mappedOwnerIds.includes(mtgOwnerId)) continue;
            } else if (!isRepOwnerByName(ownerName, repNames)) {
              continue;
            }

            const resolvedMtgOwner = (mtgOwnerId && ownerIdToRepName[mtgOwnerId]) ? ownerIdToRepName[mtgOwnerId] : ownerName;

            // Fetch associated contacts for meeting attendees
            const attendeeNames: string[] = [];
            let meetingContactName: string | null = null;
            let meetingCompanyName: string | null = null;

            const contactAssocs = mtg.associations?.contacts?.results;
            if (contactAssocs && contactAssocs.length > 0) {
              for (const ca of contactAssocs.slice(0, 10)) {
                const info = await fetchContactInfo(ca.id, apiKey, contactCache);
                attendeeNames.push(info.name + (info.company ? ` (${info.company})` : ""));
                if (!meetingContactName) meetingContactName = info.name;
                if (!meetingCompanyName && info.company) meetingCompanyName = info.company;
              }
            }

            // Also check company associations directly
            if (!meetingCompanyName) {
              const companyAssocs = mtg.associations?.companies?.results;
              if (companyAssocs && companyAssocs.length > 0) {
                const companyId = companyAssocs[0].id;
                if (companyNameCache[companyId]) {
                  meetingCompanyName = companyNameCache[companyId];
                } else {
                  try {
                    const compResp = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=name`, {
                      headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    if (compResp.ok) {
                      const compData = await compResp.json();
                      meetingCompanyName = compData.properties?.name || null;
                      if (meetingCompanyName) companyNameCache[companyId] = meetingCompanyName;
                    }
                  } catch (e) {}
                }
              }
            }

            await storage.upsertMeeting({
              accountId,
              hubspotId: mtg.id,
              title: mtg.properties.hs_meeting_title || "Untitled Meeting",
              startTime: mtg.properties.hs_meeting_start_time || null,
              endTime: mtg.properties.hs_meeting_end_time || null,
              outcome: mtg.properties.hs_meeting_outcome || null,
              owner: resolvedMtgOwner || null,
              attendees: attendeeNames.length > 0 ? attendeeNames.join(", ") : null,
              contactName: meetingContactName,
              companyName: meetingCompanyName,
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

    // ─── Sync Revenue Goals ───
    try {
      const goalsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/goal_targets?limit=100&properties=hs_goal_name,hs_target_amount,hs_start_datetime,hs_end_datetime", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json();
        const goals = goalsData.results || [];
        const now = new Date();

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
            await storage.setSetting(accountId, "hubspotRevenueGoal", String(targetAmount));
            log(`Synced revenue goal from HubSpot: $${targetAmount} (${selectedGoal.properties.hs_goal_name || "unnamed"})`, "hubspot");
          }
        }
      }
    } catch (e) {
      log(`Warning: Could not sync goals: ${e}`, "hubspot");
    }

    try {
      const { cleanupNonRepData } = await import("../storage");
      await cleanupNonRepData(accountId);
    } catch (e) {
      log(`Warning: Could not clean up non-rep data: ${e}`, "hubspot");
    }

    const existingConn = await storage.getConnection(accountId, "hubspot");
    await storage.upsertConnection(accountId, "hubspot", true, existingConn?.config, true);
    const reps = await storage.getActiveSalesReps(accountId);
    const repNamesList = reps.map(r => r.name).join(", ") || "no reps configured";
    await storage.createSyncLog(accountId, "hubspot", "completed", `Synced ${recordsProcessed} records (${repNamesList})`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog(accountId, "hubspot", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
