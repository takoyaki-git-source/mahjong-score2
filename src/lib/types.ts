export type PlayerStats = {
  player_id: number
  name: string
  games: number
  total_score: number
  avg_score: number
  max_score: number
  min_score: number
  avg_rank: number
  first_count: number
  second_count: number
  third_count: number
  fourth_count: number
  first_rate: number
  second_rate: number
  third_rate: number
  fourth_rate: number
  rentai_rate: number
  tobi_count: number
  tobi_rate: number
  play_days: number
  best_day: number | null
  worst_day: number | null
  plus_days: number
  minus_days: number
  plus_rate: number | null
  minus_rate: number | null
  max_top_streak: number
  max_last_streak: number
  max_no_top_streak: number
  max_no_last_streak: number
  last_played: string
  // 常に全期間・全対局で逐次計算される天鳳風レーティング(期間/直近N半荘フィルタの影響を受けない)。
  // Leaderboardコンポーネント側でplayer_current_ratingsの結果をマージして埋める。
  rating?: number | null
}

export type PlayerRating = {
  player_id: number
  name: string
  rating: number
  games: number
}

export type PlayerRatingHistoryPoint = {
  player_id: number
  name: string
  game_id: string
  played_at: string
  rank: number
  games_before: number
  rating_before: number
  table_avg_rating: number
  delta: number
  rating_after: number
}

export type MatchupStats = {
  player_a: number
  name_a: string
  player_b: number
  name_b: string
  games: number
  avg_rank_a: number
  avg_rank_b: number
  avg_rank_diff: number
  top_rate_a: number
  last_rate_a: number
}
