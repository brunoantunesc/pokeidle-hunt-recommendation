# Hunt Extension

Protótipo de linha de comando para Windows com Node.js 22. Usa o mesmo worker
e o mesmo snapshot de dados do /hunt do PokéIdle Guide.

Na pasta do projeto, salve a ficha copiada do jogo em `ficha.txt` e execute:

```powershell
node simular.mjs ficha.txt 100
```

Troque 100 pelo nível do treinador. A saída é JSON. Para salvar em um arquivo,
acrescente `> ranking.json`. Há uma ficha sintética em `ficha-exemplo.txt`.

Opções: `--todas` inclui hunts bloqueadas, `--tipo=Fire` aplica o tipo do dia,
`--bola=ID` escolhe uma bola e `--aoe` ou `--sem-aoe` substitui a seleção
automática da ficha.

O snapshot está na pasta `guia`. A simulação roda localmente. Para baixar os
arquivos atuais do guia, execute `node baixar.mjs`.

## Interface web

Na pasta do projeto, execute `npm start` e abra http://127.0.0.1:3000.
Cole a ficha, informe o nível do treinador e clique em Simular.
