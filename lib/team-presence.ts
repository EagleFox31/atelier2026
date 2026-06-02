/** Fenêtre pendant laquelle une dernière connexion compte comme « en ligne ». */
export const TEAM_ONLINE_WINDOW_MS = 30 * 60 * 1000;

export interface TeamPresenceMember {
  id: string;
  status: string;
  lastLoginAt?: string | null;
}

/** Membre considéré en ligne : session courante ou connexion récente. */
export function isTeamMemberOnlineNow(
  member: TeamPresenceMember,
  currentUserId?: string | null,
  now = Date.now(),
): boolean {
  if (member.status !== 'ACTIVE') return false;
  if (currentUserId && member.id === currentUserId) return true;
  if (!member.lastLoginAt) return false;
  return now - new Date(member.lastLoginAt).getTime() < TEAM_ONLINE_WINDOW_MS;
}

export function countTeamMembersOnlineNow(
  members: TeamPresenceMember[],
  currentUserId?: string | null,
): number {
  return members.filter((m) => isTeamMemberOnlineNow(m, currentUserId)).length;
}
