// O motor da extensão /hunt roda aqui, fora da thread da tela: simular 700 hunts leva uns dois
// segundos. Entrada: a ficha colada (já lida) e o nível do treinador. Sem bônus de XP: os
// multiplicadores ficam em ×1, como pediu a mantenedora.
import { carregarJogo } from '../jogo/catalogo.js';
import { prepararHunts } from '../jogo/hunts.js';
import { criarSimulador } from '../jogo/simulador.js';
import { pokemonDaFicha } from './pokemon-da-ficha.js';

const BLOCO = 100;
let carregando = null;
const carregar = () => (carregando ??= (async () => {
  const jogo = await carregarJogo();
  const dados = await fetch(new URL('../../data/jogo/hunts.json', import.meta.url), { cache: 'no-cache' }).then((r) => r.json());
  const { hunts, provisorio } = prepararHunts(dados, jogo);
  return { jogo, hunts, provisorio, sim: criarSimulador(jogo, hunts) };
})());

const especieDaHunt = (hunt, especies) => {
  const principal = (hunt?.especies ?? []).slice().sort((a, b) => b.pontos - a.pontos)[0];
  const e = principal ? especies.get(principal.pokeId) : null;
  return e ? { pokeId: e.pokeId, nome: e.name, tipos: [e.type1, e.type2].filter(Boolean) } : null;
};

const linhaLeve = (l, especies) => ({
  slug: l.slug, nome: l.nome, regiao: l.regiao, nivel: l.nivel, liberada: l.liberada, inviavel: !!l.inviavel,
  especie: especieDaHunt(l.hunt, especies),
  xpPokemonH: l.xpPokemonH, xpTreinadorH: l.xpTreinadorH, ouroH: l.ouroH, kph: l.kph, ttk: l.ttk ?? null,
  kphFaixa: l.kphFaixa ?? null, ritmo: l.ritmo ?? null, mapa: l.mapa ?? null, aoe: l.aoe ?? null,
  capturasH: l.capturasH ?? 0, shinyH: l.shinyH ?? 0, shinyPorEspecie: l.shinyPorEspecie ?? [], fragmentoH: l.fragmentoH ?? 0,
  capturaChance: l.capturaChance ?? null, shinyChance: l.shinyChance ?? null, fragmentoChance: l.fragmentoChance ?? 0,
  mortesH: l.mortesH ?? 0, umHit: !!l.umHit, hitPct: l.hitPct ?? 0,
  melhorGolpe: l.melhorGolpe, efetividade: l.efetividade,
});

const guardados = new Map();
const acoes = {
  carregar: async () => {
    const { jogo, hunts, provisorio } = await carregar();
    return {
      versao: jogo.versao, atualizadoEm: jogo.atualizadoEm, hunts: { total: hunts.length, provisorio },
      versaoDoRitmo: jogo.ritmo?.versaoDoJogo ?? null,
      bolas: (jogo.constantes.bolas ?? []).map((b) => ({ id: b.id, nome: b.nome, catchRate: b.catchRate })),
      chanceShiny: jogo.constantes.chanceShiny ?? null,
      fragmento: jogo.mod.ovoShiny ? {
        nivelMin: jogo.mod.ovoShiny.NIVEL_MIN_FRAGMENTO_OVO_SHINY, porOvo: jogo.mod.ovoShiny.CUSTO_FRAGMENTOS_OVO_SHINY,
        horasChoca: jogo.mod.ovoShiny.HORAS_OVO_SHINY, escada: jogo.mod.ovoShiny.tabelaFragmentoOvoShiny().map((d) => d.chance),
      } : null,
      especies: [...jogo.especies.values()].map((e) => ({ pokeId: e.pokeId, nome: e.name, tipos: [e.type1, e.type2].filter(Boolean) })),
    };
  },

  /** `entrada`: { ficha (ok de lerFicha), nivelTreinador, comPocao, soLiberadas, tipoDoDia, bola (o id, para o Shiny/h), aoe (a caixa da tela) }. */
  ranking: async (entrada, progresso) => {
    const d = await carregar();
    const chave = JSON.stringify([entrada.ficha, entrada.nivelTreinador, entrada.comPocao, entrada.tipoDoDia ?? null, entrada.bola ?? null, entrada.aoe ?? null]);
    let completo = guardados.get(chave);
    if (!completo) {
      const { pokemon, nivelPokemon, resumo } = pokemonDaFicha(entrada.ficha, d.jogo);
      // O disco de AoE entra na conta (como estimativa, ver motor.js): a caixa da tela, que segue a ficha até o jogador mexer.
      pokemon.tmAoe = entrada.aoe ?? !!entrada.ficha.tmAoe;
      const inicio = performance.now();
      let linhas = [];
      let cabecalho = null;
      for (let i = 0; i < d.hunts.length; i += BLOCO) {
        const r = d.sim.analisarHunts({ pokemon, nivelPokemon, nivelTreinador: entrada.nivelTreinador, hunts: d.hunts.slice(i, i + BLOCO), soLiberadas: false, comPocao: entrada.comPocao !== false, tipoDoDia: entrada.tipoDoDia ?? null, bola: entrada.bola ?? null });
        cabecalho ??= { stats: r.pokemon.stats, golpes: r.golpes.map((g) => ({ nome: g.name, tipo: g.type, power: g.power, cooldownMs: g.cooldownMs })), captura: r.captura, fragmento: r.fragmento, aoe: r.aoe };
        linhas = linhas.concat(r.linhas.map((l) => linhaLeve(l, d.jogo.especies)));
        progresso?.(Math.min(1, (i + BLOCO) / d.hunts.length));
      }
      completo = { ...cabecalho, resumo, linhas, total: linhas.length, ms: Math.round(performance.now() - inicio) };
      guardados.set(chave, completo);
      if (guardados.size > 6) guardados.delete(guardados.keys().next().value);
    }
    const linhas = entrada.soLiberadas === false ? completo.linhas : completo.linhas.filter((l) => l.liberada);
    return { ...completo, linhas };
  },
};

self.onmessage = async ({ data }) => {
  const { id, tipo, entrada } = data;
  try {
    const dados = await acoes[tipo](entrada, (p) => self.postMessage({ id, progresso: p }));
    self.postMessage({ id, ok: true, dados });
  } catch (err) {
    self.postMessage({ id, ok: false, erro: String(err?.message ?? err) });
  }
};
