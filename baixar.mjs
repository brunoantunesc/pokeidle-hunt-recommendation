import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = new URL('https://pokeidleguide.io/');
const vistos = new Set();

function baixar(url, opcional = false) {
  if (url.origin !== site.origin) throw new Error('Dependência fora do guia: ' + url);
  if (vistos.has(url.href)) return;
  vistos.add(url.href);

  const resposta = spawnSync('curl.exe', ['-fsSL', '--max-time', '25', url.href], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (resposta.status !== 0) {
    if (opcional && /404/.test(resposta.stderr)) return;
    throw new Error('Falha ao baixar ' + url + ': ' + (resposta.error ?? resposta.stderr));
  }

  const destino = fileURLToPath(new URL('./guia' + url.pathname, import.meta.url));
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, resposta.stdout);

  if (/\.m?js$/.test(url.pathname)) {
    for (const [, caminho] of resposta.stdout.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      baixar(new URL(caminho, url));
    }
  }
}

for (const caminho of ['js/hunt/worker.js', 'js/hunt/worker-cliente.js', 'js/xp/ficha.js']) {
  baixar(new URL(caminho, site));
}
const { MODULOS, CATALOGOS, caminhoNoSnapshot } = await import('./guia/js/jogo/modulos.js');
const dados = new URL('data/jogo/', site);
for (const caminho of Object.values(MODULOS)) {
  baixar(new URL(caminhoNoSnapshot(caminho), dados));
}
for (const chave of ['cr', 'novos', 'outlandNovos', 'formas', 'overrides']) {
  const { caminho, opcional } = CATALOGOS[chave];
  baixar(new URL(caminho, dados), opcional);
}
for (const nome of ['hunts', 'constantes', 'versao', 'ritmo-do-jogo']) {
  baixar(new URL(nome + '.json', dados));
}
await import('./ajustar-motor.mjs');
console.log('Snapshot do guia baixado.');

