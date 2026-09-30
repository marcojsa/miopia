# Como rodar a demo do Lumi no celular (Android)

## Pré-requisitos (uma vez)
1. No celular, instale o app **Expo Go** (Play Store, grátis).
2. Celular e PC na **mesma rede Wi-Fi**.

## No PC (já configurado nesta sessão)
- Supabase local rodando: `npx supabase start` (em C:\dev\miopia-app)
- Servidor do app rodando: `npx expo start --lan` (em apps/mobile) com
  `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.15.3`
- IP do Wi-Fi do PC: **192.168.15.3** (muda se trocar de rede — rechecar com ipconfig)
- apps/mobile/.env aponta para http://192.168.15.3:54321 (Supabase do PC)

## No celular
1. Abra o **Expo Go**.
2. Toque em **"Enter URL manually"** e digite: **exp://192.168.15.3:8081**
   (ou escaneie o QR code que aparece no terminal do PC).
3. Aguarde o primeiro carregamento (~1-2 min na 1ª vez).

## Login de demonstração
- E-mail: **responsavel@example.com**
- Senha: **senha-local-123**
- (É a Fernanda, mãe da Alice e do Pedro, com dados de teste já populados.)

## O que mostrar
- **Hoje**: check-in de 1 toque (Feito / Não foi possível), meta da semana, card do Céu.
- **Céu** (botão "Abrir o céu"): estrelas das noites, escudos, constelações 7/30/90.
- **Progresso**: valores de cada consulta + avaliação da Dra. (sem gráfico — ANVISA).
- **Família**: regime, ajustar lembretes, pausa de férias, conta/LGPD.

## Se o app abrir mas o login falhar / não aparecer dado
É o firewall do Windows bloqueando a porta 54321. Solução: liberar a porta
(precisa de permissão de administrador). Peça ao Claude para rodar a regra de
firewall, ou rode no PowerShell como admin:
  New-NetFirewallRule -DisplayName "miopia 54321" -Direction Inbound -Protocol TCP -LocalPort 54321 -Action Allow -Profile Private
  New-NetFirewallRule -DisplayName "miopia 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private

## Observação honesta para a demo
As **notificações** (lembretes) não disparam de verdade no Expo Go — isso só
funciona no app "de verdade" (dev build), que é etapa do piloto. Todo o resto
(telas, céu, check-in, dados, avaliação da médica) funciona normalmente.
