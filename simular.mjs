import { readFile } from 'node:fs/promises';

async function main() {
  const [arquivo, nivel, ...opcoes] = process.argv.slice(2);
  if (!arquivo || !Number.isSafeInteger(Number(nivel)) || Number(nivel) < 1) {
    throw new Error('Uso: node simular.mjs ficha.txt NIVEL [--todas] [--aoe|--sem-aoe] [--tipo=Fire] [--bola=ID]');
  }
  const texto = await readFile(arquivo, 'utf8');
  const { lerFicha } = await import('./guia/js/xp/ficha.js');

  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opcoes) => {
    if (new URL(url).protocol !== 'file:') return fetchOriginal(url, opcoes);
    try {
      return new Response(await readFile(url));
    } catch (erro) {
      if (erro.code !== 'ENOENT') throw erro;
      return new Response(null, { status: 404 });
    }
  };

  // Adaptador mínimo para executar o Web Worker original no Node.
  const worker = {};
  globalThis.self = worker;
  try {
    await import('./guia/js/hunt/worker.js');
    async function chamar(tipo, entrada) {
      let resposta;
      worker.postMessage = (mensagem) => {
        if ('ok' in mensagem) resposta = mensagem;
      };
      await worker.onmessage({ data: { id: 1, tipo, entrada } });
      if (!resposta?.ok) throw new Error(resposta?.erro ?? 'O motor não retornou um resultado.');
      return resposta.dados;
    }

    const dados = await chamar('carregar');
    const ficha = lerFicha(texto, dados.especies);
    if (!ficha.ok) throw new Error(ficha.erro);

    const tipoDoDia = opcoes.find((opcao) => opcao.startsWith('--tipo='))?.slice(7);
    const idBola = opcoes.find((opcao) => opcao.startsWith('--bola='))?.slice(7);
    const bola = idBola == null ? null : Number(idBola);
    if (bola != null && !dados.bolas.some((item) => Number(item.id) === bola)) {
      throw new Error('Bola inválida. Opções: ' + dados.bolas.map((item) => item.id + ' ' + item.nome).join(', '));
    }

    const ranking = await chamar('ranking', {
      ficha,
      nivelTreinador: Number(nivel),
      soLiberadas: !opcoes.includes('--todas'),
      comPocao: true,
      tipoDoDia,
      bola,
      aoe: opcoes.includes('--aoe') || (!opcoes.includes('--sem-aoe') && !!ficha.tmAoe),
    });
    console.log(JSON.stringify({ versao: dados.versao, ...ranking }, null, 2));
  } finally {
    globalThis.fetch = fetchOriginal;
    delete globalThis.self;
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
