// Motor do "Onde caçar?" — simula o seu pokémon em cada hunt e ordena por XP/h ou ouro/h.
//
// É o motor da extensão /hunt for PokeIdle, trazido para o site como módulo ES: é o que a aba
// /hunt usa. A Calculadora de XP não passa por aqui (ela usa a cadência informada pelo jogador). Regras de
// combate: Pokepédia do jogo (capítulos Combate e Stats) e os módulos `shared/` do snapshot
// (curva de cooldown, desconto do Speed, efetividade amplificada, XP e ouro por abate,
// multiplicadores de boost). Constantes que o servidor manda no `welcome` (multiplicadores do
// selvagem, tabela de tipos) entram por `ctx.consts`.
//
// O que NÃO está no cliente fica em MEDIDO (medido em jogo) e na tabela de ritmo por mapa.
//
// RITMO (jogo 1.409.0, 07/11/2026): o tempo por abate de quem mata de um golpe a pé vem do
// simulador do jogo, hunt a hunt (o perfil ST1 do export que o dono gera do código dele). Ele é do
// MAPA — as hunts que dividem um mapa têm os mesmos pontos de spawn e o mesmo número — e, com os
// mapas gerados da 1.409, vai de 3,05 s a 3,76 s por abate (no layout de 28/10, medido pela
// telemetria do PokeIdle Launcher, ia de 2,3 s a 5,6 s). Nas 28 hunts em que o layout não mudou
// desde aquela medida, o simulador erra 1,4% na mediana e 8,8% no p90. Então:
//
//   segundos por abate = tempo morto + tempo de luta do motor
//
// com as recargas dos golpes correndo no tempo morto. Quem mata de um golpe tem o tempo morto igual
// ao do mapa; quem luta mais anda menos, porque o bando caminha até o herói (~0,5 tile/s) enquanto
// ele luta — e, andando menos, tem menos recarga para a luta. As duas coisas se acertam num ponto
// fixo (ver `tempoMorto`, ajustado na telemetria de 29/10). Contra 65 medidas de três pokémon que
// precisam de vários golpes: erro mediano de 3–6% por pokémon, máximo de 19%; contra o perfil de
// três golpes do simulador do jogo (ST3), com o intervalo base de 0,9 s, 3,2% na mediana e viés de
// 0,2%. A tabela é `data/jogo/ritmo-do-jogo.json`, gerada por scripts/importar-ritmo-do-jogo.mjs.
// Hunt que a tabela não conhece usa a mediana dos mapas — e a linha diz de onde veio o número e a
// faixa de abates/h.
//
// O pódio dos ginásios (+25/10/5% de dano com pokémon do tipo, jogo 1.377.0) entra só na
// extensão, que lê o estado do jogador; a ficha colada aqui não diz em que pódio ele está.
//
// O DIA SAZONAL (desde 20/10/2026) entra pela opção `tipoDoDia`: às 18:00 de Brasília o
// servidor sorteia uma tipagem, e nas hunts do Mapa todo pokémon dela — o seu e o selvagem — fica
// 2× mais forte, o que o jogo resolve no dano (`multDanoSazonal`, shared/dia-sazonal.mjs): ×2 quem
// bate, ×¼ quem apanha. Na telemetria de 29/10 (dia Elétrico) o selvagem elétrico levou ¼ do dano
// previsto nas três contas medidas. O sorteio mora no servidor; o jogador vê o ícone na hunt.
//
// O AoE (o disco) entra desde 07/11/2026, como ESTIMATIVA, quando a ficha mostra o disco: cada golpe
// acerta todo selvagem no 11×11 em volta do herói. Quem mata de um golpe usa o tempo do mapa com AoE
// do simulador do jogo (o perfil AOE do export); quem luta mais tem a luta de cada abate dividida
// pelos selvagens que cada golpe acerta (ver MEDIDO.aoeAlvosPorGolpe), sem medida em jogo — a linha
// sai com ≈ e a faixa. O TM Elemental (o Z-Move) segue FORA, por decisão de 18/10/2026, a mesma da
// extensão. O resto é a base: o pokémon com os golpes da espécie, um selvagem por vez.

import { bonusXp } from './bonus.js';
import { regiaoDoMapa } from './regioes.js';

