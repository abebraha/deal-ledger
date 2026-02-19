import { storage } from "../storage";
import { log } from "../index";

const CLOSE_API_BASE = "https://api.close.com/api/v1";

async function closeApiFetch(apiKey: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${CLOSE_API_BASE}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Close API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getActiveRepConfig(accountId: number) {
  const reps = await storage.getActiveSalesReps(accountId);
  const closeUserIds = reps.filter(r => r.closeUserId).map(r => r.closeUserId!);
  const repNames = reps.map(r => r.name.toLowerCase());
  const userIdToRepName: Record<string, string> = {};
  for (const rep of reps) {
    if (rep.closeUserId) {
      userIdToRepName[rep.closeUserId] = rep.name;
    }
  }
  return { closeUserIds, repNames, userIdToRepName };
}

function isRepByName(userName: string | null | undefined, repNames: string[]): boolean {
  if (!userName || repNames.length === 0) return false;
  const lower = userName.toLowerCase().trim();
  return repNames.some(rep => lower.includes(rep));
}

export async function syncClose(accountId: number): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
  let apiKey: string | undefined;
  try {
    const conn = await storage.getConnection(accountId, "close");
    if (conn?.config && typeof conn.config === "object" && (conn.config as any).apiKey) {
      apiKey = (conn.config as any).apiKey;
    }
  } catch (e) {}
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "Close CRM is not connected. Please add your API key on the Connections page." };
  }

  let recordsProcessed = 0;

  try {
    const userMap: Record<string, string> = {};
    try {
      const usersData = await closeApiFetch(apiKey, "/user/");
      for (const user of usersData.data || []) {
        const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
        if (name) userMap[user.id] = name;
      }
    } catch (e) {
      log(`Warning: Could not fetch Close users: ${e}`, "close");
    }

    const { closeUserIds: mappedUserIds, repNames, userIdToRepName } = await getActiveRepConfig(accountId);

    const statusMap: Record<string, string> = {};
    try {
      const statusData = await closeApiFetch(apiKey, "/status/opportunity/");
      for (const s of statusData.data || []) {
        statusMap[s.id] = s.label;
      }
    } catch (e) {
      log(`Warning: Could not fetch Close opportunity statuses: ${e}`, "close");
    }

    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const oppsData = await closeApiFetch(apiKey, "/opportunity/", {
        _skip: String(skip),
        _limit: "100",
        _fields: "id,lead_id,user_id,status_id,status_type,status_label,value,value_period,confidence,note,date_created,date_updated,date_won,lead_name",
      });

      const opportunities = oppsData.data || [];
      for (const opp of opportunities) {
        const userId = opp.user_id || null;
        const userName = userId ? userMap[userId] : null;

        if (mappedUserIds.length > 0) {
          if (!userId || !mappedUserIds.includes(userId)) continue;
        } else if (!isRepByName(userName, repNames)) {
          continue;
        }

        const resolvedOwner = (userId && userIdToRepName[userId]) ? userIdToRepName[userId] : userName;
        const stageLabel = opp.status_label || statusMap[opp.status_id] || opp.status_type || "unknown";
        const amount = opp.value ? opp.value / 100 : 0;

        await storage.upsertDeal({
          accountId,
          closeId: opp.id,
          name: opp.lead_name ? `${opp.lead_name}` : "Untitled Opportunity",
          amount,
          stage: stageLabel,
          owner: resolvedOwner || null,
          closeDate: opp.date_won || null,
          lastActivityDate: opp.date_updated || null,
          probability: opp.confidence ? opp.confidence / 100 : null,
          closeUrl: `https://app.close.com/opportunities/${opp.id}/`,
        });
        recordsProcessed++;
      }

      if (opportunities.length < 100) {
        hasMore = false;
      } else {
        skip += 100;
      }
    }

    for (const actType of ["call", "email", "note"]) {
      try {
        let actHasMore = true;
        let actSkip = 0;
        while (actHasMore) {
          const actData = await closeApiFetch(apiKey, `/activity/${actType}/`, {
            _skip: String(actSkip),
            _limit: "100",
          });

          const acts = actData.data || [];
          for (const act of acts) {
            const actUserId = act.user_id || act.created_by || null;
            const actUserName = actUserId ? userMap[actUserId] : null;
            const resolvedActOwner = (actUserId && userIdToRepName[actUserId]) ? userIdToRepName[actUserId] : actUserName;

            let subject = "";
            let body = "";
            if (actType === "call") {
              subject = act.note ? act.note.substring(0, 100) : "Call";
              body = act.note || "";
            } else if (actType === "email") {
              subject = act.subject || "Email";
              body = act.body_text || act.body_html || "";
            } else if (actType === "note") {
              subject = act.note ? act.note.substring(0, 100) : "Note";
              body = act.note || "";
            }

            await storage.upsertActivity({
              accountId,
              closeId: act.id,
              type: actType.toUpperCase(),
              subject,
              body,
              owner: resolvedActOwner || null,
              activityDate: act.date_created || act.created_at || null,
              closeUrl: `https://app.close.com/activities/${act.id}/`,
            });
            recordsProcessed++;
          }

          if (acts.length < 100) {
            actHasMore = false;
          } else {
            actSkip += 100;
          }
        }
      } catch (e) {
        log(`Warning: Could not sync Close ${actType} activities: ${e}`, "close");
      }
    }

    try {
      let mtgHasMore = true;
      let mtgSkip = 0;
      while (mtgHasMore) {
        const mtgData = await closeApiFetch(apiKey, "/activity/meeting/", {
          _skip: String(mtgSkip),
          _limit: "100",
        });

        const mtgs = mtgData.data || [];
        for (const mtg of mtgs) {
          const mtgUserId = mtg.user_id || mtg.created_by || null;
          const mtgUserName = mtgUserId ? userMap[mtgUserId] : null;
          const resolvedMtgOwner = (mtgUserId && userIdToRepName[mtgUserId]) ? userIdToRepName[mtgUserId] : mtgUserName;

          await storage.upsertMeeting({
            accountId,
            closeId: mtg.id,
            title: mtg.title || mtg.note?.substring(0, 100) || "Meeting",
            startTime: mtg.starts_at || mtg.date_created || null,
            endTime: mtg.ends_at || null,
            outcome: mtg.status || null,
            owner: resolvedMtgOwner || null,
            attendees: (mtg.attendees || []).map((a: any) => a.name || a.email || "").filter(Boolean).join(", ") || null,
            closeUrl: `https://app.close.com/activities/${mtg.id}/`,
          });
          recordsProcessed++;
        }

        if (mtgs.length < 100) {
          mtgHasMore = false;
        } else {
          mtgSkip += 100;
        }
      }
    } catch (e) {
      log(`Warning: Could not sync Close meetings: ${e}`, "close");
    }

    const existingConn = await storage.getConnection(accountId, "close");
    await storage.upsertConnection(accountId, "close", true, existingConn?.config, true);
    const reps = await storage.getActiveSalesReps(accountId);
    const repNamesList = reps.map(r => r.name).join(", ") || "no reps configured";
    await storage.createSyncLog(accountId, "close", "completed", `Synced ${recordsProcessed} records (${repNamesList})`, recordsProcessed);

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errMsg = error.message || String(error);
    await storage.createSyncLog(accountId, "close", "error", errMsg, recordsProcessed);
    return { success: false, recordsProcessed, error: errMsg };
  }
}
