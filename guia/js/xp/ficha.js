// Lê a ficha de um pokémon colada do jogo e devolve o que a calculadora precisa.
//
// Dois formatos: o texto da própria tela da ficha (selecionar do nome até "Stats-base da
// espécie" e copiar) e a cópia do botão "Copiar p/ ChatGPT" (markdown, sem TM nem AoE). Na tela,
// o shiny vem como prefixo "✨ Shiny" no nome, o refino como "+N" depois dele, o TM elemental como
// o tipo repetido logo depois dos tipos, e o AoE como a palavra "AoE".
const TIPOS = new Set(['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY']);
const STAT = { HP: 'hp', ATK: 'atk', DEF: 'def', 'SP.ATK': 'spAtk', 'SP.DEF': 'spDef', SPD: 'speed' };
const STATS = Object.values(STAT);

const numPt = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const numEn = (s) => Number(String(s).replace(/,/g, ''));
const chave = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function acharEspecie(nome, especies) {
  const k = chave(nome);
  if (!k) return null;
  return especies.find((e) => chave(e.nome) === k) ?? null;
}

/** `especies`: lista de `{ pokeId, nome, tipos }`. Devolve `{ ok: true, ... }` ou `{ ok: false, erro }`. */
export function lerFicha(texto, especies) {
  const limpo = String(texto ?? '').replace(/ /g, ' ');
  if (!limpo.trim()) return { ok: false, erro: 'Cole o texto da ficha.' };
  const gpt = /ficha do PokeIdle|PokeIdle sheet|ficha de PokeIdle|^- (Esp[ée]cie|Species):/m.test(limpo);
  return gpt ? lerGpt(limpo, especies) : lerPagina(limpo, especies);
}

function lerPagina(texto, especies) {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const iNv = linhas.findIndex((l) => /^(Nv|Lv)\.?\s+[\d.,]+$/i.test(l));
  if (iNv < 1) return { ok: false, erro: 'Não achei a linha "Nv …" logo abaixo do nome. Copie a ficha do nome até "Stats-base da espécie".' };
  const nivel = Math.floor(numPt(linhas[iNv].replace(/^(Nv|Lv)\.?\s+/i, '')));
  const avisos = [];

  let nome = linhas[iNv - 1];
  let shiny = false;
  if (/^✨?\s*shiny\b/i.test(nome)) { shiny = true; nome = nome.replace(/^✨?\s*shiny\s*/i, ''); }
  const refino = /\+(\d+)$/.exec(nome);
  const refinoTotal = refino ? Number(refino[1]) : 0;
  nome = nome.replace(/\s*\+\d+$/, '').trim();

  // Entre o "Nv" e a "Potência": os tipos, os selos (shiny, TM, AoE) e o que mais a ficha ponha ali.
  const tipos = [];
  let tmElemental = null;
  let tmAoe = false;
  for (let i = iNv + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^pot[êe]nc(ia|y)$/i.test(l)) break;
    const t = l.toUpperCase();
    if (TIPOS.has(t)) {
      if (tipos.includes(t)) tmElemental = t; else if (tipos.length < 2) tipos.push(t); else tmElemental = t;
    } else if (/^aoe$/i.test(l)) tmAoe = true;
    else if (/shiny/i.test(l)) shiny = true;
  }

  const depoisDe = (re) => { const i = linhas.findIndex((l) => re.test(l)); return i >= 0 ? linhas[i + 1] ?? '' : ''; };
  const pot = /^P([1-5])$/i.exec(depoisDe(/^pot[êe]nc(ia|y)$/i));
  const potencia = pot ? Number(pot[1]) : null;
  const q = depoisDe(/^(qualidade|quality|calidad)$/i);
  const qualidade = /^[\d.,]+$/.test(q) ? numPt(q) : null;

  const stats = {};
  const ivs = {};
  const re = /^(HP|ATK|DEF|SP\.ATK|SP\.DEF|SPD)\n([\d.]+)\nIV\s+(\d+)$/gm;
  for (const m of linhas.join('\n').matchAll(re)) { stats[STAT[m[1]]] = numPt(m[2]); ivs[STAT[m[1]]] = Number(m[3]); }
  const temStats = STATS.every((k) => Number(stats[k]) > 0);
  const temIvs = STATS.every((k) => Number(ivs[k]) >= 1);
  if (!temStats) avisos.push('não achei os seis "Stats atuais" com IV; os stats serão calculados pelo nascimento.');

  let especie = acharEspecie(nome, especies);
  if (!especie) {
    const apelido = linhas.find((l) => /^(esp[ée]cie|species):/i.test(l));
    if (apelido) especie = acharEspecie(apelido.replace(/^[^:]+:\s*/, ''), especies);
  }
  if (!especie) return { ok: false, erro: `Não achei "${nome}" no catálogo de espécies. Confira se copiou a partir do nome do pokémon.` };
  if (tmElemental && !especie.tipos.includes(tmElemental)) avisos.push(`o TM ${tmElemental} não é de um tipo do ${especie.nome}: ficou de fora.`);

  return {
    ok: true, formato: 'pagina', especie, nome: especie.nome, nivel, tipos, shiny,
    tmElemental: tmElemental && especie.tipos.includes(tmElemental) ? tmElemental : null, tmAoe,
    potencia, qualidade, ivs: temIvs ? ivs : null, stats: temStats ? stats : null, refinoTotal, avisos,
  };
}

