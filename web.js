import { calcularRecomendacoes } from './recomendacao.js';
import { carregarBastPorHunt } from './bast.js';
import { criarClienteDoMotor } from './guia/js/hunt/worker-cliente.js';
import { lerFicha } from './guia/js/xp/ficha.js';

const form = document.querySelector('#hunt');
const status = document.querySelector('#status');
const run = document.querySelector('#run');
const results = document.querySelector('#results');
const rows = document.querySelector('#rows');
const sort = document.querySelector('#sort');
const motor = criarClienteDoMotor();
const metrics = [
  ['recomendacao', 'Recomendação'],
  ['xpPokemonH', 'XP/h'],
  ['ouroH', 'Ouro/h'],
  ['kph', 'Abates/h'],
  ['bastFinal', 'BAST final'],
];

const metricHelp = {
  recomendacao: 'O XP/h vale até 70 pontos, em proporção à melhor hunt liberada e viável. O BAST final soma ou desconta até 30 pontos. O valor 550 é neutro, e a maior distância de 550 entre as hunts liberadas e viáveis define a escala do ajuste.',
  bastFinal: 'É a soma de HP, ATK, DEF, SPATK, SPDEF e Speed da forma final mais forte entre os Pokémon da hunt. O cálculo inclui as formas Mega disponíveis. O nome entre parênteses indica a forma usada.',
};
const helpDialog = document.querySelector('#metric-help');
const helpTitle = document.querySelector('#metric-help-title');
const helpText = document.querySelector('#metric-help-text');

for (const [key, label] of metrics) {
  sort.add(new Option(label, key));
  const header = document.createElement('th');
  header.scope = 'col';
  header.textContent = label;
  if (metricHelp[key]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'metric-help-button';
    button.textContent = '?';
    button.setAttribute('aria-label', 'Como funciona ' + label);
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => {
      helpTitle.textContent = label;
      helpText.textContent = metricHelp[key];
      helpDialog.showModal();
    });
    header.append(button);
  }
  document.querySelector('#headers').append(header);
}
const usageHeader = document.createElement('th');
usageHeader.scope = 'col';
usageHeader.textContent = 'PvP usage';
document.querySelector('#headers').append(usageHeader);

sort.value = 'recomendacao';
for (const tipo of 'Normal Fire Water Grass Electric Ice Fighting Poison Ground Flying Psychic Bug Rock Ghost Dragon Dark Steel Fairy'.split(' ')) {
  form.elements.tipo.add(new Option(tipo, tipo));
}

const number = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 6 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const units = ['', 'k', 'm', 'b', 't'];

function formatMetric(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1000) return number.format(value);

  let unit = 0;
  while (Math.abs(value) >= 999.995 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return compact.format(value) + units[unit];
}
let linhas = [];

function render() {
  const key = sort.value;
  const fragment = document.createDocumentFragment();
  const ordenadas = linhas.slice().sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
  for (const linha of ordenadas.slice(0, 10)) {
    const row = document.createElement('tr');
    const nome = linha.nome + (linha.liberada ? '' : ' (bloqueada)');
    const mapa = linha.regiao ? linha.regiao[0].toLocaleUpperCase('pt-BR') + linha.regiao.slice(1) : '—';
    const valores = [nome, mapa, linha.nivel, ...metrics.map(([campo]) => {
      if (campo === 'bastFinal' && linha.melhorCaptura) {
        return linha.bastFinal + ' (' + linha.melhorCaptura.evolucao + ')';
      }
      const valor = linha[campo];
      if (campo === 'recomendacao' && Number.isFinite(valor)) return compact.format(valor) + ' pts';
      return campo === 'kph' && Number.isFinite(valor) ? integer.format(valor) : formatMetric(valor);
    }), linha.melhorCaptura?.usoPvp ?? '—'];
    for (const valor of valores) row.insertCell().textContent = valor;
    if (linha.recomendacao != null) {
      row.cells[3 + metrics.findIndex(([campo]) => campo === 'recomendacao')].title =
        'XP: ' + compact.format(linha.pontosXp) + ' pts | BAST: ' + compact.format(linha.pontosBast) + ' pts';
    }
    fragment.append(row);
  }
  rows.replaceChildren(fragment);
}

sort.addEventListener('change', render);

const back = document.querySelector('#back');
const main = form.closest('main');
const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
let mudandoTela = false;

async function trocarTela(anterior, proxima, foco, mensagem) {
  if (mudandoTela) return;
  mudandoTela = true;
  main.inert = true;
  try {
    if (!movimentoReduzido.matches) {
      await main.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 140, easing: 'ease-in', fill: 'forwards',
      }).finished.then((animacao) => animacao.cancel());
    }
    anterior.hidden = true;
    proxima.hidden = false;
    status.textContent = mensagem;
    window.scrollTo(0, 0);
    if (!movimentoReduzido.matches) {
      await main.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 220, easing: 'ease-out',
      }).finished;
    }
  } finally {
    main.inert = false;
    mudandoTela = false;
    foco.focus({ preventScroll: true });
  }
}

back.addEventListener('click', () => trocarTela(results, form, run, ''));

try {
  const [dados, { porHunt }] = await Promise.all([motor.chamar('carregar'), carregarBastPorHunt()]);
  for (const bola of dados.bolas) form.elements.bola.add(new Option(bola.nome, bola.id));
  status.textContent = dados.hunts.total + ' hunts disponíveis.';
  run.disabled = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const entrada = new FormData(form);
    const ficha = lerFicha(entrada.get('ficha'), dados.especies);
    results.hidden = true;
    if (!ficha.ok) {
      status.textContent = ficha.erro;
      return;
    }
    run.disabled = true;
    status.textContent = 'Simulando…';
    try {
      const aoe = entrada.get('aoe');
      const ranking = await motor.chamar('ranking', {
        ficha,
        nivelTreinador: Number(entrada.get('nivel')),
        soLiberadas: entrada.has('liberadas'),
        comPocao: true,
        tipoDoDia: entrada.get('tipo') || null,
        bola: entrada.get('bola') || null,
        aoe: aoe ? aoe === 'sim' : !!ficha.tmAoe,
      });
      linhas = calcularRecomendacoes(ranking.linhas.map((linha) => {
        const melhorCaptura = porHunt.get(linha.slug);
        return { ...linha, melhorCaptura, bastFinal: melhorCaptura?.total };
      }));
      render();
      if (linhas.length) {
        const mensagem = 'Exibindo ' + Math.min(10, linhas.length) + ' de ' + linhas.length + ' hunts para ' + ficha.nome + '.';
        await trocarTela(form, results, back, mensagem);
      } else {
        status.textContent = 'Nenhuma hunt encontrada.';
      }
    } catch (erro) {
      status.textContent = erro.message ?? String(erro);
    } finally {
      run.disabled = false;
    }
  });
} catch (erro) {
  status.textContent = 'Falha ao carregar o motor: ' + (erro.message ?? erro);
}