// ---- regras do jogo que o cliente só documenta em texto (Pokepédia > Combate) -------------
export const REGRAS = {
  randMedio: 0.925, // aleatório(0,85–1,00)
  stab: 1.5,
  gapJogadorMs: 900, // intervalo mínimo entre golpes seus
  gapSelvagemS: 1.4, // intervalo mínimo entre golpes dele
  investidaPower: 30,
  investidaCdMs: 2000,
  pisoCdMs: 400, // piso do desconto fixo do IV de SPD
  msPorIvSpd: 10, // −10 ms por ponto de IV de SPD na Investida e no intervalo
  hpCombateMult: 12, // hpDeCombate = máx(24, arred(hp × 12))
  hpCombateMin: 24,
  ivSelvagemMedio: 16, // selvagem: IV sorteado 1–32 por mob
  poderMinimo: 15,
  capturaNoCorpo: 1.4, // o (1,4 − hp/hpMáx) da fórmula de captura, com o selvagem caído (hp 0)
};

// ---- ritmo da hunt: medido em jogo ----------------------------------------------------------
export const MEDIDO = {
  ruidoJogo: 0.09, // o simulador do jogo contra a telemetria de 29/10, onde o layout não mudou: p90 do erro
  sPorAbatePadrao: 3.41, // sem a tabela de ritmo: a mediana dos mapas do simulador do jogo 1.409.0
  heroiSPorTile: 0.51, // passo do herói, o mesmo em todo pokémon medido
  distMorteTiles: 20.6, // a corrida de volta depois de morrer (mediana das hunts no layout antigo)
  respawnS: 3, // morte → volta ao jogo (sem contar a corrida)
  amostrasHp: 32, // abates simulados por espécie (IV de HP 1..32)
  maxAtaquesPorAbate: 4000,
  // Quem luta mais anda menos: o bando caminha até o herói enquanto ele luta. A caminhada de um golpe
  // é ~83% do tempo do mapa (o resto é a pausa da onda e a 1ª caminhada de cada leva); com luta longa
  // ela cai até o piso, o tempo de virar para o próximo alvo.
  caminhadaDoMapa: 0.83, // caminhada de um golpe ÷ tempo do mapa (mediana de 245 sessões)
  caminhadaPisoS: 1.41, // a caminhada das sessões com luta ≥ 4 s por abate (mediana)
  caminhadaTauS: 2.8, // a luta que leva 63% do caminho entre a caminhada de um golpe e o piso
  // Com o disco de AoE, os selvagens que cada golpe acerta, e a luta de cada abate se divide por eles. NÃO medido com
  // AoE: 2 é a mediana de selvagens a até 5 tiles do herói a cada golpe na telemetria de 28/10 (sem AoE, layout
  // antigo); no layout de 07/11 o bando que cabe no 11×11 tem 3 selvagens em 75% das hunts. A faixa vai de 1,5 a 3.
  aoeAlvosPorGolpe: 2,
  aoeAlvosFaixa: [1.5, 3],
};

const STATS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];
const BASE_DE = { hp: 'baseHp', atk: 'baseAtk', def: 'baseDef', spAtk: 'baseSpAtk', spDef: 'baseSpDef', speed: 'baseSpeed' };
const tiposDe = (esp) => [esp.type1, esp.type2].filter(Boolean);
const ivSpd = (iv) => Math.min(32, Math.max(1, Math.round(Number(iv) || 1)));
const cdPeloIv = (ms, iv) => Math.max(REGRAS.pisoCdMs, ms - ivSpd(iv) * REGRAS.msPorIvSpd);

function dano(nivel, power, atk, def, stab, efet) {
  const base = ((2 * nivel / 5 + 2) * power * Math.max(1, atk) / Math.max(1, def)) / 50 + 2;
  return base * (stab ? REGRAS.stab : 1) * efet * REGRAS.randMedio;
}

/** Stats do selvagem: IV médio, qualidade 1, potência I. */
function statsSelvagem(esp, nivel, iv = REGRAS.ivSelvagemMedio) {
  const o = {};
  for (const k of STATS) o[k] = ((esp[BASE_DE[k]] ?? 0) + 2 * iv) * nivel / 100;
  return o;
}

