





















import { FUSO_BRASILIA_MS } from './fuso-brasilia.mjs';





export const TIPOS_SAZONAIS = Object.freeze([
  'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND',
  'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY',
]);


export const MULT_SAZONAL = 2;

const DIA_MS = 86_400_000;







export const ANTECIPACAO_SAZONAL_MS = 6 * 3_600_000;


const DESLOCAMENTO_MS = FUSO_BRASILIA_MS - ANTECIPACAO_SAZONAL_MS;


export const chaveDoDiaSazonal = (t) => new Date(Number(t) - DESLOCAMENTO_MS).toISOString().slice(0, 10);


export const inicioDoDiaSazonal = (t) => Math.floor((Number(t) - DESLOCAMENTO_MS) / DIA_MS) * DIA_MS + DESLOCAMENTO_MS;


export const fimDoDiaSazonal = (t) => inicioDoDiaSazonal(t) + DIA_MS;


export const ehDoTipoSazonal = (tipos, tipo) => !!tipo && Array.isArray(tipos) && tipos.includes(tipo);





export function multDanoSazonal(tipo, tiposAtacante, tiposDefensor) {
  if (!tipo) return 1;
  const ataca = ehDoTipoSazonal(tiposAtacante, tipo) ? MULT_SAZONAL : 1;
  const apanha = ehDoTipoSazonal(tiposDefensor, tipo) ? MULT_SAZONAL * MULT_SAZONAL : 1;
  return ataca / apanha;
}


export const danoSazonal = (dano, mult) => (mult === 1 ? dano : Math.max(dano > 0 ? 1 : 0, Math.round(dano * mult)));
