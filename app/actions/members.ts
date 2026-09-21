"use server";

import { getOptionalAuthAndProfile } from "@/lib/auth/current";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cleanSearch(value: string, maxLength = 100) { return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength); }
export type PublicMember = { id: string; user_id: string; display_name: string; username: string | null; avatar_url: string | null; bio: string | null; favorite_verse: string | null; church_name: string | null; created_at: string };
export type MemberActivity = { id: string; kind: "post" | "comment" | "testimony" | "group" | "study_room"; title: string; body: string; href: string; created_at: string; updated_at: string };

export async function getMembers(q = "", page = 1) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id,user_id,display_name,username,avatar_url,bio,favorite_verse,church_name,created_at").not("user_id", "is", null).order("display_name");
  if (error) throw new Error(error.message);
  const needle = cleanSearch(q).toLowerCase();
  const all = ((data || []) as unknown as PublicMember[]).filter((member) => !needle || `${member.display_name} ${member.username || ""}`.toLowerCase().includes(needle));
  const current = Math.max(1, page);
  return { members: all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), total: all.length, page: current, pageCount: Math.max(1, Math.ceil(all.length / PAGE_SIZE)) };
}

export async function getMember(id: string): Promise<PublicMember | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const admin = createAdminClient();
  const fields = "id,user_id,display_name,username,avatar_url,bio,favorite_verse,church_name,created_at";
  const byProfile = await admin.from("profiles").select(fields).eq("id", id).maybeSingle();
  if (byProfile.error) return null;
  if (byProfile.data) return byProfile.data as unknown as PublicMember;
  const byUser = await admin.from("profiles").select(fields).eq("user_id", id).maybeSingle();
  return byUser.error ? null : byUser.data as unknown as PublicMember | null;
}

export async function getMemberActivity(memberUserId: string, tab: string, area: string, q: string, sort: string, page: number) {
  if (!UUID_PATTERN.test(memberUserId)) return { items: [], total: 0, page: 1, pageCount: 1 };
  const admin = createAdminClient();
  const auth = await getOptionalAuthAndProfile();
  const items: MemberActivity[] = [];
  const wantsPosts = tab !== "replies";
  const wantsReplies = tab === "replies";
  const include = (kind: MemberActivity["kind"]) => area === "all" || area === kind;
  if (wantsPosts && include("post")) {
    const { data } = await admin.from("community_posts").select("id,title,body,created_at,updated_at").eq("author_id", memberUserId).eq("is_published", true).is("deleted_at", null);
    for (const row of data || []) items.push({ id: row.id, kind: "post", title: row.title || "Community post", body: row.body || "", href: `/community/posts/${row.id}`, created_at: row.created_at, updated_at: row.updated_at });
  }
  if (wantsPosts && include("testimony")) {
    const { data } = await admin.from("community_testimonies").select("id,title,what_i_went_through,created_at,updated_at").eq("author_id", memberUserId).eq("is_published", true).is("deleted_at", null);
    for (const row of data || []) items.push({ id: row.id, kind: "testimony", title: row.title, body: row.what_i_went_through, href: `/community/testimonies/${row.id}`, created_at: row.created_at, updated_at: row.updated_at });
  }
  if (wantsReplies && include("comment")) {
    const { data } = await admin.from("community_post_comments").select("id,post_id,body,created_at,updated_at,community_posts!inner(is_published,deleted_at)").eq("author_id", memberUserId).is("deleted_at", null).eq("community_posts.is_published", true).is("community_posts.deleted_at", null);
    for (const row of data || []) items.push({ id: row.id, kind: "comment", title: "Community reply", body: row.body, href: `/community/posts/${row.post_id}`, created_at: row.created_at, updated_at: row.updated_at });
  }
  if (auth && (include("group") || include("study_room"))) {
    const [{ data: groupMemberships }, { data: roomMemberships }] = await Promise.all([
      admin.from("group_memberships").select("group_id").eq("profile_id", auth.profile.id),
      admin.from("study_room_members").select("room_id").eq("profile_id", auth.profile.id),
    ]);
    const groupIds = (groupMemberships || []).map((row) => row.group_id);
    const roomIds = (roomMemberships || []).map((row) => row.room_id);
    if (include("group") && groupIds.length) {
      const table = wantsPosts ? "discussion_threads" : "discussion_replies";
      const select = wantsPosts ? "id,group_id,title,body,created_at,updated_at" : "id,body,created_at,updated_at,discussion_threads!inner(id,group_id,title)";
      let privateQuery = admin.from(table).select(select).eq("author_id", memberUserId).is("deleted_at", null);
      privateQuery = wantsPosts ? privateQuery.eq("scope_type", "group").in("group_id", groupIds) : privateQuery.in("discussion_threads.group_id", groupIds);
      const { data } = await privateQuery;
      for (const raw of data || []) {
        const row = raw as unknown as Record<string, unknown>; const thread = row.discussion_threads as Record<string, unknown> | undefined; const groupId = String(row.group_id || thread?.group_id || "");
        if (groupIds.includes(groupId)) items.push({ id: String(row.id), kind: "group", title: String(row.title || thread?.title || "Group reply"), body: String(row.body || ""), href: `/groups/${groupId}/discussions/${thread?.id || row.id}`, created_at: String(row.created_at), updated_at: String(row.updated_at) });
      }
    }
    if (include("study_room") && roomIds.length) {
      const table = wantsPosts ? "study_room_discussion_threads" : "study_room_discussion_replies";
      const select = wantsPosts ? "id,room_id,title,body,created_at,updated_at" : "id,body,created_at,updated_at,study_room_discussion_threads!inner(id,room_id,title)";
      let privateQuery = admin.from(table).select(select).eq("author_user_id", memberUserId).is("deleted_at", null);
      privateQuery = wantsPosts ? privateQuery.in("room_id", roomIds) : privateQuery.in("study_room_discussion_threads.room_id", roomIds);
      const { data } = await privateQuery;
      for (const raw of data || []) {
        const row = raw as unknown as Record<string, unknown>; const thread = row.study_room_discussion_threads as Record<string, unknown> | undefined; const roomId = String(row.room_id || thread?.room_id || "");
        if (roomIds.includes(roomId)) items.push({ id: String(row.id), kind: "study_room", title: String(row.title || thread?.title || "Study Room reply"), body: String(row.body || ""), href: `/study-rooms/${roomId}?section=discussion#thread-${thread?.id || row.id}`, created_at: String(row.created_at), updated_at: String(row.updated_at) });
      }
    }
  }
  const needle = cleanSearch(q).toLowerCase();
  const filtered = items.filter((item) => !needle || `${item.title} ${item.body}`.toLowerCase().includes(needle)).sort((a, b) => (sort === "oldest" ? 1 : -1) * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  const current = Math.max(1, page); const size = 10;
  return { items: filtered.slice((current - 1) * size, current * size), total: filtered.length, page: current, pageCount: Math.max(1, Math.ceil(filtered.length / size)) };
}