/** Os golpes que o pokémon usa: os da espécie liberados até o nível, com o desconto do Speed. */
function golpesDoPokemon(pk, esp, mod) {
  const comSpeed = (cd) => mod.cooldown.cooldownGolpeComSpeed(cd, esp.baseSpeed, pk.ivs?.speed);
  return (esp.attacks ?? [])
    .filter((a) => (a.learnLevel ?? 1) <= (pk.level ?? 1))
    .map((a) => ({ ...a, cooldownMs: comSpeed(a.cooldownMs) }));
}

/**
 * A vantagem elemental AMPLIFICADA na hunt: o servidor manda o fator no welcome (`ampliacaoHunt`,
 * 1.5) e aplica ×1,5 por cima do que passa de 1 (2 → 2,5) e divide o que fica abaixo (0,5 → 0,33);
 * imunidade e neutro ficam. Era o `efetividadeHunt` do hunt-analyser até o jogo 1.287, que o
 * tirou por não usar mais no cliente — o servidor segue amplificando, então a conta vive aqui.
 */
export function amplificarHunt(v, fator) {
  return v === 0 || v === 1 ? v : v > 1 ? 1 + (v - 1) * fator : v / fator;
}

function criarEfetividade(ctx) {
  const tabela = ctx.consts.tabelaTipos ?? {};
  const fator = ctx.consts.ampliacaoHunt ?? 1.5;
  const cache = new Map();
  return (atq, d1, d2) => {
    const k = `${atq}|${d1}|${d2}`;
    let v = cache.get(k);
    if (v === undefined) {
      v = amplificarHunt(ctx.mod.analyser.efetividade(atq, d1, d2 ?? null, tabela), fator);
      cache.set(k, v);
    }
    return v;
  };
}

/** A Investida sai no 1º tipo; só passa para o 2º se o alvo for imune ao 1º. */
function tipoDaInvestida(tipos, ef, alvoTipos) {
  const [t1, t2] = tipos;
  if (t2 && ef(t1, alvoTipos[0], alvoTipos[1]) === 0) return t2;
  return t1;
}

/**
 * Segundos de luta por abate. A cada ataque o pokémon usa, entre os golpes prontos, o de
 * maior dano contra o alvo; sem golpe pronto vem a Investida; todo ataque ocupa o intervalo
 * global. O HP do selvagem rola por abate (IV 1–32) e as recargas correm no tempo morto.
 */
function segundosPorAbate(golpes, investida, gapS, hps, mortoS) {
  const ordem = golpes.map((_, i) => i).filter((i) => golpes[i].d > 0).sort((a, b) => golpes[b].d - golpes[a].d);
  const pronto = golpes.map(() => 0);
  let proxInv = 0, t = 0, luta = 0;
  for (const hp of hps) {
    let feito = 0, ini = t, ultimo = t, ataques = 0;
    while (feito < hp) {
      if (++ataques > MEDIDO.maxAtaquesPorAbate) return Infinity;
      let i = -1;
      for (const j of ordem) if (pronto[j] <= t) { i = j; break; }
      if (i >= 0) {
        feito += golpes[i].d; pronto[i] = t + golpes[i].cdS; ultimo = t; t += gapS;
      } else if (investida.d > 0 && proxInv <= t) {
        feito += investida.d; proxInv = t + investida.cdS; ultimo = t; t += gapS;
      } else {
        let prox = investida.d > 0 ? proxInv : Infinity;
        for (const j of ordem) if (pronto[j] < prox) prox = pronto[j];
        if (!Number.isFinite(prox)) return Infinity;
        t = Math.max(t, prox);
      }
    }
    luta += ultimo - ini;
    t = ultimo + mortoS;
  }
  return luta / hps.length;
}

