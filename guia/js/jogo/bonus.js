// Os bônus de XP como o jogador escolhe na tela → o multiplicador que o jogo aplicaria.
//
// Os multiplicadores da Loja (VIP, boosts, guild) vêm das funções do próprio jogo
// (`multXpTreinador`, `multXpPokemon` do hunt-analyser) a partir de um estado do treinador no
// formato do jogo. Aqui a tela só preenche esse estado: quem sabe quanto vale cada bônus é o
// snapshot, não o site. Twitch, Kick, evento e Atrasados entram por cima, como a Pokepédia
// descreve (Níveis e XP: eles se MULTIPLICAM).

export const ESCOLHAS_PADRAO = Object.freeze({
  vip: false,
  xpBoost: false,
  xpBoostPokemon: false,
  guildPosicao: 0, // 0 = sem bônus de ranking; 1–9 = posição; 10 = "10º ou abaixo"
  boostGuild: false,
  // Twitch e Kick: hora de bônus resgatada com pontos do canal. Até 04/11/2026 o da Twitch valia
  // enquanto se estava no chat da live e crescia com cada live extra aberta; agora é igual ao da
  // Kick, e resgatar de novo estica o prazo, não o percentual.
  twitch: false,
  kick: false,
  eventoPct: 0, // o evento de XP do jogo vale igual para treinador e pokémon
  atrasados: false,
  atrasadosAlvo: null, // null = o alvo de exemplo do snapshot
});

/** O % do bônus do ranking da guild para a posição no Guild Diário. */
export function pctRankingGuild(posicao, mod) {
  const tabela = mod.guildPremios.BONUS_RANKING_GP;
  const p = Math.floor(Number(posicao) || 0);
  if (p <= 0) return 0;
  return tabela[p] ?? tabela.resto ?? 0;
}

/** O nível-alvo do Boost dos Atrasados em uso: o digitado, ou o exemplo do snapshot. */
export const alvoAtrasados = (escolhas, constantes) =>
  Math.max(1, Math.floor(Number(escolhas.atrasadosAlvo) || constantes.atrasados.alvoExemplo));

/**
 * O estado do treinador que o jogo mandaria com essas escolhas, no nível `level`. Os prazos
 * (`vipAte`, boosts, Kick, evento) ficam uma hora à frente de `agora` — só interessa se estão
 * valendo agora.
 */
export function estadoDoTreinador(escolhas, level, { mod, constantes }, agora = Date.now()) {
  const e = { ...ESCOLHAS_PADRAO, ...escolhas };
  const futuro = agora + 3_600_000;
  const loja = { boosts: {} };
  if (e.vip) loja.vipAte = futuro;
  if (e.xpBoost) loja.boosts.xp = futuro;
  if (e.xpBoostPokemon) loja.boosts.pokexp = futuro;
  if (e.atrasados) loja.atrasados = { mult: mod.atrasados.ATRASADOS.mult, alvo: alvoAtrasados(e, constantes) };
  const eu = { level, loja, guildBonusPct: pctRankingGuild(e.guildPosicao, mod) };
  if (e.boostGuild) eu.guild = { boostAte: futuro };
  if (e.twitch) eu.twitch = { pct: constantes.lives.pctTwitch, bonus: { xp: futuro } };
  if (e.kick) eu.kick = { pct: constantes.lives.pctKick, bonus: { xp: futuro } };
  const ev = Math.max(0, Number(e.eventoPct) || 0);
  if (ev) eu.evento = { xpTreinadorPct: ev, xpPokemonPct: ev, terminaEm: futuro };
  return eu;
}

/**
 * Todos os multiplicadores de XP ativos para o estado `eu` (formato do jogo): VIP, XP Boost e XP
 * Boost Pokémon, Boost da Guild e ranking da guild — os quatro já na conta `multXp*` do jogo —,
 * mais o bônus Twitch, o bônus na Kick, o evento e o Boost dos Atrasados.
 */
export function bonusXp(eu, { mod, constantes }, agora = Date.now()) {
  const tiposBoost = constantes.tiposBoost ?? [];
  const base = {
    pokemon: mod.analyser.multXpPokemon?.(eu ?? {}, agora, tiposBoost) ?? 1,
    treinador: mod.analyser.multXpTreinador?.(eu ?? {}, agora, tiposBoost) ?? 1,
  };
  const itens = [];
  const l = eu?.loja ?? {};
  const boostDe = (chave) => (agora < (l.boosts?.[chave] ?? 0) ? tiposBoost.find((b) => b.chave === chave)?.mult ?? 1 : 1);
  if (agora < (l.vipAte ?? 0)) itens.push({ nome: 'VIP', mult: mod.analyser.VIP_MULT_XP ?? 1.5, ambos: true, base: true });
  if (boostDe('xp') > 1) itens.push({ nome: 'XP Boost', mult: boostDe('xp'), treinador: true, base: true });
  if (boostDe('pokexp') > 1) itens.push({ nome: 'XP Boost Pokémon', mult: boostDe('pokexp'), pokemon: true, base: true });
  if (Number(eu?.guildBonusPct) > 0) itens.push({ nome: 'Ranking da guild', mult: 1 + eu.guildBonusPct / 100, ambos: true, base: true });
  if (agora < (eu?.guild?.boostAte ?? 0)) {
    const m = base.pokemon / itens.filter((i) => i.base && (i.ambos || i.pokemon)).reduce((s, i) => s * i.mult, 1);
    if (m > 1.0001) itens.push({ nome: 'Boost da Guild', mult: m, ambos: true, base: true });
  }
  const extra = { pokemon: 1, treinador: 1 };
  const somar = (item) => {
    itens.push(item);
    if (item.ambos || item.pokemon) extra.pokemon *= item.mult;
    if (item.ambos || item.treinador) extra.treinador *= item.mult;
  };
  for (const [chave, nome] of [['twitch', 'Twitch'], ['kick', 'Kick']]) {
    const live = eu?.[chave];
    if (agora < (Number(live?.bonus?.xp) || 0) && Number(live?.pct) > 0) somar({ nome, mult: 1 + live.pct / 100, ambos: true });
  }
  const ev = eu?.evento;
  if (ev && agora < (ev.terminaEm ?? 0)) {
    const tr = Number(ev.xpTreinadorPct) || 0;
    const pk = Number(ev.xpPokemonPct) || 0;
    if (tr && tr === pk) somar({ nome: 'Evento', mult: 1 + tr / 100, ambos: true });
    else {
      if (pk) somar({ nome: 'Evento (pokémon)', mult: 1 + pk / 100, pokemon: true });
      if (tr) somar({ nome: 'Evento (treinador)', mult: 1 + tr / 100, treinador: true });
    }
  }
  const at = l.atrasados;
  if (at && Number(at.mult) > 1 && (eu?.level ?? 0) < (Number(at.alvo) || 0)) somar({ nome: 'Atrasados', mult: Number(at.mult), ambos: true });
  return { pokemon: base.pokemon * extra.pokemon, treinador: base.treinador * extra.treinador, itens };
}

/** Os multiplicadores resultantes (treinador e pokémon) e a lista do que está ligado. */
export function multiplicadores(escolhas, level, jogo, agora = Date.now()) {
  return bonusXp(estadoDoTreinador(escolhas, level, jogo, agora), jogo, agora);
}
