#!/usr/bin/env bash
# Supabase de desenvolvimento do Lumi rodando no servidor (não no PC).
#
# O PC do Marco não aguenta o Docker Desktop; o banco de testes, o login, as Edge
# Functions e o Mailpit rodam no servidor em /opt/lumi-dev. As portas 54320-54329
# ficam bloqueadas para fora (lumi-dev-firewall.service); o acesso é por túnel SSH,
# então para o PC tudo continua em http://127.0.0.1:54321 como antes.
#
# Uso: bash scripts/dev-remoto.sh <comando>
#   tunel      abre o túnel (54321 API, 54322 Postgres, 54324 Mailpit) em segundo plano
#   fechar     fecha o túnel
#   sync       copia a pasta supabase/ do PC para o servidor
#   start      sobe o Supabase no servidor (modo leve)
#   stop       desliga o Supabase no servidor
#   reset      sync + db reset (migrations + seed) e religa kong e edge runtime
#   test       roda os testes pgTAP no servidor
#   smoke      roda scripts/smoke-rls.mjs pelo túnel
#   convite    roda scripts/convite-e2e.mjs pelo túnel
#   senha      roda scripts/acesso-senha-e2e.mjs pelo túnel (acesso sem e-mail)
#   sql        executa SQL vindo da entrada padrão: echo "select 1" | bash scripts/dev-remoto.sh sql
#   status     mostra containers e o estado do túnel
set -u

SERVIDOR="${LUMI_SERVIDOR:-root@147.93.3.91}"
CHAVE="${LUMI_CHAVE_SSH:-C:/dev/atende-clinica/.ssh/contabo}"
DIR_REMOTO="/opt/lumi-dev"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SSH=(ssh -i "$CHAVE" -o ConnectTimeout=20 -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes)
LEVE="storage-api,postgres-meta,studio,imgproxy,logflare,vector,supavisor"

remoto() { "${SSH[@]}" "$SERVIDOR" "$@"; }

tunel_ativo() { curl -s -o /dev/null -m 5 -w "%{http_code}" http://127.0.0.1:54321/auth/v1/health 2>/dev/null | grep -q 200; }

case "${1:-}" in
  tunel)
    if tunel_ativo; then echo "túnel já ativo"; exit 0; fi
    "${SSH[@]}" -f -N -L 54321:127.0.0.1:54321 -L 54322:127.0.0.1:54322 -L 54324:127.0.0.1:54324 "$SERVIDOR" \
      && sleep 2 && tunel_ativo && echo "túnel ativo: http://127.0.0.1:54321" || { echo "túnel não respondeu"; exit 1; } ;;
  fechar)
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='ssh.exe'\" | Where-Object { \$_.CommandLine -match '54321:127.0.0.1:54321' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" \
      && echo "túnel fechado" ;;
  sync)
    (cd "$RAIZ" && tar -czf - --exclude=supabase/.temp --exclude=supabase/.branches supabase) \
      | remoto "cd $DIR_REMOTO && tar -xzf - && chmod 600 supabase/functions/.env 2>/dev/null; find supabase -type f \( -name '*.sql' -o -name '*.toml' -o -name '*.ts' -o -name '*.html' \) -exec sed -i 's/\r\$//' {} + && echo 'sync ok'" ;;
  start)
    remoto "cd $DIR_REMOTO && supabase start -x $LEVE 2>&1 | grep -E 'Started|already running|rror' | head -3" ;;
  stop)
    remoto "cd $DIR_REMOTO && supabase stop 2>&1 | tail -1" ;;
  reset)
    "$0" sync || exit 1
    remoto "cd $DIR_REMOTO && for t in 1 2 3; do supabase db reset 2>&1 | grep -q 'Finished supabase db reset' && { echo \"reset ok (tentativa \$t)\"; break; }; echo \"reset falhou (tentativa \$t)\"; done; docker restart supabase_kong_miopia-app >/dev/null; docker start supabase_edge_runtime_miopia-app >/dev/null 2>&1; true"
    for i in $(seq 1 40); do tunel_ativo && break; sleep 3; done
    echo "select 'users='||(select count(*) from auth.users)||' children='||(select count(*) from public.children)||' logs='||(select count(*) from public.adherence_logs)" | "$0" sql ;;
  test)
    "$0" sync >/dev/null && remoto "cd $DIR_REMOTO && supabase test db 2>&1 | grep -E 'Result|Tests=|not ok|Failed' | head -20" ;;
  smoke)
    (cd "$RAIZ" && node scripts/smoke-rls.mjs) ;;
  convite)
    (cd "$RAIZ" && LUMI_SQL_REMOTO=1 node scripts/convite-e2e.mjs) ;;
  senha)
    (cd "$RAIZ" && node scripts/acesso-senha-e2e.mjs) ;;
  sql)
    remoto "docker exec -i supabase_db_miopia-app psql -U postgres -d postgres -At -v ON_ERROR_STOP=1" ;;
  status)
    remoto "docker ps --format '{{.Names}} {{.Status}}' | grep miopia; free -h | head -2"
    tunel_ativo && echo "túnel: ativo" || echo "túnel: fechado" ;;
  *)
    sed -n '2,26p' "$0"; exit 1 ;;
esac