/** O que o selvagem faz com você: dano por segundo e o pior golpe (rolagem máxima). */
function ameacaDoSelvagem(esp, nivel, pk, ef, ctx, multSazonal) {
  const st = statsSelvagem(esp, nivel);
  const tiposPk = pk.tipos;
  const tiposEsp = tiposDe(esp);
  const multDano = (ctx.consts.multDanoSelvagem ?? 1.8) * multSazonal;
  const golpes = (esp.attacks ?? []).filter((a) => (a.learnLevel ?? 1) <= nivel);
  const danos = golpes.map((a) => {
    const fisico = a.category !== 'SPECIAL';
    return dano(nivel, Math.max(REGRAS.poderMinimo, a.power), fisico ? st.atk : st.spAtk,
      fisico ? pk.stats.def : pk.stats.spDef, tiposEsp.includes(a.type), ef(a.type, tiposPk[0], tiposPk[1]));
  });
  const tipoInv = tipoDaInvestida(tiposEsp, ef, tiposPk);
  const inv = dano(nivel, REGRAS.investidaPower, st.atk, pk.stats.def, true, ef(tipoInv, tiposPk[0], tiposPk[1]));
  const media = danos.length ? (danos.reduce((s, x) => s + x, 0) / danos.length) * 0.92 + inv * 0.08 : inv;
  return {
    dps: media * multDano / REGRAS.gapSelvagemS,
    hitMax: Math.max(inv, ...danos) / REGRAS.randMedio * multDano,
  };
}

/**
 * O tempo por abate de quem mata de um golpe na hunt, a faixa dele e de onde veio: `jogo` (o mapa
 * da hunt está na tabela do simulador do jogo; uma tabela de outra `fonte`, como a medida em jogo
 * que a calibração usa, dá o nome dela), `faixa` (hunt fora da tabela: a mediana dos mapas) ou
 * `padrao` (sem a tabela).
 */
function tempoDoMapa(h, ritmo) {
  if (!ritmo) {
    const s = MEDIDO.sPorAbatePadrao;
    return { s, sAoe: s, faixa: [s, s], ritmo: 'padrao', mapa: null };
  }
  const r = MEDIDO.ruidoJogo;
  const mapa = ritmo.hunts?.[h.slug] ?? null;
  const doMapa = mapa ? ritmo.mapas?.[mapa] : null;
  const comAoe = (s, m) => m?.sAoe ?? s / (ritmo.ganhoAoe ?? 1);
  if (doMapa) return { s: doMapa.s, sAoe: comAoe(doMapa.s, doMapa), faixa: [doMapa.s * (1 - r), doMapa.s * (1 + r)], ritmo: ritmo.fonte ?? 'jogo', mapa };
  // Sem o mapa, a dúvida é a de qual mapa (p10–p90) somada ao erro do próprio número.
  const f = ritmo.faixa;
  return { s: f.mediana, sAoe: comAoe(f.mediana, null), faixa: [f.p10 * (1 - r), f.p90 * (1 + r)], ritmo: 'faixa', mapa };
}

/**
 * O tempo morto por abate (caminhada, pausa da onda, recargas correndo) com F segundos de luta por
 * abate, num mapa em que quem mata de um golpe leva `sMapa`.
 */
function tempoMorto(sMapa, F) {
  const encurta = Math.max(0, MEDIDO.caminhadaDoMapa * sMapa - MEDIDO.caminhadaPisoS);
  return sMapa - encurta * (1 - Math.exp(-F / MEDIDO.caminhadaTauS));
}

// ---- captura, Shiny e o Fragmento de Ovo Shiny --------------------------------------------------
// Cada selvagem caído recebe UMA bola (o corpo fica 30 s no chão). Arremessar em todo corpo é o
// "Throw Nonstop" do VIP: a conta supõe isso. A venda dos pokémon capturados ao NPC não entra no ouro/h.
// É a mesma conta da extensão /hunt for PokeIdle; aqui a bola vem da tela (`eu.automation.ballIds`).

/**
 * O que a conta de captura usa do jogador: a bola — a de maior eficiência entre as marcadas no
 * arremesso automático que ele tem; sem nenhuma, a melhor da bolsa — e os boosts da Loja que valem
 * agora (Capture Boost, Shiny Secret Lure, Loot Boost). `null` sem o catálogo de bolas.
 */
