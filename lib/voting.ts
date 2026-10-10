import type {
  Member,
  Place,
  PlaceVoteItem,
  VoteDoc,
  VotingResults,
} from "./types";

/**
 * ตรวจสอบสิทธิ์ในการโหวต:
 * เฉพาะสมาชิกสถานะ 'going' หรือ 'maybe' เท่านั้น (สถานะ 'out' ไม่มีสิทธิ์)
 */
export function isMemberEligibleToVote(member: Member | undefined | null): boolean {
  if (!member) return false;
  return member.status === "going" || member.status === "maybe";
}

/**
 * คำนวณผลโหวตแบบ Pure Function:
 * - กรองเฉพาะผู้มีสิทธิ์โหวต (going, maybe)
 * - Stay: 1 โหวตต่อคน (สลับ/ถอนโหวตได้)
 * - Attraction: สูงสุด 3 โหวตต่อคน (สลับ/ถอนโหวตได้)
 * - รองรับกรณีคะแนนเสมอกัน (Tie-breaking) โดยไฮไลต์ทุกตัวที่ได้คะแนนสูงสุดร่วม
 * - ติดตามจำนวนคนที่มีส่วนร่วม (participation progress)
 */
export function calculateVotingResults(
  places: Place[],
  votes: VoteDoc[],
  members: Member[],
): VotingResults {
  // สมาชิกที่มีสิทธิ์โหวต
  const eligibleMembers = members.filter(isMemberEligibleToVote);
  const eligibleMap = new Map<string, Member>();
  eligibleMembers.forEach((m) => eligibleMap.set(m.id, m));

  const validPlaceIds = new Set(places.map((p) => p.id));

  // กรองเฉพาะคะแนนจาก eligible voters และอ้างอิงสถานที่ที่มีอยู่จริง
  const validVotes: VoteDoc[] = [];
  for (const v of votes) {
    if (!eligibleMap.has(v.id)) continue;
    // รองรับทั้ง stayIds (ใหม่) และ stayId (เดิม) เพื่อ backward compatibility
    const rawStayIds = v.stayIds ?? (v.stayId ? [v.stayId] : []);
    const stayIds = rawStayIds
      .filter((id) => validPlaceIds.has(id))
      .slice(0, 3);
    const attractionIds = (v.attractionIds || [])
      .filter((id) => validPlaceIds.has(id))
      .slice(0, 10);
    validVotes.push({
      id: v.id,
      stayId: stayIds[0] ?? null,
      stayIds,
      attractionIds,
      updatedAt: v.updatedAt || 0,
    });
  }

  // นับจำนวนคนที่มีส่วนร่วมในการโหวต
  const stayVoters = new Set<string>();
  const attractionVoters = new Set<string>();

  // Map รวบรวมคนโหวตต่อสถานที่: placeId -> list of { uid, name, emoji }
  const votersPerPlace = new Map<
    string,
    { uid: string; name: string; emoji: string }[]
  >();

  places.forEach((p) => votersPerPlace.set(p.id, []));

  for (const v of validVotes) {
    const member = eligibleMap.get(v.id)!;
    const voterInfo = {
      uid: v.id,
      name: member.name || "เพื่อนร่วมทริป",
      emoji: member.emoji || "👤",
    };

    const userStayIds = v.stayIds || [];
    if (userStayIds.length > 0) {
      stayVoters.add(v.id);
      for (const sId of userStayIds) {
        if (votersPerPlace.has(sId)) {
          votersPerPlace.get(sId)!.push(voterInfo);
        }
      }
    }

    if (v.attractionIds && v.attractionIds.length > 0) {
      attractionVoters.add(v.id);
      for (const attrId of v.attractionIds) {
        if (votersPerPlace.has(attrId)) {
          votersPerPlace.get(attrId)!.push(voterInfo);
        }
      }
    }
  }

  // แยกรายการ Stays และ Attractions
  const stayPlaces = places.filter((p) => p.category === "stay");
  const attractionPlaces = places.filter((p) => p.category === "attraction");

  // สร้าง PlaceVoteItem
  const mapVoteItem = (p: Place): PlaceVoteItem => {
    const voters = votersPerPlace.get(p.id) || [];
    return {
      place: p,
      votesCount: voters.length,
      voterUids: voters.map((v) => v.uid),
      voters,
      isLeading: false,
    };
  };

  const stays = stayPlaces.map(mapVoteItem);
  const attractions = attractionPlaces.map(mapVoteItem);

  // คำนวณผู้ชนะและตรวจสอบคะแนนเสมอสำหรับ Stays
  const maxStayVotes = stays.reduce((max, s) => Math.max(max, s.votesCount), 0);
  let leadingStays: Place[] = [];
  let isStayTie = false;

  if (maxStayVotes > 0) {
    const topStays = stays.filter((s) => s.votesCount === maxStayVotes);
    leadingStays = topStays.map((s) => s.place);
    topStays.forEach((s) => (s.isLeading = true));
    isStayTie = topStays.length > 1;
  }

  // จัดเรียง Stays: คะแนนมากสุดก่อน ตามด้วยเวลาที่เสนอ
  stays.sort((a, b) => b.votesCount - a.votesCount || a.place.createdAt - b.place.createdAt);

  // คำนวณผู้ชนะและตรวจสอบคะแนนเสมอสำหรับ Attractions
  const maxAttrVotes = attractions.reduce((max, a) => Math.max(max, a.votesCount), 0);
  let leadingAttractions: Place[] = [];
  let isAttractionTie = false;

  if (maxAttrVotes > 0) {
    const topAttrs = attractions.filter((a) => a.votesCount === maxAttrVotes);
    leadingAttractions = topAttrs.map((a) => a.place);
    topAttrs.forEach((a) => (a.isLeading = true));
    isAttractionTie = topAttrs.length > 1;
  }

  // จัดเรียง Attractions: คะแนนมากสุดก่อน ตามด้วยเวลาที่เสนอ
  attractions.sort((a, b) => b.votesCount - a.votesCount || a.place.createdAt - b.place.createdAt);

  return {
    eligibleVotersCount: eligibleMembers.length,
    stayVotersCount: stayVoters.size,
    attractionVotersCount: attractionVoters.size,
    stays,
    attractions,
    leadingStays,
    leadingAttractions,
    isStayTie,
    isAttractionTie,
  };
}
