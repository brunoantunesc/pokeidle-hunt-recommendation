
































































export const FRAGMENTO_OVO_SHINY_ID = 70017;


export const OVO_SHINY_ITEM_ID = 70094;


export const CUSTO_FRAGMENTOS_OVO_SHINY = 10;





export const HORAS_OVO_SHINY = 48;





export const CHANCE_FRAGMENTO_OVO_SHINY_BASE = 1 / 150_000;


export const PASSO_RELATIVO_OVO_SHINY = 0.04;


export const CHANCE_FRAGMENTO_OVO_SHINY_PASSO = CHANCE_FRAGMENTO_OVO_SHINY_BASE * PASSO_RELATIVO_OVO_SHINY;


export const NIVEL_MIN_FRAGMENTO_OVO_SHINY = 5000;







export const DEGRAUS_FRAGMENTO_OVO_SHINY = Object.freeze([

  5000, 5400, 5900, 6400, 6950, 8000, 8600,

  10000, 11250, 12750, 14350, 16000, 20000, 21200,

  25000, 26150, 27500, 28950, 30450, 35150,

  40000, 42800, 46150, 49650, 53350, 64950,

  75000, 84650, 95950, 108000, 120550, 160300,
]);







const PORTAS_REGIAO = Object.freeze([
  { regiao: 'paldea', nivel: 75000 },
  { regiao: 'galar', nivel: 40000 },
  { regiao: 'alola', nivel: 25000 },
  { regiao: 'kalos', nivel: 10000 },
  { regiao: 'unova', nivel: NIVEL_MIN_FRAGMENTO_OVO_SHINY },
]);





export function degrauFragmentoOvoShiny(nivelHunt) {
  const n = Number(nivelHunt);
  if (!Number.isFinite(n) || n < NIVEL_MIN_FRAGMENTO_OVO_SHINY) return 0;
  let d = 0;
  for (const nivel of DEGRAUS_FRAGMENTO_OVO_SHINY) {
    if (nivel > n) break;
    d++;
  }
  return d;
}







export function chanceFragmentoOvoShiny(hunt) {
  if (!hunt || hunt.area === 'outland') return 0;
  return chanceDoDegrauOvoShiny(degrauFragmentoOvoShiny(hunt.nivel));
}


export function chanceDoDegrauOvoShiny(degrau) {
  return degrau > 0 ? CHANCE_FRAGMENTO_OVO_SHINY_BASE + (degrau - 1) * CHANCE_FRAGMENTO_OVO_SHINY_PASSO : 0;
}


export function regiaoDoNivelOvoShiny(nivelHunt) {
  const n = Number(nivelHunt);
  return PORTAS_REGIAO.find((p) => n >= p.nivel)?.regiao ?? null;
}





export function tabelaFragmentoOvoShiny() {
  return DEGRAUS_FRAGMENTO_OVO_SHINY.map((nivel, i) => ({
    nivel,
    degrau: i + 1,
    chance: chanceDoDegrauOvoShiny(i + 1),
    regiao: regiaoDoNivelOvoShiny(nivel),
  }));
}