function capturaDoJogador(ctx, agora = Date.now()) {
  const bolas = ctx.consts.catalogoBolas ?? [];
  if (!bolas.length || !ctx.mod.capturaDegrau) return null;
  const eu = ctx.eu ?? {};
  const tem = (b) => (Number(eu.balls?.[b.id]) || 0) > 0;
  const marcadas = new Set((eu.automation?.ballIds ?? []).map(Number));
  const melhor = (lista) => [...lista].sort((a, b) => b.catchRate - a.catchRate)[0] ?? null;
  const marcada = melhor(bolas.filter((b) => marcadas.has(b.id) && tem(b)));
  const bola = marcada ?? melhor(bolas.filter(tem)) ?? melhor(bolas.filter((b) => b.compravel)) ?? bolas[0];
  const tiposBoost = ctx.consts.tiposBoost ?? [];
  const boost = (chave) => (agora < (eu.loja?.boosts?.[chave] ?? 0) ? Number(tiposBoost.find((b) => b.chave === chave)?.mult) || 1 : 1);
  return {
    bola, origem: marcada ? 'marcada' : tem(bola) ? 'bolsa' : 'nenhuma',
    multCaptura: boost('captura'), multShiny: boost('shiny'), multLoot: boost('loot'),
    chanceShiny: Number(ctx.consts.chanceShiny) || 1 / 24000,
    consts: { base: 0.0075, piso: 0.003, teto: 0.1, raridadeDiv: 17, precoSemPreco: 6.5e9, ...(ctx.consts.captura ?? {}) },
    chaves: ctx.mod.capturaDegrau.chavesEmHunt(ctx.hunts),
    looks: ctx.consts.shinyLooks ?? null,
  };
}

/**
 * A chance de UMA bola fechar no selvagem caído, como a ficha do jogo calcula (`chanceDeCaptura` no
 * app.js, com hp 0): base × (eficiência ÷ fator) × 1,4, entre o piso e o teto. O fator é o do estágio
 * evolutivo (`teto`, da tabela do jogo) para quem aparece em hunt, e o do preço para lendário e mítico.
 */
function chanceNoCorpo(esp, teto, catchRate, cap, mod) {
  const c = cap.consts;
  if (catchRate >= 255) return 1;
  const fator = mod.capturaDegrau.fatorDeCaptura({
    tetoCaptura: teto,
    peloDegrau: mod.capturaDegrau.capturaPeloDegrau(esp.pokeId, cap.chaves),
    preco: esp.priceNpc > 0 ? esp.priceNpc : c.precoSemPreco,
    raridadeDiv: c.raridadeDiv ?? 17,
    porDegrau: c.porDegrau ?? mod.capturaDegrau.FATOR_CAPTURA_DO_DEGRAU,
  });
  return Math.max(c.piso, Math.min(c.teto, c.base * (catchRate / fator) * REGRAS.capturaNoCorpo));
}

/** A espécie tem arte Shiny? Sem arte o jogo não dá Shiny (ovo-shiny.mjs); o clone de Orre usa a do nacional. */
const temShiny = (pokeId, looks) => !looks || pokeId in looks || (pokeId >= 13000 && (pokeId % 1000) in looks);

