/**
 * Constantes do jogo transcritas de docs/GAME_RULES.md (wiki oficial, versão de 09/11/2026).
 * Só entra aqui o que a wiki diz. Qualquer valor ausente é desconhecido e não deve ser estimado
 * (ver GAME_RULES.md §13 e docs/OPEN_QUESTIONS.md). Ao atualizar, mude também
 * `GAME_RULES_SOURCE_DATE`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

/**
 * Data da versão da wiki usada para todas as constantes deste arquivo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const GAME_RULES_SOURCE_DATE = '2026-11-09';

/**
 * Regras de sessão e conta (GAME_RULES.md §1).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const SESSION_RULES = {
  /** Segundos que o servidor segura a sessão após fechar a aba ou cair a internet. */
  sessionHoldSeconds: 90,
  /** Espera entre uma entrada de área e outra. */
  areaSwitchCooldownSeconds: 10,
  /** Segundos sem trocar dano para sair da hunt pelo botão. */
  leaveHuntCalmSeconds: 3,
  /** Um pokemon só entra em campo até este número de níveis acima do treinador (inicial é exceção). */
  maxPokemonLevelsAboveTrainer: 5,
} as const;

/**
 * Região do mapa com o nível mínimo do treinador e o trio de bosses (GAME_RULES.md §2).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface RegionRule {
  readonly name: string;
  readonly minTrainerLevel: number;
  /** Bosses da região; vazio quando a região não tem boss (Outland). */
  readonly bosses: readonly string[];
  /** Nível fixo dos bosses; `null` quando não há boss. */
  readonly bossLevel: number | null;
}

/**
 * Regiões em ordem de desbloqueio (GAME_RULES.md §2).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const REGIONS: readonly RegionRule[] = [
  { name: 'Kanto', minTrainerLevel: 1, bosses: ['Articuno', 'Moltres', 'Zapdos'], bossLevel: 300 },
  { name: 'Outland', minTrainerLevel: 150, bosses: [], bossLevel: null },
  { name: 'Johto', minTrainerLevel: 200, bosses: ['Suicune', 'Entei', 'Raikou'], bossLevel: 650 },
  {
    name: 'Hoenn',
    minTrainerLevel: 500,
    bosses: ['Groudon', 'Kyogre', 'Rayquaza'],
    bossLevel: 3_100,
  },
  {
    name: 'Sinnoh',
    minTrainerLevel: 1_000,
    bosses: ['Dialga', 'Palkia', 'Giratina'],
    bossLevel: 9_750,
  },
  {
    name: 'Unova',
    minTrainerLevel: 5_000,
    bosses: ['Reshiram', 'Zekrom', 'Kyurem'],
    bossLevel: 22_700,
  },
  {
    name: 'Kalos',
    minTrainerLevel: 10_000,
    bosses: ['Xerneas', 'Yveltal', 'Zygarde'],
    bossLevel: 44_050,
  },
  {
    name: 'Alola',
    minTrainerLevel: 25_000,
    bosses: ['Solgaleo', 'Lunala', 'Necrozma'],
    bossLevel: 75_900,
  },
  {
    name: 'Galar',
    minTrainerLevel: 40_000,
    bosses: ['Zacian Crowned', 'Zamazenta Crowned', 'Eternatus'],
    bossLevel: 120_350,
  },
  {
    name: 'Paldea',
    minTrainerLevel: 75_000,
    bosses: ['Okidogi', 'Munkidori', 'Fezandipiti'],
    bossLevel: 179_500,
  },
];

/**
 * Níveis de hunt conhecidos por região (GAME_RULES.md §3). Lista **parcial**: Kanto e Hoenn não
 * têm níveis listados e os nomes das hunts não constam na wiki.
 * TODO(game-data): completar com o Mapa em modo Lista (OPEN_QUESTIONS.md #5).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const KNOWN_HUNT_LEVELS: Readonly<Record<string, readonly number[]>> = {
  Johto: [200, 230, 260, 290, 320, 350, 380, 410, 440, 470],
  Sinnoh: [1_000],
  Unova: [5_000, 5_400, 5_900, 6_400, 6_950, 8_000, 8_600],
  Kalos: [10_000, 11_250, 12_750, 14_350, 16_000, 20_000, 21_200],
  Alola: [25_000, 26_150, 27_500, 28_950, 30_450, 35_150],
  Galar: [40_000, 42_800, 46_150, 49_650, 53_350, 64_950],
  Paldea: [75_000, 84_650, 95_950, 108_000, 120_550, 160_300],
};

/**
 * Uma das 8 Outlands: nível mínimo do treinador e multiplicador dos raros (GAME_RULES.md §4).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface OutlandRule {
  readonly index: number;
  readonly minTrainerLevel: number;
  readonly rareMultiplier: number;
}

/**
 * As 8 Outlands (GAME_RULES.md §4). O multiplicador vale **depois** do Loot Boost.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const OUTLANDS: readonly OutlandRule[] = [
  { index: 1, minTrainerLevel: 150, rareMultiplier: 1 },
  { index: 2, minTrainerLevel: 1_000, rareMultiplier: 1.25 },
  { index: 3, minTrainerLevel: 2_000, rareMultiplier: 1.5 },
  { index: 4, minTrainerLevel: 4_000, rareMultiplier: 2 },
  { index: 5, minTrainerLevel: 8_000, rareMultiplier: 3 },
  { index: 6, minTrainerLevel: 16_000, rareMultiplier: 4 },
  { index: 7, minTrainerLevel: 24_000, rareMultiplier: 6 },
  { index: 8, minTrainerLevel: 36_000, rareMultiplier: 8 },
];

/**
 * Raros da Outland e chance base por abate na Outland 1, como fração (GAME_RULES.md §4).
 * 0,0500% = 0.0005; 0,000500% = 0.000005.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const OUTLAND_RARE_BASE_CHANCE = {
  bronzeBossToken: 0.0005,
  keyFragment: 0.000005,
  shinyStoneFragment: 0.000005,
  bicycleFragment: 0.000005,
} as const;

/**
 * Tipo de raro da Outland.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type OutlandRare = keyof typeof OUTLAND_RARE_BASE_CHANCE;

/**
 * Regras de captura (GAME_RULES.md §5).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const CAPTURE_RULES = {
  baseChance: 0.0075,
  minChance: 0.003,
  maxChance: 0.1,
  /** Fator por estágio evolutivo. */
  stageFactor: { firstOfThree: 2.87, middleOrFirstOfTwo: 3.57, lastOrNoEvolution: 4.47 },
  /** Eficiência da bola. */
  ballEfficiency: { poke: 1, great: 2, super: 3, ultra: 4, beast: 8 },
  /** Capture Boost dobra a chance, respeitando o teto. */
  captureBoostMultiplier: 2,
  /** Segundos que o corpo fica no chão (uma tentativa por corpo). */
  bodyLifetimeSeconds: 30,
  /** Intervalo entre arremessos das automações VIP de lançamento. */
  vipThrowIntervalSeconds: 1.2,
} as const;

