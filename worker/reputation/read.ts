import type { AchievementView } from "../../shared/ui/contracts";

export interface ReputationSummary {
  points: number;
  reputation: number;
  verifiedSources: number;
  achievements: AchievementView[];
}

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: number;
}

export function createReputationReader(db: D1Database) {
  return {
    async getSummary(userId: string): Promise<ReputationSummary> {
      const [balance, achievements] = await Promise.all([
        db
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) AS points,
                    COALESCE(SUM(CASE WHEN reward_type = 'VERIFIED_SOURCE' AND amount > 0 THEN 1 ELSE 0 END), 0) AS verified_sources
             FROM point_ledger WHERE user_id = ?`,
          )
          .bind(userId)
          .first<{ points: number; verified_sources: number }>(),
        db
          .prepare(
            `SELECT a.id, a.name, a.description, a.icon, ua.earned_at
             FROM user_achievements ua JOIN achievement_catalog a ON a.id = ua.achievement_id
             WHERE ua.user_id = ? ORDER BY ua.earned_at ASC`,
          )
          .bind(userId)
          .all<AchievementRow>(),
      ]);
      return {
        points: Number(balance?.points ?? 0),
        reputation: Number(balance?.points ?? 0),
        verifiedSources: Number(balance?.verified_sources ?? 0),
        achievements: achievements.results.map((achievement) => ({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          earnedAt: new Date(achievement.earned_at).toISOString(),
        })),
      };
    },
  };
}