function simularHunt(h, pk, golpesPk, ef, ctx, opcoes) {
  const especiesHunt = (h.especies ?? [])
    .map((e) => ({ esp: ctx.especies.get(e.pokeId), pontos: Number(e.pontos) || 0 }))
    .filter((e) => e.esp && e.pontos > 0);
  const total = especiesHunt.reduce((s, e) => s + e.pontos, 0);
  if (!total) return null;
  const nivel = h.nivel ?? 1;
  const multSazonal = ctx.mod.sazonal?.multDanoSazonal;
  const sazonal = (atacante, defensor) => (opcoes.tipoDoDia && multSazonal ? multSazonal(opcoes.tipoDoDia, atacante, defensor) : 1);

  // Entre um abate e o primeiro golpe no próximo alvo o herói anda, e as recargas correm nesse tempo.
  const mapa = tempoDoMapa(h, ctx.ritmo);
  const gapS = cdPeloIv(REGRAS.gapJogadorMs, pk.ivs?.speed) / 1000;
  const cdInvS = cdPeloIv(REGRAS.investidaCdMs, pk.ivs?.speed) / 1000;

  let ttk = 0, dps = 0, hitMax = 0, xpKill = 0, ouroKill = 0, efMedia = 0, captura = 0, shiny = 0;
  const cap = opcoes.captura;
  const teto = ctx.ritmo?.tetosDeCaptura?.[h.slug];
  const lutas = [];
  const shinyPorEspecie = [];
  let melhorGolpe = null, melhorDano = -1;
  const alvos = [];
  for (const { esp, pontos } of especiesHunt) {
    const w = pontos / total;
    const tiposAlvo = tiposDe(esp);
    const st = statsSelvagem(esp, nivel);
    const multEu = sazonal(pk.tipos, tiposAlvo);
    const golpes = golpesPk.map((g) => {
      const fisico = g.category !== 'SPECIAL';
      const d = dano(pk.level, Math.max(REGRAS.poderMinimo, g.power), fisico ? pk.stats.atk : pk.stats.spAtk,
        fisico ? st.def : st.spDef, pk.tipos.includes(g.type), ef(g.type, tiposAlvo[0], tiposAlvo[1])) * multEu;
      return { d, cdS: g.cooldownMs / 1000, g };
    });
    for (const g of golpes) {
      if (g.d * w > melhorDano) { melhorDano = g.d * w; melhorGolpe = g.g; }
    }
    const tipoInv = tipoDaInvestida(pk.tipos, ef, tiposAlvo);
    const investida = {
      d: dano(pk.level, REGRAS.investidaPower, pk.stats.atk, st.def, true, ef(tipoInv, tiposAlvo[0], tiposAlvo[1])) * multEu,
      cdS: cdInvS,
    };
    const multHp = ctx.consts.multHpSelvagem ?? 5;
    const hps = [];
    for (let k = 0; k < MEDIDO.amostrasHp; k++) {
      const iv = 1 + Math.floor(k * 32 / MEDIDO.amostrasHp + 0.5);
      const hpStat = ((esp.baseHp ?? 0) + 2 * iv) * nivel / 100;
      hps.push(Math.max(REGRAS.hpCombateMin, Math.round(hpStat * REGRAS.hpCombateMult)) * multHp);
    }
    const s = segundosPorAbate(golpes, investida, gapS, hps, mapa.s);
    if (!Number.isFinite(s)) { ttk = Infinity; break; }
    ttk += w * s;
    lutas.push({ w, golpes, investida, hps });

    const ameaca = ameacaDoSelvagem(esp, nivel, pk, ef, ctx, sazonal(tiposAlvo, pk.tipos));
    dps += w * ameaca.dps;
    hitMax = Math.max(hitMax, ameaca.hitMax);

    xpKill += w * ctx.mod.recompensa.xpPorDerrota(h, nivel, esp);
    // Desde 15/10/2026 (jogo 1.295) os itens de venda ao NPC não caem mais: o que eles rendiam
    // virou o "bônus de loot", pago em ouro dentro de `ouroPorDerrotaHunt`. Sem o Loot Boost
    // (4º argumento), por decisão de 18/10: só a base.
    ouroKill += w * ctx.mod.recompensa.ouroPorDerrotaHunt(h, nivel, esp);
    if (cap) {
      // O Capture Boost dobra a chance, até o teto da fórmula.
      const p = Math.min(cap.consts.teto, chanceNoCorpo(esp, teto, cap.bola.catchRate, cap, ctx.mod) * cap.multCaptura);
      captura += w * p;
      if (temShiny(esp.pokeId, cap.looks)) {
        const chance = w * p * cap.chanceShiny * cap.multShiny;
        shiny += chance;
        shinyPorEspecie.push({ pokeId: esp.pokeId, chance });
      }
    }
    alvos.push({ w, tiposAlvo });
  }
  // O fragmento cai de Unova em diante, com chance pelo nível da hunt; o Loot Boost multiplica.
  const fragmento = (ctx.mod.ovoShiny?.chanceFragmentoOvoShiny?.(h) ?? 0) * (cap?.multLoot ?? 1);
  for (const { w, tiposAlvo } of alvos) {
    efMedia += w * (melhorGolpe ? ef(melhorGolpe.type, tiposAlvo[0], tiposAlvo[1]) : 1);
  }

  const base = {
    hunt: h, slug: h.slug, nome: h.nome, nivel, regiao: regiaoDoMapa(h),
    liberada: (ctx.eu?.level ?? Infinity) >= nivel,
    ritmo: mapa.ritmo, mapa: mapa.mapa,
    melhorGolpe: melhorGolpe ? { nome: melhorGolpe.name, tipo: melhorGolpe.type } : null,
    efetividade: efMedia,
    capturaChance: cap ? captura : null, shinyChance: cap ? shiny : null, fragmentoChance: fragmento,
  };

  // A luta encurta a caminhada, e a caminhada mais curta deixa menos recarga para a luta: as duas
  // se acertam num ponto fixo. A luta é simulada nas duas pontas do tempo morto (o do mapa e o piso)
  // e, no meio, é a reta entre elas: iterar a simulação faz o ponto fixo pular entre dois valores,
  // porque a luta simulada anda aos saltos (o golpe forte está pronto ou não). Contra as medidas, a
  // reta erra o mesmo que a iteração e deixa o XP/h mais estável de um nível para o outro.
  const semLuta = mapa.s, piso = tempoMorto(mapa.s, Infinity);
  if (Number.isFinite(ttk) && ttk > 0.02 && semLuta - piso > 0.02) {
    const noPiso = lutas.reduce((t, l) => t + l.w * segundosPorAbate(l.golpes, l.investida, gapS, l.hps, piso), 0);
    if (Number.isFinite(noPiso)) {
      const lutaCom = (m) => ttk + (m - semLuta) * (noPiso - ttk) / (piso - semLuta);
      let lo = piso, hi = semLuta; // tempoMorto(lutaCom(m)) − m: ≥ 0 no piso, ≤ 0 sem luta
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (tempoMorto(mapa.s, lutaCom(m)) >= m) lo = m; else hi = m;
      }
      ttk = lutaCom((lo + hi) / 2);
    }
  }
  if (!Number.isFinite(ttk)) return { ...base, inviavel: true, motivo: 'não mata', xpPokemonH: 0, xpTreinadorH: 0, ouroH: 0, kph: 0, capturasH: 0, shinyH: 0, fragmentoH: 0 };

  // Com o disco de AoE, o tempo do mapa é o do jogo com AoE, e a luta de cada abate se divide pelos selvagens que
  // cada golpe acerta. Quem mata de um golpe não tem luta a dividir: o número é o do jogo.
  const aoe = !!pk.tmAoe;
  const sBase = aoe ? mapa.sAoe : mapa.s;
  const [porGolpeMin, porGolpeMax] = aoe ? MEDIDO.aoeAlvosFaixa : [1, 1];
  const porAbate = (sMapa, porGolpe = aoe ? MEDIDO.aoeAlvosPorGolpe : 1) => tempoMorto(sMapa, ttk / porGolpe) + ttk / porGolpe;
  const kph = 3600 / porAbate(sBase);

  // Morte, com um selvagem batendo por vez: com poção automática só morre quem leva, de uma
  // vez, mais que o HP inteiro; sem poção, morre quando o dano acumulado nos abates passa do HP.
  const hpPk = pk.maxHp ?? Math.max(REGRAS.hpCombateMin, Math.round(pk.stats.hp * REGRAS.hpCombateMult));
  const danoPorAbate = dps * ttk;
  const hitPior = hitMax;
  const umHit = hitPior >= hpPk;
  const abatesPorVida = opcoes.comPocao
    ? (umHit ? hpPk / hitPior : 999)
    : hpPk / Math.max(1e-6, danoPorAbate);
  const tempoMorte = MEDIDO.respawnS + MEDIDO.distMorteTiles * MEDIDO.heroiSPorTile;
  const vidaS = abatesPorVida * (kph > 0 ? 3600 / kph : 0);
  const uptime = vidaS / (vidaS + tempoMorte);
  const mortesH = abatesPorVida >= 999 ? 0 : 3600 / (vidaS + tempoMorte);
  const kphEf = kph * uptime;
  const escala = sBase / mapa.s;
  const kphFaixa = [3600 / porAbate(mapa.faixa[1] * escala, porGolpeMin) * uptime, 3600 / porAbate(mapa.faixa[0] * escala, porGolpeMax) * uptime];

  const multPk = opcoes.bonusXp?.pokemon ?? 1;
  const multTr = opcoes.bonusXp?.treinador ?? 1;

  return {
    ...base,
    inviavel: false,
    ttk, kph: kphEf, kphFaixa, mortesH, umHit,
    aoe: aoe ? { porGolpe: MEDIDO.aoeAlvosPorGolpe, estimado: ttk > 0.02 } : null,
    hitPct: hitPior / hpPk,
    danoPorAbate,
    xpPokemonH: kphEf * xpKill * multPk,
    xpTreinadorH: kphEf * xpKill * multTr,
    ouroH: kphEf * ouroKill,
    ouroKill, xpKill,
    capturasH: kphEf * captura, shinyH: kphEf * shiny, shinyPorEspecie: shinyPorEspecie.map(({ pokeId, chance }) => ({ pokeId, porHora: kphEf * chance })), fragmentoH: kphEf * fragmento,
  };
}