/**
 * Regras de shiny (GAME_RULES.md §5). A chance é por tentativa de captura.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const SHINY_RULES = {
  /** 1 em 24.000 por tentativa. */
  baseOddsDenominator: 24_000,
  /** Shiny Secret Lure dobra a chance (1 em 12.000). */
  secretLureMultiplier: 2,
  /** Bônus de Twitch, Kick e Safari: +15% cada, multiplicando. */
  streamOrSafariBonusMultiplier: 1.15,
  /** Na Outland o shiny não rola (GAME_RULES.md §4). */
  rollsInOutland: false,
} as const;

/**
 * Multiplicadores de XP (GAME_RULES.md §7). Boosts se multiplicam entre si.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const XP_BOOSTS = {
  xpBoostTrainer: 1.5,
  xpBoostPokemon: 1.5,
  vip: 1.5,
  guild: 1.1,
  twitchOrKickPerClaimedHour: 1.15,
  sacrifice: 1.2,
  latecomers: 10,
  /** Faixa do bônus por ranking da guild (+1% a +10%). */
  guildRankingMin: 1.01,
  guildRankingMax: 1.1,
  /** Fração do XP do nível atual perdida ao desmaiar (não vale com Atrasados). */
  faintPenaltyFraction: 0.1,
} as const;

/**
 * Multiplicador de stats por potência P1..P5 (GAME_RULES.md §6).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const POWER_STAT_MULTIPLIER: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = {
  1: 1,
  2: 1.05,
  3: 1.1,
  4: 1.25,
  5: 2,
};

/**
 * Loot Boost (GAME_RULES.md §8). Não vale contra boss (§4).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const LOOT_BOOST_MULTIPLIER = 1.4;

/**
 * Exemplos publicados de ouro por abate, sem Loot Boost (GAME_RULES.md §8). São **pontos de
 * referência**, não uma curva: não interpolar.
 * TODO(game-data): fórmula da curva de ouro (OPEN_QUESTIONS.md #14).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const GOLD_PER_KILL_EXAMPLES: readonly { trainerLevel: number; gold: number }[] = [
  { trainerLevel: 1, gold: 41 },
  { trainerLevel: 100, gold: 658 },
  { trainerLevel: 1_000, gold: 2_624 },
  { trainerLevel: 5_000, gold: 6_900 },
  { trainerLevel: 25_000, gold: 18_142 },
  { trainerLevel: 160_300, gold: 31_681 },
];

/**
 * Automações (GAME_RULES.md §9): Revive, Poções e Voltar à hunt já vêm ligadas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const AUTOMATION_RULES = {
  potionThresholdMinPct: 10,
  potionThresholdMaxPct: 100,
  potionThresholdDefaultPct: 30,
} as const;

/**
 * Passe de Batalha (GAME_RULES.md §11): 30 dias por ciclo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const BATTLE_PASS_CYCLE_DAYS = 30;

/**
 * Fuso de referência do calendário do jogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const GAME_TIME_ZONE = 'America/Sao_Paulo';
