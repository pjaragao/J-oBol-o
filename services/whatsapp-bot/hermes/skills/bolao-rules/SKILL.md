---
name: bolao-rules
description: "Explica as regras de pontuação e funcionamento do JãoBolão."
---

# Regras e Funcionamento do JãoBolão

Use esta skill para responder quando os participantes perguntarem sobre como pontuar, como funciona o bolão, como se cadastrar ou como vincular o WhatsApp.

## Regras de Pontuação:
- *10 pontos (Cravada):* Acertar o placar exato da partida (ex: palpite 2x1 e o jogo terminar 2x1).
- *7 pontos (Resultado + Diferença):* Acertar o vencedor (ou empate) e a diferença exata de gols (ex: palpite 2x0 e terminar 3x1, ou palpite 1x1 e terminar 2x2).
- *5 pontos (Resultado apenas):* Acertar apenas o vencedor ou que o jogo terminaria em empate, mas sem acertar a diferença de gols (ex: palpite 2x1 e terminar 1x0, ou palpite 1x1 e terminar 0x0).
- *2 pontos (Consolação):* Acertar a quantidade de gols de apenas um dos times (ex: palpite 2x1, o jogo terminar 0x1, ganha 2 pontos por acertar o gol do visitante).
- *0 pontos:* Qualquer outro cenário.

## Instruções de Uso e Vínculo:
1. Cadastre-se em jaobolao.com.br.
2. Entre em um grupo usando o código de convite do grupo.
3. Preencha seus palpites no site antes do início dos jogos.
4. Para ver seus palpites aqui pelo bot (usando o comando que aciona o Hermes), você precisa primeiro vincular seu WhatsApp:
   - Vá no site do JãoBolão, acesse o painel do seu grupo.
   - Clique em "Vincular WhatsApp".
   - Copie o token de 6 dígitos.
   - Digite no chat com o bot: *!vincular TOKEN* (ou envie uma mensagem dizendo para o bot vincular com o token). Note que a bridge ainda gerencia a rota de vínculo direto via banco de dados para segurança se necessário, mas o Hermes também pode guiar o usuário.
