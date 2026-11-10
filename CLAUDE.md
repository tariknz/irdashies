# Overlay pessoal de iRacing — fork do irDashies + recursos do Kapps

## Contexto

App de overlays para iRacing de uso pessoal (Fernando, Windows, Logitech G29 + pedais SimJack).
Base: fork do **irDashies** (https://github.com/tariknz/irdashies), licença MIT.
Objetivo: manter tudo o que o irDashies já faz e somar os recursos que o Kapps oferece e o irDashies não tem.

## Regras

- Manter o arquivo LICENSE e o aviso de copyright do irDashies (exigência da licença MIT).
- Não usar código, imagens nem layouts do Kapps. Ele serve só de referência de funcionalidade.
- Frontend (`src/frontend/`) não importa nada de `src/app/`; a comunicação é por IPC, com tipos em `src/types/` (regra do projeto original).
- Toda feature nova precisa ter story no Storybook e configuração na tela de Settings.

## Setup (Windows)

1. Node.js 20+ com build tools (necessárias para o addon nativo do SDK do iRacing).
2. `git clone` do fork → `npm install` → `npm start` (o app abre na bandeja).
3. `npm run storybook` para desenvolver widgets sem o iRacing aberto.
4. `npm run make` gera o instalador `.exe`.

## O que já vem do irDashies (não reimplementar)

Input trace, Tachometer (LEDs por carro), Standings, Relative, Track Map, Flat Track Map, Weather,
Faster Cars From Behind, Fuel Calculator (overlay), Blind Spot Monitor, Slow Car Ahead, Garage Cover,
Rejoin Indicator, Pitlane Helper, Lap Timer, Flags, Setup Comparison, Twitch Chat, Telemetry Inspector,
perfis, servidor web para OBS (`localhost:3000/dashboard`), temas, atalhos de teclado e always on top.

## Backlog — o que adicionar (por prioridade)

### 1. Interface em português (PT-BR)

- i18n nas Settings e nos rótulos dos widgets, com inglês como fallback.
- Pronto quando: as Settings estiverem todas em PT-BR e o idioma puder ser trocado sem reiniciar.

### 2. Atalhos nos botões do volante (equivalente ao `gamepad.node` do Kapps)

- Ler botões de controladores DirectInput/XInput (G29) no processo principal.
- Ações mapeáveis: mostrar/ocultar overlays, modo de edição, próximo perfil, reset do histórico de combustível, ligar/desligar widget específico.
- Tela de bindings com "aperte o botão" para capturar, convivendo com os atalhos de teclado já existentes.
- Pronto quando: um botão do G29 alternar a visibilidade dos overlays com o iRacing em foco.

### 3. Calculadora de combustível de planejamento (janela própria, como o "Fuel Calc" do Kapps)

- Janela independente, que funciona fora da sessão: duração da corrida (tempo ou voltas), tempo de volta, consumo por volta, tamanho do tanque e margem.
- Saída: combustível total, número de paradas, combustível por stint e volta ideal de parada.
- Botão "puxar da sessão atual" para preencher consumo e tempo de volta pela telemetria.
- Pronto quando: os resultados baterem com um cálculo manual em 3 cenários (corrida curta, corrida por tempo e endurance com 2+ paradas).

### 4. Perfis prontos

- "Corrida", "Treino/Quali" e "Stream", cada um com um conjunto de widgets e posições.
- Pronto quando: os três perfis vierem pré-instalados e puderem ser alternados pelo atalho do volante.

### 5. (Opcional) Monitor de stream

- Painel simples com status da sessão, FPS e qualidade de rede do iRacing, para quem transmite.
- Escopo a definir com o Fernando antes de implementar.

### 6. (Futuro) Coach de frenagem do Dex Overlay

- Avaliar portar o coach de frenagem como widget. Discutir antes de começar.

## Fluxo de trabalho

- Um branch por item do backlog e um commit por etapa funcional.
- Rodar `npm run lint` e `npm run test` antes de cada commit.
- Testar no iRacing real (sessão Test Drive) antes de marcar o item como pronto.