function lerGpt(texto, especies) {
  const avisos = [];
  const esp = /^- (?:Esp[ée]cie|Species):\s*(.+?)(?:\s*\(#\d+\))?(?:\s*—\s*(.+))?\s*$/m.exec(texto);
  if (!esp) return { ok: false, erro: 'Não achei a linha "Espécie:" da cópia para ChatGPT.' };
  const especie = acharEspecie(esp[1], especies);
  if (!especie) return { ok: false, erro: `Não achei "${esp[1]}" no catálogo de espécies.` };
  const tipos = (esp[2] ?? '').split('/').map((t) => t.trim().toUpperCase()).filter((t) => TIPOS.has(t));
  const shiny = /^- Shiny:\s*(sim|yes|s[íi])/mi.test(texto);
  const nv = /^- (?:N[ií]vel|Level):\s*([\d,.]+)/m.exec(texto);
  const nivel = nv ? Math.floor(numEn(nv[1])) : null;
  if (!nivel) return { ok: false, erro: 'Não achei o nível na cópia para ChatGPT.' };
  const pot = /^- Pot[êe]nc(?:ia|y):\s*P([1-5])/m.exec(texto);
  const q = /^- (?:Qualidade|Quality|Calidad):\s*([\d.]+)/m.exec(texto);

  // A tabela: o cabeçalho diz quais colunas vieram (refino, IV e stat atual são opcionais).
  const cabecalho = /^\|\s*(?:Stat)\s*\|(.+)\|\s*$/m.exec(texto);
  const colunas = cabecalho ? cabecalho[1].split('|').map((c) => c.trim()) : [];
  const iIv = colunas.findIndex((c) => /^IV\b/i.test(c));
  const iAtual = colunas.findIndex((c) => /atual|current|actual/i.test(c));
  const stats = {};
  const ivs = {};
  for (const m of texto.matchAll(/^\|\s*(HP|ATK|DEF|SP\.ATK|SP\.DEF|SPD)\s*\|(.+)\|\s*$/gm)) {
    const cels = m[2].split('|').map((c) => c.trim());
    if (iIv >= 0) ivs[STAT[m[1]]] = Number(cels[iIv]);
    if (iAtual >= 0) stats[STAT[m[1]]] = numEn(cels[iAtual]);
  }
  const temStats = STATS.every((k) => Number(stats[k]) > 0);
  const temIvs = STATS.every((k) => Number(ivs[k]) >= 1);
  if (!temStats) avisos.push('a cópia não traz o stat atual de cada stat; eles serão calculados pelo nascimento.');
  return {
    ok: true, formato: 'gpt', especie, nome: especie.nome, nivel, tipos, shiny, tmElemental: null, tmAoe: false,
    potencia: pot ? Number(pot[1]) : null, qualidade: q ? Number(q[1]) : null,
    ivs: temIvs ? ivs : null, stats: temStats ? stats : null, refinoTotal: 0, avisos,
  };
}
