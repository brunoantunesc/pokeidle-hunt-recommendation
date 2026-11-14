export function calcularRecomendacoes(linhas) {
  const elegiveis = linhas.filter((linha) => linha.liberada && !linha.inviavel);
  const melhorXp = Math.max(0, ...elegiveis.map((linha) => linha.xpPokemonH));
  const distanciaBast = (linha) => (linha.bastFinal ?? 550) - 550;
  const maiorDistancia = Math.max(0, ...elegiveis.map((linha) => Math.abs(distanciaBast(linha))));

  return linhas.map((linha) => {
    if (!linha.liberada || linha.inviavel) return linha;
    const pontosXp = melhorXp ? 70 * linha.xpPokemonH / melhorXp : 0;
    const pontosBast = maiorDistancia ? 30 * distanciaBast(linha) / maiorDistancia : 0;
    return { ...linha, recomendacao: pontosXp + pontosBast, pontosXp, pontosBast };
  });
}
