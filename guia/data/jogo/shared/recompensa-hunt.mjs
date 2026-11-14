
import { ouroDoNivel, xpDoNivel, ouroPorKillDoNivel, TETO_OURO_KILL, NIVEL_TETO_OURO } from './sell-value.mjs';

export { ouroDoNivel, xpDoNivel };













export function xpPorDerrota(hunt, nivelMob, especie) {
  return xpDoNivel(nivelMob);
}







































export const FRACAO_BONUS_LOOT = 0.15;


export const EXPOENTE_RENDA = 0.30;


export function alvoRendaPorKill(nivel) {
  const n = Math.max(1, Number(nivel) || 1);
  const base = n <= NIVEL_TETO_OURO
    ? ouroPorKillDoNivel(n)
    : TETO_OURO_KILL * (n / NIVEL_TETO_OURO) ** EXPOENTE_RENDA;
  return Math.round(base * (1 + FRACAO_BONUS_LOOT));
}





export function ouroDoLootPorKill(nivel, bonusLootPct = 0) {
  const base = Math.max(0, alvoRendaPorKill(nivel) - ouroPorKillDoNivel(nivel));
  const bonus = Math.max(0, Number(bonusLootPct) || 0);
  return Math.round(base * (1 + bonus / 100));
}





export function ouroDoAbate(nivelMob, bonusLootPct = 0) {
  const base = ouroPorKillDoNivel(nivelMob);
  const loot = ouroDoLootPorKill(nivelMob, bonusLootPct);
  return { base, loot, total: base + loot };
}














export function ouroPorDerrotaHunt(hunt, nivelMob, especie, bonusLootPct = 0) {
  return ouroDoAbate(nivelMob, bonusLootPct).total;
}
