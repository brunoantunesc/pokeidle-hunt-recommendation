// Os stats do pokémon do jogador a partir do nascimento — a fórmula da Pokepédia (capítulo
// Stats), com as tabelas do próprio jogo (`shared/nota-pokemon.mjs`):
//
//   stat = arred( (base + refino + 2×IV) × nível/100 × qualidade^expoente × potência × (shiny ? 3 : 1) × (lendário ? 4 : 1) )
//
// Conferida contra uma ficha real (Mega Charizard Y Nv 614, P3, Q 1,8): bate nos seis stats.
// A extensão /hunt não precisa disto porque lê os stats prontos do jogo; o site só sabe o que o
// jogador digita.

export const STATS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];
export const BASE_DE = { hp: 'baseHp', atk: 'baseAtk', def: 'baseDef', spAtk: 'baseSpAtk', spDef: 'baseSpDef', speed: 'baseSpeed' };
export const ROTULO = { hp: 'HP', atk: 'ATK', def: 'DEF', spAtk: 'SP.ATK', spDef: 'SP.DEF', speed: 'SPD' };

/**
 * O nascimento "médio", para quem só informa espécie e nível: IV no meio da faixa (1–32), a
 * qualidade mediana das bandas do jogo, potência 1, sem shiny, sem refino.
 */
export function nascimentoMedio(mod) {
  const nota = mod.nota;
  const iv = Math.floor((nota.IV_POR_STAT.min + nota.IV_POR_STAT.max) / 2);
  return {
    ivs: Object.fromEntries(STATS.map((k) => [k, iv])),
    qualidade: qualidadeMediana(nota.BANDAS_QUALIDADE),
    potencia: nota.POTENCIA_MIN,
    shiny: false,
    refino: Object.fromEntries(STATS.map((k) => [k, 0])),
  };
}

/** A qualidade em que metade dos nascimentos fica abaixo — interpolada dentro da banda. */
export function qualidadeMediana(bandas) {
  let acumulado = 0;
  for (const b of bandas) {
    const proximo = acumulado + b.chance;
    if (proximo >= 50) {
      const fracao = b.chance > 0 ? (50 - acumulado) / b.chance : 0;
      return Math.round((b.min + (b.max - b.min) * fracao) * 100) / 100;
    }
    acumulado = proximo;
  }
  return bandas.at(-1)?.max ?? 1;
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Os seis stats no nível `level`, como a ficha do jogo mostra. */
export function statsDoNascimento(esp, nascimento, level, mod) {
  const nota = mod.nota;
  // Lendários e míticos levam ×4 nos stats desde a 1.275 (MULT_LENDARIO_STATS, em nota-pokemon.mjs).
  const lendario = !!mod.mistico?.ehLendarioOuMitico?.(esp.pokeId);
  const mult = nota.multDeNascenca(limitar(Number(nascimento.potencia) || 1, nota.POTENCIA_MIN, nota.POTENCIA_MAX), !!nascimento.shiny, lendario);
  const q = limitar(Number(nascimento.qualidade) || 1, nota.QUALIDADE_MIN, nota.QUALIDADE_MAX);
  const stats = {};
  for (const k of STATS) {
    const iv = limitar(Math.round(Number(nascimento.ivs?.[k]) || nota.IV_POR_STAT.min), nota.IV_POR_STAT.min, nota.IV_POR_STAT.max);
    const refino = Math.max(0, Math.round(Number(nascimento.refino?.[k]) || 0));
    stats[k] = Math.round(((esp[BASE_DE[k]] ?? 0) + refino + 2 * iv) * level / 100 * Math.pow(q, nota.EXPO_QUALIDADE[k]) * mult);
  }
  return stats;
}

/**
 * O pokémon no formato que o motor lê. Com `statsInformados` (a ficha colada), os stats valem
 * como estão no nível em que foram lidos e escalam linearmente com o nível — a fórmula é
 * proporcional a `nível/100`. Os discos (AoE, TM Elemental) ficam de fora: o motor não os usa.
 */
export function montarPokemon({ esp, nascimento, level, statsInformados, nivelDosStats }, mod) {
  let stats;
  if (statsInformados) {
    const fator = level / (nivelDosStats || level);
    stats = Object.fromEntries(STATS.map((k) => [k, Math.round((Number(statsInformados[k]) || 0) * fator)]));
  } else {
    stats = statsDoNascimento(esp, nascimento, level, mod);
  }
  return {
    id: esp.pokeId,
    speciesId: esp.pokeId,
    nome: esp.name,
    level,
    tipos: [esp.type1, esp.type2].filter(Boolean),
    stats,
    ivs: { ...nascimento.ivs },
    potencia: nascimento.potencia,
    quality: nascimento.qualidade,
    shiny: !!nascimento.shiny,
  };
}
