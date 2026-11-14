





import { ouroPorDerrotaHunt, xpPorDerrota } from '../shared/recompensa-hunt.mjs';
import { efetividade as efetividadeTipos } from '../shared/tipo-efetividade.mjs';
import { multBoostGuild } from '../shared/guild-boost.mjs';

export const MS_ONDA = 2600;
export const MAX_MOBS = 16;

export const CD_GOLPE_MS = 900;

export const MS_DESLOC_MS = 600;

export const CD_MOVIMENTO_MEDIO_MS = 2000;
export const VIP_MULT_XP = 1.5;

export const TIPOS_ELEMENTAIS = [
  'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND',
  'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY',
];

export function efetividade(atq, def1, def2, tabela) {
  return efetividadeTipos(atq, def1, def2, tabela);
}

function multBoost(loja, chave, agora, tiposBoost) {
  const ate = loja?.boosts?.[chave] ?? 0;
  if (agora >= ate) return 1;
  return tiposBoost.find((b) => b.chave === chave)?.mult ?? 1;
}

const multGuild = (p) => 1 + (Number(p?.guildBonusPct) || 0) / 100;


const multBoostDaGuild = (p, agora) => multBoostGuild(p?.guild?.boostAte, agora);
const vipAtivo = (loja, agora) => agora < (loja?.vipAte ?? 0);

export function multXpTreinador(p, agora, tiposBoost) {
  const l = p.loja ?? {};
  return multBoost(l, 'xp', agora, tiposBoost) * (vipAtivo(l, agora) ? VIP_MULT_XP : 1) * multGuild(p)
    * multBoostDaGuild(p, agora);
}

export function multXpPokemon(p, agora, tiposBoost) {
  const l = p.loja ?? {};
  return multBoost(l, 'pokexp', agora, tiposBoost) * (vipAtivo(l, agora) ? VIP_MULT_XP : 1) * multGuild(p)
    * multBoostDaGuild(p, agora);
}







export function bonusLootPct(p, agora, tiposBoost, farmEventoPct = 0) {
  const boost = (multBoost(p?.loja ?? {}, 'loot', agora, tiposBoost) - 1) * 100;
  return boost + (Number(p?.guildBonusPct) || 0) + (Number(farmEventoPct) || 0);
}


export function mediaPorKill(hunt, especies, bonusLoot = 0) {
  const total = hunt.especies.reduce((s, e) => s + e.pontos, 0) || 1;
  let xp = 0;
  let gold = 0;
  for (const e of hunt.especies) {
    const esp = especies.get(e.pokeId);
    const peso = e.pontos / total;
    const base = xpPorDerrota(hunt, hunt.nivel, esp);
    xp += base * peso;
    gold += ouroPorDerrotaHunt(hunt, hunt.nivel, esp, bonusLoot) * peso;
  }
  return { xp, gold };
}


export function killsPorHora(hunt) {
  const pontos = hunt.especies.reduce((s, e) => s + e.pontos, 0) || 1;
  const porOnda = Math.min(MAX_MOBS, pontos);
  const msPorKill = CD_GOLPE_MS + MS_DESLOC_MS + CD_MOVIMENTO_MEDIO_MS;
  const segPorOnda = (porOnda * msPorKill + MS_ONDA) / 1000;
  return (porOnda / segPorOnda) * 3600;
}

export function melhorEfetividadeContra(tiposAtaque, defType1, defType2, tabela) {
  let melhor = 0;
  for (const atk of tiposAtaque) {
    const v = efetividade(atk, defType1, defType2, tabela);
    if (v > melhor) melhor = v;
  }
  return melhor;
}


export function especiePassaFiltroMatchup(esp, tiposSel, modo, tabela) {
  if (!esp || !tiposSel?.length || !modo) return false;
  const mult = melhorEfetividadeContra(tiposSel, esp.type1, esp.type2, tabela);
  if (modo === 'fraco') return mult >= 2;
  if (modo === 'forte') return mult <= 0.5;
  return false;
}





export function matchupDefensivo(tiposDefensor, tabela) {
  const fracos = [];
  const fortes = [];
  const d1 = tiposDefensor[0];
  const d2 = tiposDefensor[1];
  if (!d1) return { fracos, fortes };
  for (const atk of TIPOS_ELEMENTAIS) {
    const mult = efetividade(atk, d1, d2 ?? null, tabela);
    if (mult >= 2) fracos.push({ tipo: atk, mult });
    else if (mult <= 0.5) fortes.push({ tipo: atk, mult });
  }
  return { fracos, fortes };
}





export function matchupTiposHunt(tiposAtaque, tabela) {
  const fortes = [];
  const fracos = [];
  for (const def of TIPOS_ELEMENTAIS) {
    let melhor = 0;
    for (const atk of tiposAtaque) {
      const v = efetividade(atk, def, null, tabela);
      if (v > melhor) melhor = v;
    }
    if (melhor >= 2) fortes.push({ tipo: def, mult: melhor });
    else if (melhor <= 0.5) fracos.push({ tipo: def, mult: melhor });
  }
  return { fortes, fracos };
}


export function listaDropsEspecie(especie) {
  return (especie?.loot ?? [])
    .filter((l) => l.chance > 0)
    .map((l) => ({
      name: l.name,
      pct: l.chance / 1000,
      minCount: l.minCount,
      maxCount: l.maxCount,
    }))
    .sort((a, b) => b.pct - a.pct);
}












export const MS_MINIMO_RITMO = 60_000;

export function ritmoDaSessao(sessao, agora = Date.now()) {
  if (!sessao?.inicio) return null;
  const horas = Math.max(agora - sessao.inicio, MS_MINIMO_RITMO) / 3_600_000;
  return {


    xpH: Math.round(((sessao.xpTreinador || 0) + (sessao.xpPokemon || 0)) / horas),
    xpTreinadorH: Math.round((sessao.xpTreinador || 0) / horas),
    xpPokemonH: Math.round((sessao.xpPokemon || 0) / horas),
    ouroH: Math.round((sessao.gold || 0) / horas),
    abatesH: Math.round((sessao.abates || 0) / horas),
    capturasH: Math.round((sessao.capturas || 0) / horas),
  };
}

export function analisarHunt(hunt, ctx, tiposAtaque = []) {
  const { especies, tabelaTipos, eu, tiposBoost, farmEventoPct = 0 } = ctx;
  const agora = Date.now();
  const media = mediaPorKill(hunt, especies, bonusLootPct(eu, agora, tiposBoost, farmEventoPct));
  const kph = killsPorHora(hunt);
  const multTr = multXpTreinador(eu, agora, tiposBoost);
  const multPk = multXpPokemon(eu, agora, tiposBoost);
  const { fracos, fortes } = matchupDefensivo(tiposAtaque, tabelaTipos);

  return {
    hunt,
    xpTreinadorH: Math.round(media.xp * kph * multTr),
    xpPokemonH: Math.round(media.xp * kph * multPk),
    goldH: Math.round(media.gold * kph),
    killsH: Math.round(kph),
    tiposFracos: fracos,
    tiposResiste: fortes,
  };
}
