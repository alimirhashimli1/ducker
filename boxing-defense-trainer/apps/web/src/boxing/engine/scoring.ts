/**
 * Responsibility: turn an attack plus the user's detected defense into points,
 * and aggregate a finished session's events into a summary. It owns the scoring
 * rules and nothing else — it does not detect movement or drive the session.
 */
import type { Attack, ScoreEvent, SessionScore } from '../../types'
import type { DefenseDetection } from './defenseDetector'

/**
 * Score a single attack/defense exchange. A null detection means the user did
 * not move in time.
 *
 * TODO: compare detection.at against attack.landsAt using the TIMING windows
 * scaled by the difficulty's timingToleranceFactor, then award SCORING points.
 */
export function scoreAttack(attack: Attack, _detection: DefenseDetection | null): ScoreEvent {
  return {
    attackId: attack.id,
    outcome: 'missed',
    reactionMs: 0,
    points: 0,
  }
}

/**
 * Aggregate every exchange in a session into a final score.
 *
 * TODO: total the points, count outcomes and average reaction time over the
 * events that actually produced a detection.
 */
export function summariseSession(_events: readonly ScoreEvent[]): SessionScore {
  return {
    totalPoints: 0,
    cleanCount: 0,
    missedCount: 0,
    averageReactionMs: 0,
  }
}
