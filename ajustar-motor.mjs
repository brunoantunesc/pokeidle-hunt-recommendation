import { readFileSync, writeFileSync } from 'node:fs';

const ajustes = [
  ['jogo/motor.js', 'const lutas = [];', 'const lutas = [];\n  const shinyPorEspecie = [];'],
  ['jogo/motor.js', 'if (temShiny(esp.pokeId, cap.looks)) shiny += w * p * cap.chanceShiny * cap.multShiny;', `if (temShiny(esp.pokeId, cap.looks)) {
        const chance = w * p * cap.chanceShiny * cap.multShiny;
        shiny += chance;
        shinyPorEspecie.push({ pokeId: esp.pokeId, chance });
      }`],
  ['jogo/motor.js', 'shinyH: kphEf * shiny,', 'shinyH: kphEf * shiny, shinyPorEspecie: shinyPorEspecie.map(({ pokeId, chance }) => ({ pokeId, porHora: kphEf * chance })),'],
  ['hunt/worker.js', 'shinyH: l.shinyH ?? 0,', 'shinyH: l.shinyH ?? 0, shinyPorEspecie: l.shinyPorEspecie ?? [],'],
];

for (const [arquivo, original, novo] of ajustes) {
  const url = new URL('./guia/js/' + arquivo, import.meta.url);
  const texto = readFileSync(url, 'utf8');
  if (texto.includes(novo)) continue;
  if (texto.split(original).length !== 2) throw new Error('O motor mudou: ' + arquivo);
  writeFileSync(url, texto.replace(original, novo));
}