/**
 * Analisa todas as hunts de `ctx.hunts` para o pokémon `pk`.
 * `pk`: { speciesId, level, stats, ivs, tipos?, maxHp? }. Discos (AoE, TM) são ignorados.
 * `ctx`: { mod, especies, hunts, consts, eu, ritmo? } — `ritmo` é a tabela `ritmo-do-jogo.json`.
 * `opcoes`: { comPocao = true, ordem = 'xp' | 'ouro' | 'shiny' | 'fragmento', soLiberadas = true, tipoDoDia = null }.
 */
export function analisar(pk, ctx, opcoes = {}) {
  const op = { comPocao: true, ordem: 'xp', soLiberadas: true, tipoDoDia: null, ...opcoes };
  const esp = ctx.especies.get(pk.speciesId);
  if (!esp) throw new Error(`espécie ${pk.speciesId} (${pk.nome}) não está no catálogo`);
  const stats = pk.stats ?? null;
  if (!stats) throw new Error('o pokémon não tem stats');
  const poke = {
    ...pk,
    level: pk.level ?? 1,
    tipos: pk.tipos?.length ? pk.tipos : tiposDe(esp),
    stats,
  };
  const ef = criarEfetividade(ctx);
  const golpes = golpesDoPokemon(poke, esp, ctx.mod);
  const inicio = (typeof performance !== 'undefined' ? performance : Date).now();
  op.bonusXp = bonusXp(ctx.eu, { mod: ctx.mod, constantes: { tiposBoost: ctx.consts.tiposBoost ?? [] } });
  op.captura = capturaDoJogador(ctx);
  const linhas = [];
  for (const h of ctx.hunts ?? []) {
    const r = simularHunt(h, poke, golpes, ef, ctx, op);
    if (r) linhas.push(r);
  }
  const chave = { ouro: 'ouroH', shiny: 'shinyH', fragmento: 'fragmentoH' }[op.ordem] ?? 'xpPokemonH';
  linhas.sort((a, b) => (b[chave] - a[chave]) || (b.xpPokemonH - a.xpPokemonH) || (a.nivel - b.nivel));
  const ovo = ctx.mod.ovoShiny;
  return {
    pokemon: poke,
    especie: esp,
    golpes,
    bonusXp: op.bonusXp,
    aoe: !!poke.tmAoe,
    captura: op.captura && {
      bola: op.captura.bola, origem: op.captura.origem, chanceShiny: op.captura.chanceShiny,
      multCaptura: op.captura.multCaptura, multShiny: op.captura.multShiny, multLoot: op.captura.multLoot,
    },
    fragmento: ovo ? { nivelMin: ovo.NIVEL_MIN_FRAGMENTO_OVO_SHINY, porOvo: ovo.CUSTO_FRAGMENTOS_OVO_SHINY, horasChoca: ovo.HORAS_OVO_SHINY } : null,
    linhas: op.soLiberadas ? linhas.filter((l) => l.liberada) : linhas,
    total: linhas.length,
    ms: Math.round((typeof performance !== 'undefined' ? performance : Date).now() - inicio),
  };
}

export const _interno = { dano, statsSelvagem, segundosPorAbate, golpesDoPokemon, tempoDoMapa, tempoMorto, capturaDoJogador, chanceNoCorpo, temShiny };
