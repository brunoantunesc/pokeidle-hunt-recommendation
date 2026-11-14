// A fachada que a tela e o worker usam: do que o jogador digitou até o resultado do motor.
import { analisar } from './motor.js';
import { estadoDoTreinador } from './bonus.js';
import { montarPokemon } from './stats.js';

/**
 * `jogo` é o que `carregarJogo` devolve; `hunts`, o que `prepararHunts` devolve.
 * `pokemon`: { esp, nascimento, statsInformados?, nivelDosStats? }. `bola`: o id da bola do Shiny/h (a tela escolhe;
 * entra como a marcada no arremesso automático).
 */
export function criarSimulador(jogo, hunts) {
  const c = jogo.constantes;
  const consts = {
    tabelaTipos: c.tabelaTipos,
    ampliacaoHunt: c.cliente?.ampliacaoHunt,
    multHpSelvagem: c.cliente?.multHpSelvagem,
    multDanoSelvagem: c.cliente?.multDanoSelvagem,
    tiposBoost: c.tiposBoost ?? [],
    // A captura (Shiny/h): as bolas, a fórmula e quem tem arte Shiny, do welcome capturado (scripts/importar-hunts.mjs).
    catalogoBolas: c.bolas ?? [],
    captura: c.captura ?? c.cliente?.captura,
    chanceShiny: c.chanceShiny,
    shinyLooks: c.shinyLooks ?? null,
  };

  function analisarHunts({ pokemon, nivelPokemon, nivelTreinador, escolhas = {}, hunts: subconjunto = hunts, soLiberadas = true, ordem = 'xp', comPocao = true, tipoDoDia = null, bola = null }) {
    // O disco de AoE é do pokémon (a ficha do /hunt diz se ele tem); o "Vale a pena?" não o passa.
    const pk = { ...montarPokemon({ ...pokemon, level: nivelPokemon }, jogo.mod), tmAoe: !!pokemon.tmAoe };
    const eu = estadoDoTreinador(escolhas, nivelTreinador, jogo);
    if (bola != null) Object.assign(eu, { automation: { ...eu.automation, ballIds: [Number(bola)] }, balls: { ...eu.balls, [bola]: 1 } });
    const ctx = { mod: jogo.mod, especies: jogo.especies, hunts: subconjunto, consts, eu, ritmo: jogo.ritmo };
    return analisar(pk, ctx, { soLiberadas, ordem, comPocao, tipoDoDia });
  }

  return { analisarHunts, hunts, jogo, consts };
}
