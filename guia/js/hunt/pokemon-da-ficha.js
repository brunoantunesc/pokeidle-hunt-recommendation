// Da ficha colada ao pokémon que o motor lê: espécie, nível, IVs, qualidade, potência, shiny e,
// quando a ficha traz, os seis stats exatos (que valem mais que a fórmula). Os selos de AoE e TM
// Elemental (Z-Move) são lidos da ficha; o do AoE o worker do /hunt passa ao motor (estimativa), o do
// TM Elemental não entra na conta.
import { nascimentoMedio } from '../jogo/stats.js';

/** `ficha`: o resultado ok de `lerFicha`. Devolve `{ pokemon, nivelPokemon, resumo }` para o simulador. */
export function pokemonDaFicha(ficha, jogo) {
  const esp = jogo.especies.get(ficha.especie.pokeId);
  if (!esp) throw new Error(`espécie ${ficha.especie.pokeId} não está no catálogo`);
  const medio = nascimentoMedio(jogo.mod);
  const nascimento = {
    ivs: ficha.ivs ? { ...ficha.ivs } : { ...medio.ivs },
    qualidade: ficha.qualidade ?? medio.qualidade,
    potencia: ficha.potencia ?? medio.potencia,
    shiny: !!ficha.shiny,
    refino: { ...medio.refino },
  };
  return {
    pokemon: { esp, nascimento, statsInformados: ficha.stats ? { ...ficha.stats } : null, nivelDosStats: ficha.stats ? ficha.nivel : null },
    nivelPokemon: ficha.nivel,
    resumo: {
      pokeId: esp.pokeId, nome: esp.name, tipos: [esp.type1, esp.type2].filter(Boolean), nivel: ficha.nivel,
      potencia: nascimento.potencia, qualidade: nascimento.qualidade, ivs: nascimento.ivs,
      ivSomado: Object.values(nascimento.ivs).reduce((s, v) => s + v, 0), shiny: nascimento.shiny,
      statsDaFicha: !!ficha.stats, refinoTotal: ficha.refinoTotal ?? 0,
    },
  };
}
