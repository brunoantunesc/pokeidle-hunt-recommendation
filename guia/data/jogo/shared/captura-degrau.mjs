


































import { dexDe } from './escala-hunt-level.mjs';
import { DEX_LENDARIO_OU_MITICO } from './mistico.mjs';
import { dexBaseDaForma } from './formas.mjs';


export const FATOR_CAPTURA_DO_DEGRAU = Object.freeze({ 20: 2.8669, 40: 3.5745, 100: 4.4681 });


export const chaveDeHunt = (pokeId) => dexDe(Number(pokeId));


export function chavesEmHunt(hunts) {
  const chaves = new Set();
  for (const h of hunts ?? []) for (const e of h.especies ?? []) chaves.add(chaveDeHunt(e.pokeId));
  return chaves;
}

const dexBase = (id) => (id >= 13000 ? id % 1000 : dexBaseDaForma(id) ?? id);


export function capturaPeloDegrau(pokeId, chaves) {
  const id = Number(pokeId);
  if (!Number.isFinite(id) || !chaves?.has(chaveDeHunt(id))) return false;
  return !DEX_LENDARIO_OU_MITICO.has(dexBase(id));
}







export function fatorDeCaptura({ tetoCaptura, peloDegrau, preco, raridadeDiv = 17, porDegrau = FATOR_CAPTURA_DO_DEGRAU }) {
  if (peloDegrau) {
    const f = Number(porDegrau?.[tetoCaptura]) || Number(porDegrau?.[100]);
    return f > 0 ? f : FATOR_CAPTURA_DO_DEGRAU[100];
  }
  const raridade = Math.log10(Math.max(100, Number(preco) || 0)) - 1;
  return 1 + raridade ** 3 / raridadeDiv;
}
