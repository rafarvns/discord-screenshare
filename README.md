# Sala de Tela

Compartilhe tela, janela, guia, câmera e áudio em uma Activity do Discord com inicialização portátil no Windows, Linux e macOS.

Projeto independente de [DevilNine](https://github.com/DevilNine), criado como evolução e inspirado no [Sala de Tela original, de Jc007zZ](https://github.com/Jc007zZ/discord-screen).

## O que esta evolução entrega

- **ZIP pronto para uso:** baixa e verifica Node.js 22, dependências e `cloudflared` dentro do projeto; não exige Node/npm global.
- **Três sistemas:** `INICIAR.bat` no Windows 10/11, `INICIAR.sh` nas principais distribuições Linux e `INICIAR.command` no macOS Intel/Apple Silicon.
- **Tela e áudio:** guia com áudio em Chromium; Firefox e derivados no PC Windows anfitrião usam WASAPI isolado; câmera fica separada da voz do Discord.
- **Qualidade adaptativa:** perfis de 30/60 fps até 1080p, hardware encoding quando disponível, redução sob congestionamento e recuperação gradual quando a rede estabiliza.
- **Vários transmissores:** cada participante recebe canal próprio; espectadores escolhem o que assistir sem baixar todas as telas.
- **Cloudflare supervisionado:** reconexão automática, terminal limpo e opção de Named Tunnel para endereço fixo.
- **Firefox e navegadores Chromium:** caminhos de captura próprios, sem o bloqueio artificial do projeto-base.
- **Mobile útil:** Android/iOS podem entrar, assistir e transmitir câmera; áreas seguras e perfil leve são aplicados automaticamente.
- **Retomada móvel automática:** voltar do segundo plano, trocar de rede ou reabrir a tela força configuração e keyframe novos, mesmo quando a imagem transmitida está parada.
- **Atualização e diagnóstico seguros:** checkout Git limpo avança sem sobrescrever alterações; registros técnicos sanitizados ficam locais e o envio é opt-in.
- **Salas protegidas:** senha derivada com `scrypt`, tokens com escopo e painel administrativo opcional.

## Início rápido

Baixe o ZIP, use **Extrair tudo** e abra a pasta completa. Não execute de dentro do ZIP.

| Sistema | Como iniciar | Diagnóstico sem instalar |
| --- | --- | --- |
| Windows 10/11 | duplo clique em `INICIAR.bat` | `INICIAR.bat -Diagnostico` |
| Ubuntu, Debian, Kali, Mint e derivados | `sh INICIAR.sh` | `sh INICIAR.sh --diagnostico` |
| macOS Intel ou Apple Silicon | duplo clique em `INICIAR.command` | `./INICIAR.command --diagnostico` |

Na primeira execução, cole o **Client ID** e o **Client Secret** quando o assistente local pedir. O bootstrap baixa o runtime oficial, valida o SHA-256, executa `npm ci`, compila o site e inicia servidor/túnel. Nas próximas vezes ele reutiliza tudo.

Uma cópia clonada do repositório verifica `origin/main` ao iniciar e só aplica avanço direto se estiver limpa. No ZIP não existe histórico Git para atualizar com segurança: baixe e extraia a versão nova, preservando o seu `.env`. O atualizador nunca usa reset, stash nem sobrescrita forçada.

Nada é instalado globalmente e nenhuma variável permanente do sistema é criada. Runtime, cache e configuração ficam em `.runtime`, `.cache`, `.bootstrap` e `.env`. Mantenha a janela aberta; `Ctrl+C` (`Control+C` no Mac) encerra tudo.

Guias detalhados: [Windows](docs/windows.md) · [Linux](docs/linux.md) · [macOS](docs/macos.md)

## Configuração única no Discord

O Discord não permite que um programa crie a aplicação e autorize campos sensíveis do Developer Portal em nome do usuário. Faça uma vez:

1. Em [Discord Developer Portal](https://discord.com/developers/applications), crie uma aplicação.
2. Em **OAuth2**, copie Client ID e Client Secret para o assistente local.
3. Em **Activities → Settings**, habilite Activities e Desktop; marque Android/iOS se quiser acesso móvel.
4. Em **Activities → URL Mappings**, crie o prefixo `/` e cole o domínio exibido, sem `https://`.
5. Em **OAuth2 → Redirects**, cole o endereço exibido que termina em `/auth/callback`.
6. Use o link de instalação mostrado no terminal e abra a Activity em um canal de voz.

O botão azul **Redirecionamento/Add Redirect** deve criar uma caixa na mesma página. Se ele abrir uma tela cheia de código com `removeChild`, siga o [contorno seguro para o erro do Developer Portal](docs/discord-portal.md); não é necessário refazer URL Mapping nem executar comandos no console.

### Só para membros do seu servidor

Preencha `DISCORD_GUILD_ID` no `.env` (botão direito no ícone do servidor, **Copiar ID**; vários separados por vírgula). Com ele:

- A Activity só abre para quem o bot confirma que é membro. Por isso exige `DISCORD_BOT_TOKEN`, com o bot dentro do servidor. Se o Discord não responder, ninguém entra.
- O site fora do Discord não abre mais lobby nem convidado. Continuam valendo só os links gerados dentro da Activity: a página de transmissão e o "abrir no site".
- O login do painel `/admin` segue igual.

No portal, em **Installation**, deixe só **Guild Install** e desmarque **Public Bot** para que estranhos nem consigam adicionar a aplicação.

O Client Secret fica somente no servidor local e o `.gitignore` exclui `.env`. Nunca publique `.env`, tokens ou credenciais da pasta `.cloudflared`.

## Compartilhamento e compatibilidade

Clique em **Compartilhar tela**. Quando o iframe do Discord não puder capturar, o projeto abre uma página externa; mantenha-a aberta durante a transmissão.

| Plataforma | Assistir | Tela/câmera | Áudio de tela |
| --- | ---: | ---: | --- |
| Chrome, Edge, Brave, Opera desktop | Sim | Sim | guia/janela/sistema quando o navegador oferecer |
| Firefox, LibreWolf, Waterfox, Floorp e Zen no Windows anfitrião | Sim | Sim | navegador isolado por processo via WASAPI |
| Firefox em outro PC participante | Sim | Sim | sem companion local; use um Chromium para transmitir áudio |
| Firefox no Linux/macOS | Sim | Sim, modo compatível | limitado pelo navegador/sistema |
| Safari recente | Sim | depende de WebCodecs e captura da versão | limitado |
| Android/iOS | Sim | câmera quando suportada; tela web indisponível na maioria | não para tela |

Para áudio de uma guia no Chromium, escolha **Guia/Aba** e marque **Compartilhar áudio**. Para navegar entre abas sem congelar no Firefox, escolha a **janela inteira** do Firefox. O seletor e a permissão sempre pertencem ao navegador; uma página web não pode escolher uma aplicação silenciosamente.

Os perfis vão de **Leve** (1,5 Mb/s, 30 fps) a **Máximo** (8 Mb/s, 60 fps). Sessenta fps é o alvo: fonte, encoder, hardware, upload, VPN e quantidade de espectadores ainda determinam os quadros reais. Cada espectador consome uma cópia do fluxo.

No celular, assistir e câmera funcionam sem hospedar o servidor no aparelho. Captura da tela/áudio de outros apps exige um cliente nativo com APIs do sistema; veja o [estado atual e plano Android/iOS](docs/mobile.md).

## Cloudflare e endereço público

Sem configuração extra, o projeto usa um Quick Tunnel `trycloudflare.com`. É adequado para teste, mas o endereço pode mudar quando o processo é recriado; nesse caso atualize URL Mapping e Redirect no portal.

Para um domínio estável, execute uma vez:

```text
Windows: INICIAR.bat -TunelCriar
Linux:   sh INICIAR.sh --tunel-criar
macOS:   ./INICIAR.command --tunel-criar
```

O supervisor reinicia `cloudflared` com espera progressiva. Named Tunnel mantém o domínio; Quick Tunnel pode gerar outro. Por padrão `TERMINAL_LIMPO=1` mostra somente endereços e avisos úteis; use `TERMINAL_LIMPO=0` no `.env` para logs de desenvolvimento.

## Problemas comuns

- **Activity em branco:** confira o Target atual e reabra a Activity para descartar o bundle antigo.
- **“O site não compilou”:** o launcher reinstala o lockfile e tenta novamente; se falhar, envie o erro real mostrado na janela.
- **Áudio ausente:** no Chromium marque áudio no seletor; no Firefox/derivado do PC anfitrião mantenha o navegador aberto e aguarde “Áudio isolado do Firefox ligado”. O código 3 agora identifica automaticamente os derivados conhecidos e explica quando nenhum está aberto.
- **Outra pessoa fica carregando:** o cliente repete configuração/keyframe até o primeiro quadro, vigia travamentos posteriores e se recupera ao voltar do segundo plano ou trocar de rede. Uma tela estática também responde sem depender de mover o mouse. Se persistir, teste o perfil Leve e diagnostique sem VPN.
- **Porta 3001 ocupada:** feche outra instância deste projeto; não finalize processos desconhecidos.
- **macOS bloqueou o `.command`:** clique com o botão direito → **Abrir**. Se o ZIP perdeu a permissão, siga o [guia macOS](docs/macos.md).
- **Portal cai ao clicar em Redirecionamento:** recarregue sem tradução/extensões ou use janela anônima/outro navegador; veja o [guia do erro `removeChild`](docs/discord-portal.md).
- **Cloudflare caiu:** aguarde a reconexão. Quick Tunnel recriado exige atualizar os dois endereços no portal.

Arquivos em `Program Files`, raiz do disco ou pasta protegida podem impedir gravação. Extraia em Downloads/Documentos. Para reinstalar apenas o ambiente local, preserve `.env`, feche o programa e remova `.runtime`, `.bootstrap` e `node_modules`.

## Privacidade, limites e documentação

- O projeto não grava mídia em disco; o relay WebSocket repassa pacotes codificados somente aos espectadores autorizados da sala.
- O diagnóstico local registra somente eventos técnicos sanitizados em `.logs/`; nada é enviado por padrão. Exporte com `npm run diagnostico:exportar` ou configure conscientemente um endpoint HTTPS próprio.
- O helper WASAPI exige uma prova em uma porta exclusiva de `127.0.0.1`; um participante remoto não pode acionar nem receber por engano o áudio do navegador do anfitrião.
- O servidor/túnel precisa ficar ligado no PC, Mac, Linux ou VPS que hospeda a Activity.
- Quick Tunnel não é hospedagem de produção, e o relay atual não substitui uma SFU para grandes públicos.
- Navegadores exigem gesto e nova escolha em cada captura. Áudio isolado varia por navegador e sistema.
- Captura nativa de tela móvel não pode ser entregue com um ZIP web: Android requer MediaProjection/AudioPlaybackCapture e iOS requer APIs e distribuição nativas.

Documentação técnica: [arquitetura e desempenho](docs/como-funciona.md) · [diagnóstico e atualização](docs/diagnostico.md) · [VPS/Docker](docs/vps.md) · [mobile](docs/mobile.md) · [avisos de terceiros](THIRD-PARTY-NOTICES.txt)

## Desenvolvimento

Requer Node.js 22 ou 24:

```bash
npm ci
npm run build
npm test
npm run lint
npm run smoke:admin
```

O projeto é mantido e publicado por [DevilNine](https://github.com/DevilNine). É uma evolução independente inspirada no projeto original citado no topo, não uma publicação oficial dele.
