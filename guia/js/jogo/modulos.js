// O que o site precisa do jogo, e de onde vem — a lista única que o snapshot (`scripts/
// atualizar-jogo.mjs`) baixa e o site carrega. Caminhos relativos à raiz do pokeidle.io.
//
// Nada de tabela copiada: a curva de XP, o XP e o ouro por abate, a tabela de tipos, os
// multiplicadores dos bônus, a fórmula de stats e as recargas dos golpes são os próprios módulos
// `shared/` do jogo (mais o que eles importam).
// Quando o jogo muda um número, o snapshot seguinte traz a mudança e os testes dizem se a conta
// continua de pé.

export const MODULOS = {
  cooldown: 'shared/cooldown-golpes.mjs',
  nota: 'shared/nota-pokemon.mjs',
  mistico: 'shared/mistico.mjs',
  especiais: 'shared/golpes-especiais.mjs',
  planilhas: 'shared/golpes-planilhas.mjs',
  outland: 'shared/outland.mjs',
  baseOutland: 'shared/herdar-base-outland.mjs',
  golpesOrre: 'shared/herdar-golpes-orre.mjs',
  megas: 'shared/megas.mjs',
  evolucoes: 'shared/evolucoes-cruzadas.mjs',
  ramificadas: 'shared/evolucoes-ramificadas.mjs',
  tetoCaptura: 'shared/teto-captura.mjs',
  capturaDegrau: 'shared/captura-degrau.mjs',
  ovoShiny: 'shared/ovo-shiny.mjs',
  recompensa: 'shared/recompensa-hunt.mjs',
  ajustes: 'shared/ajustes-especie-espelho.mjs',
  atrasados: 'shared/boost-atrasados.mjs',
  guildBoost: 'shared/guild-boost.mjs',
  guildPremios: 'shared/guild-premios.mjs',
  sazonal: 'shared/dia-sazonal.mjs',
  analyser: 'hunt-analyser.mjs',
};

export const CATALOGOS = {
  cr: { caminho: 'assets/creatures.json', opcional: false },
  novos: { caminho: 'assets/creatures-novos.json', opcional: true },
  outlandNovos: { caminho: 'assets/creatures-outland-novos.json', opcional: true },
  formas: { caminho: 'assets/creatures-formas.json', opcional: true },
  overrides: { caminho: 'assets/creatures-audit-overrides.json', opcional: true },
  // O motor não lê mais os preços (o loot de venda ao NPC saiu do jogo em 15/10/2026); o arquivo
  // fica no snapshot porque `scripts/atualizar-sprites-itens.mjs` tira dele os ícones do Mercado.
  itens: { caminho: 'assets/items.json', opcional: true },
};

/**
 * Onde um módulo do jogo fica dentro do snapshot. Os da raiz do site (`hunt-analyser.mjs`)
 * importam `../shared/…`; no jogo isso resolve para `/shared/` porque não dá para subir acima da
 * raiz. Aqui eles ficam um nível abaixo (`raiz/`) para o mesmo caminho relativo fechar.
 */
export const caminhoNoSnapshot = (rel) => (rel.includes('/') ? rel : `raiz/${rel}`);
