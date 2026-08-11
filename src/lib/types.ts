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

export type PlayerYakumanStats = {
  player_id: number
  name: string
  yakuman_count: number
  games: number
  yakuman_rate: number
}
