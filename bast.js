import { carregarJogo, carregadoresDoSite } from './guia/js/jogo/catalogo.js';
import { prepararHunts } from './guia/js/jogo/hunts.js';
import { BASE_DE } from './guia/js/jogo/stats.js';

export function usoPvp(forma) {
  const defesaMedia = (forma.baseDef + forma.baseSpDef) / 2;
  const resistencia = Math.sqrt(forma.baseHp * defesaMedia);
  if (resistencia >= Math.max(forma.baseAtk, forma.baseSpAtk)) return 'Tank';
  return forma.baseSpAtk > forma.baseAtk ? 'SPATK' : 'ATK';
}

export async function carregarBastPorHunt(carregadores = carregadoresDoSite) {
  const [jogo, dados] = await Promise.all([
    carregarJogo(carregadores, { evolucoes: true }),
    carregadores.lerJson('hunts.json'),
  ]);
  const { hunts } = prepararHunts(dados, jogo);
  const buscar = (id) => jogo.especies.get(id);
  const campos = Object.values(BASE_DE);
  const porEspecie = new Map();
  const porHunt = new Map();

  for (const hunt of hunts) {
    let melhor;
    for (const { pokeId } of hunt.especies) {
      if (!porEspecie.has(pokeId)) {
        const especie = buscar(pokeId);
        const finais = jogo.mod.ramificadas.evolucoesFinais(especie, buscar);
        let melhorFinal;
        const formas = [];
        for (const final of finais.length ? finais : [especie]) {
          for (const mega of jogo.mod.megas.megasDaEspecie(final.pokeId)) {
            const forma = buscar(jogo.mod.megas.pokeIdDaMega(mega));
            if (forma) formas.push(forma);
          }
          formas.push(final);
        }
        for (const final of formas) {
          if (!campos.every((campo) => Number.isFinite(final[campo]))) continue;
          const total = campos.reduce((soma, campo) => soma + final[campo], 0);
          if (!melhorFinal || total > melhorFinal.total) {
            melhorFinal = { total, captura: especie.name, evolucao: final.name, usoPvp: usoPvp(final) };
          }
        }
        porEspecie.set(pokeId, melhorFinal);
      }
      const nota = porEspecie.get(pokeId);
      if (nota && (!melhor || nota.total > melhor.total)) melhor = nota;
    }
    if (melhor) porHunt.set(hunt.slug, melhor);
  }
  return { porHunt, porEspecie };
}
