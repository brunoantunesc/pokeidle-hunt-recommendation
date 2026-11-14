















































export const ATRASADOS = {

  mult: 10,

  precoCheio: 1000,





  precoMinimo: 50,





  multMaximo: 10,

  diasAtivo: 7,

  diasConta: 30,

  minimoAmostra: 20,
};








export const xpTotalDoNivel = (L) => (L <= 1 ? 0 : Math.round((50 / 3) * (L ** 3 - 6 * L ** 2 + 17 * L - 12)));








export const PROMO_ATRASADOS = {

  desconto: 0.5,

  de: Date.UTC(2026, 10, 6, 3, 0, 0),

  ate: Date.UTC(2026, 10, 8, 3, 0, 0),
};


export const promoAtrasadosAtiva = (agora = Date.now()) =>
  Number(agora) >= PROMO_ATRASADOS.de && Number(agora) < PROMO_ATRASADOS.ate;








export function precoAtrasados(xpAtual, nivelAlvo, agora = Date.now()) {
  const alvo = xpTotalDoNivel(Math.floor(Number(nivelAlvo) || 0));
  const atual = Math.max(0, Number(xpAtual) || 0);
  if (!(alvo > 0) || atual >= alvo) return null;
  const normal = Math.max(ATRASADOS.precoMinimo, Math.ceil(ATRASADOS.precoCheio * ((alvo - atual) / alvo)));
  return promoAtrasadosAtiva(agora) ? Math.ceil(normal * (1 - PROMO_ATRASADOS.desconto)) : normal;
}







export const atrasadosAtivo = (boost, nivel) => {
  const alvo = Number(boost?.alvo);
  return Number.isSafeInteger(alvo) && alvo > (Math.floor(Number(nivel)) || 0);
};







export const multAtrasados = (boost, nivel) => {
  if (!atrasadosAtivo(boost, nivel)) return 1;
  const m = Number(boost.mult);
  if (!Number.isFinite(m) || m < 1) return ATRASADOS.mult;
  return Math.min(m, ATRASADOS.multMaximo);
};











export function ganhoAteOAlvo(quantidade, multT, multP, boost, nivel, xp) {
  const mA = multAtrasados(boost, nivel);
  if (mA > 1) {
    const falta = Math.max(0, xpTotalDoNivel(Number(boost.alvo)) - (Number(xp) || 0));
    const cheio = quantidade * multT;
    if (cheio > falta) {

      const f = falta / cheio;
      return {
        treinador: Math.round(falta + quantidade * (1 - f) * (multT / mA)),
        pokemon: Math.round(quantidade * multP * f + quantidade * (1 - f) * (multP / mA)),
      };
    }
  }
  return { treinador: Math.round(quantidade * multT), pokemon: Math.round(quantidade * multP) };
}
