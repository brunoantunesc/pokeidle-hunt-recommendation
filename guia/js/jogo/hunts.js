// As hunts do jogo prontas para o motor: `{ slug, nome, regiao, nivel, especies: [{ pokeId, pontos }] }`.
//
// O arquivo vem do `welcome` (ver scripts/importar-hunts.mjs). O que se ajusta aqui é só o id
// legado da Outland (10501+), que o próprio módulo do jogo converte para a faixa normalizada
// (2001+) — o catálogo só conhece a normalizada.
export function prepararHunts(dados, jogo) {
  const remap = jogo.mod.outland;
  const hunts = [];
  const semEspecie = [];
  for (const h of dados.hunts ?? []) {
    const especies = (h.especies ?? [])
      .map((e) => ({ pokeId: remap.isOutlandPokeIdLegado(e.pokeId) ? remap.remapOutlandPokeId(e.pokeId) : e.pokeId, pontos: Number(e.pontos) || 0 }))
      .filter((e) => e.pontos > 0);
    if (!especies.length || !especies.every((e) => jogo.especies.has(e.pokeId))) { semEspecie.push(h.slug); continue; }
    hunts.push({ slug: h.slug, nome: h.nome ?? h.slug, regiao: h.regiao ?? null, nivel: Number(h.nivel) || 1, especies });
  }
  hunts.sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome));
  return { hunts, semEspecie, provisorio: !!dados.provisorio, origem: dados._origem ?? null };
}

/** Rótulo da região como a Pokédex do site escreve. */
export const nomeDaRegiao = (r) => (r ? String(r).charAt(0).toUpperCase() + String(r).slice(1) : '');
