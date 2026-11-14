// As abas do mapa do jogo, na ordem em que ele as mostra (REGIOES_MAPA no cliente, jogo 1.380):
// a escada de temporadas. É a divisão que o jogador conhece, e a do /hunt.
//
// O jogo põe cada hunt na aba que o servidor manda em `regiao`. Sem ela, vale a `area` e, dentro
// da área, a geração da espécie com mais pontos de spawn: o welcome manda Kanto e Johto como
// `area: 'kanto'` (é o mesmo desenho de mapa), e só a geração separa as duas abas.
export const REGIOES_DO_MAPA = [
  { id: 'kanto', rotulo: 'Kanto', area: 'kanto', geracao: 'kanto' },
  { id: 'outland', rotulo: 'Outland', area: 'outland', geracao: null },
  { id: 'johto', rotulo: 'Johto', area: 'kanto', geracao: 'johto' },
  { id: 'hoenn', rotulo: 'Hoenn', area: 'orre', geracao: 'hoenn' },
  { id: 'sinnoh', rotulo: 'Sinnoh', area: 'orre', geracao: 'sinnoh' },
  { id: 'unova', rotulo: 'Unova', area: 'orre', geracao: 'unova' },
  { id: 'kalos', rotulo: 'Kalos', area: 'orre', geracao: 'kalos' },
  { id: 'alola', rotulo: 'Alola', area: 'orre', geracao: 'alola' },
  { id: 'galar', rotulo: 'Galar', area: 'orre', geracao: 'galar' },
  { id: 'paldea', rotulo: 'Paldea', area: 'orre', geracao: 'paldea' },
];

// O último número do dex nacional de cada geração. Os clones de Orre (13xxx) e a Outland (2001+)
// caem na faixa pelo `% 1000`, como no cliente.
const FIM_DA_GERACAO = [[151, 'kanto'], [251, 'johto'], [386, 'hoenn'], [493, 'sinnoh'], [649, 'unova'], [721, 'kalos'], [809, 'alola'], [905, 'galar'], [1025, 'paldea']];
export const geracaoDoPokeId = (id) => {
  const dex = id <= 1025 ? id : id % 1000;
  return FIM_DA_GERACAO.find(([fim]) => dex <= fim)?.[1] ?? null;
};

function geracaoDaHunt(h) {
  const peso = new Map();
  for (const e of h.especies ?? []) {
    const g = geracaoDoPokeId(Number(e.pokeId));
    if (g) peso.set(g, (peso.get(g) ?? 0) + (Number(e.pontos) || 1));
  }
  return [...peso].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** A aba do mapa em que o jogo mostra a hunt (`id` de REGIOES_DO_MAPA), ou a área se nenhuma aba casar. */
export function regiaoDoMapa(h) {
  if (h.regiao) return h.regiao;
  const ger = geracaoDaHunt(h);
  return REGIOES_DO_MAPA.find((r) => r.area === h.area && (r.geracao == null || r.geracao === ger))?.id ?? h.area ?? null;
}
