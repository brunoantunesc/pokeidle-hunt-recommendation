




















































export const BOOST_GUILD = Object.freeze({

  pct: 10,
  dias: 7,

  icone: '/img/itens/boost-guild.png',
  iconeMini: '/img/itens/boost-guild-32.png',
});

export const BOOST_GUILD_MS = BOOST_GUILD.dias * 24 * 3600_000;
export const BOOST_GUILD_MULT = 1 + BOOST_GUILD.pct / 100;

export const BANCO_GUILD = Object.freeze({

  meta: 500,

  ref: 'guild_banco',

  atalhos: [10, 50, 100, 250],

  historico: 25,






  logMax: 5000,
});


export const boostGuildAtivo = (ate, agora) => (Number(ate) || 0) > agora;


export const multBoostGuild = (ate, agora) => (boostGuildAtivo(ate, agora) ? BOOST_GUILD_MULT : 1);








export const fimDoBoostGuild = (ate, agora) => Math.max(Number(ate) || 0, agora) + BOOST_GUILD_MS;






export const msDoBanco = (diamantes) => Math.round((BOOST_GUILD_MS * Math.max(0, Number(diamantes) || 0)) / BANCO_GUILD.meta);


export const saldoDoBanco = (saldo) => Math.min(BANCO_GUILD.meta - 1, Math.max(0, Math.floor(Number(saldo) || 0)));


export const faltaNoBanco = (saldo) => BANCO_GUILD.meta - saldoDoBanco(saldo);





export const doacaoValida = (qtd) =>
  typeof qtd === 'number' && Number.isSafeInteger(qtd) && qtd >= 1 && qtd <= BANCO_GUILD.meta;
