// O catálogo de espécies como o cliente do jogo monta, a partir do snapshot em `data/jogo/`.
//
// Por padrão só os passos que mexem em combate: stats-base, tipos e golpes. A ordem é a do
// `carregarCatalogoEspecies` do app.js do jogo (golpes das planilhas, base da Outland, cadeias
// truncadas, golpes especiais, Orre, megas). Com `evolucoes: true` entram também, no mesmo ponto
// do cliente, os elos entre gerações, os níveis de evolução e o TETO DE CAPTURA (`tetoCaptura`),
// que a Pokédex do site precisa; o motor do /hunt não os lê, então fica no padrão.
import { MODULOS, CATALOGOS, caminhoNoSnapshot } from './modulos.js';

const BASE = new URL('../../data/jogo/', import.meta.url);

/** Carregadores padrão: `import()` e `fetch()` relativos ao site. Os testes trocam pelos de disco. */
export const carregadoresDoSite = {
  importar: (rel) => import(new URL(caminhoNoSnapshot(rel), BASE).href),
  lerJson: (rel) => fetch(new URL(rel, BASE), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)),
};

export function montarCatalogo(mod, fontes, { evolucoes = false } = {}) {
  const { cr, novos, outlandNovos, formas, overrides } = fontes;
  const lista = [...(cr?.creatures ?? [])];
  if (novos?.creatures?.length) lista.push(...novos.creatures);
  if (outlandNovos?.creatures?.length) lista.push(...outlandNovos.creatures);
  // As formas (Heat Rotom, Castform Rainy, Alolan…) têm ficha própria e hunts próprias desde a
  // 1.31x; entram na mesma lista e no mesmo ponto do cliente, antes do remap e das planilhas.
  if (formas?.creatures?.length) lista.push(...formas.creatures);
  mod.outland.aplicarRemapOutlandLista(lista);

  for (const o of overrides?.overrides ?? []) {
    const c = lista.find((x) => x.pokeId === o.pokeId);
    if (!c) continue;
    for (const k of ['baseHp', 'baseAtk', 'baseDef', 'baseSpAtk', 'baseSpDef', 'baseSpeed']) {
      if (typeof o[k] === 'number') c[k] = o[k];
    }
    if (Array.isArray(o.attacks)) c.attacks = o.attacks.map((a) => ({ ...a }));
  }

  // A ordem dos tipos que o espelho trouxe trocada (Lucario, jogo 1.408): antes de tudo que lê o tipo, como o cliente.
  // Snapshot mais velho não tem a função, e o catálogo sai como antes.
  mod.ajustes?.aplicarAjustesTipos?.((id) => lista.filter((c) => c.pokeId === id));
  mod.planilhas.aplicarGolpesDasPlanilhas((id) => lista.filter((c) => c.pokeId === id));
  mod.baseOutland.herdarBaseOutland(lista);
  // Cadeias truncadas antes da injeção dos golpes de 600: é o que tira o ultimate de quem
  // deixou de ser última evolução (Vigoroth, Shelgon), igual ao servidor.
  mod.evolucoes.aplicarCadeiasTruncadas(lista);
  mod.evolucoes.normalizarEvolveLevel600(lista);
  // Os ajustes de huntLevel por cima do espelho (Rhydon, Lucario, Smeargle…) mudam o XP e o ouro
  // por abate dessas espécies: o cliente aplica aqui, nós também.
  mod.ajustes?.aplicarAjustesHuntLevel?.((id) => lista.find((c) => c.pokeId === id));

  const especies = new Map();
  for (const c of lista) {
    if (mod.outland.isEspelhoFantasmaPokeId(c.pokeId)) continue;
    mod.especiais.injetarGolpesEspeciais(c);
    especies.set(c.pokeId, c);
  }
  mod.golpesOrre.herdarGolpesOrre(lista);
  if (evolucoes) {
    // Depois dos golpes, como no cliente: estes passos escrevem `evolveLevel`/`evolvesToId`, e o teto
    // de captura tem de rodar por último entre eles (é ele quem alinha os degraus de evolução à escada).
    mod.evolucoes.aplicarEvolucoesEntreGeracoes(lista);
    mod.ramificadas.alinharNivelPadraoRamificado(lista);
    mod.evolucoes.corrigirNiveisDeEvolucao(lista);
    mod.tetoCaptura.aplicarTetoDeCaptura(lista, (id) => especies.get(id));
  }
  for (const mega of mod.megas.criarEspeciesMega(lista)) especies.set(mega.pokeId, mega);
  return especies;
}

/**
 * Carrega o jogo inteiro do snapshot: módulos, catálogo montado, constantes, versão e o ritmo por
 * mapa do simulador do jogo (`ritmo-do-jogo.json`; sem ele, o motor usa um tempo padrão por abate).
 * `{ mod, especies, constantes, versao, atualizadoEm, ritmo }`.
 */
export async function carregarJogo({ importar, lerJson } = carregadoresDoSite, { evolucoes = false } = {}) {
  const [pares, cr, novos, outlandNovos, formas, overrides, constantes, versao, ritmo] = await Promise.all([
    Promise.all(Object.entries(MODULOS).map(async ([k, rel]) => [k, await importar(rel)])),
    lerJson(CATALOGOS.cr.caminho),
    lerJson(CATALOGOS.novos.caminho),
    lerJson(CATALOGOS.outlandNovos.caminho),
    lerJson(CATALOGOS.formas.caminho),
    lerJson(CATALOGOS.overrides.caminho),
    lerJson('constantes.json'),
    lerJson('versao.json'),
    lerJson('ritmo-do-jogo.json'),
  ]);
  if (!cr) throw new Error('o snapshot do jogo não tem assets/creatures.json');
  if (!constantes?.tabelaTipos) throw new Error('o snapshot do jogo não tem constantes.json com a tabela de tipos');
  const mod = Object.fromEntries(pares);
  return {
    mod,
    especies: montarCatalogo(mod, { cr, novos, outlandNovos, formas, overrides }, { evolucoes }),
    constantes,
    versao: versao?.versao ?? null,
    atualizadoEm: versao?.atualizadoEm ?? null,
    ritmo: ritmo ?? null,
  };
}
