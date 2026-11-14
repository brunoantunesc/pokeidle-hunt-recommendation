




















export const BONUS_RANKING_GP = { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, resto: 1 };


export const POSICOES_BONUS_GP = Object.keys(BONUS_RANKING_GP)
  .filter((k) => k !== 'resto')
  .map(Number)
  .sort((a, b) => a - b);


export const PRIMEIRA_POS_RESTO = POSICOES_BONUS_GP.length + 1;


export function bonusPctPorPosRanking(pos) {
  const p = Number(pos) || 0;
  if (p <= 0) return 0;
  return BONUS_RANKING_GP[p] ?? BONUS_RANKING_GP.resto;
}







export const BONUS_BOSS_RAID_MAX = 5;





export const DECIMOS_BONUS_RESERVA = 10;









export function bonusPctDoMembro(bonusPctDaGuild, escalado, decimosReserva = 0) {
  const boss = bonusBossRaidDosDecimos(decimosReserva);
  return escalado ? Math.max(0, Number(bonusPctDaGuild) || 0) + boss : boss;
}


export function bonusBossRaidDosDecimos(decimos) {
  const dec = Math.max(0, Math.round(Number(decimos) || 0));
  return Math.min(BONUS_BOSS_RAID_MAX, dec / DECIMOS_BONUS_RESERVA);
}





export const PREMIOS_GLOBAL = { 1: 100, 2: 50, 3: 35, 4: 25, 5: 20, 6: 15, 7: 10, 8: 5 };


export const PREMIADOS_GLOBAL = Object.keys(PREMIOS_GLOBAL).length;
