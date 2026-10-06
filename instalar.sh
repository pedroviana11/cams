#!/usr/bin/env bash
# Instala/atualiza Frigate + painel nesta máquina.
# Uso: ./instalar.sh        (pergunta o que faltar no .env e sobe tudo)
set -euo pipefail
cd "$(dirname "$0")"

erro() { echo "ERRO: $*" >&2; exit 1; }

command -v docker >/dev/null || erro "Docker não instalado. Veja https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || erro "Plugin 'docker compose' não encontrado."
docker info >/dev/null 2>&1 || erro "Sem acesso ao Docker. Rode: sudo usermod -aG docker \$USER  (e entre de novo na sessão)"

# percent-encode pra senha caber na URL rtsp://
urlencode() {
  local s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9._~-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

if [[ ! -f .env ]]; then
  echo "== Configuração inicial (gera o .env) =="
  read -rp "IP da câmera [192.168.15.12]: " ip
  read -rsp "Senha da câmera (a do dispositivo no app Yoosee): " cam_pass; echo
  read -rp "Pasta das gravações [/srv/cams/gravacoes]: " rec
  read -rp "Usuário do painel [pedro]: " user
  read -rsp "Senha do painel: " pass; echo
  [[ -n "$cam_pass" && -n "$pass" ]] || erro "Senhas não podem ficar vazias."
  umask 077
  cat > .env <<EOF
CAMERA_SALA_IP=${ip:-192.168.15.12}
CAMERA_SENHA=$(urlencode "$cam_pass")
GRAVACOES=${rec:-/srv/cams/gravacoes}
PAINEL_USUARIO=${user:-pedro}
PAINEL_SENHA=${pass}
EOF
  umask 022
  echo ".env criado."
fi

set -a; source .env; set +a

if [[ ! -d "$GRAVACOES" ]]; then
  echo "Criando pasta de gravações: $GRAVACOES"
  mkdir -p "$GRAVACOES" 2>/dev/null || sudo mkdir -p "$GRAVACOES"
fi

livre=$(df -BG --output=avail "$GRAVACOES" | tail -1 | tr -dc 0-9)
(( livre >= 45 )) || echo "AVISO: só ${livre} GB livres em $GRAVACOES; 5 dias de gravação usam ~40 GB."

echo "== Subindo containers (primeira vez baixa ~2 GB) =="
docker compose pull frigate
docker compose up -d --build

echo "== Esperando o Frigate ficar pronto =="
for _ in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' frigate 2>/dev/null)" == healthy ]] && break
  sleep 5
done
docker compose logs usuario 2>/dev/null | tail -1

ip_local=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')
echo
echo "Pronto!"
echo "  Painel:     http://${ip_local}:8090"
echo "  Frigate UI: http://${ip_local}:8091"
echo "  Login:      ${PAINEL_USUARIO} / (senha do .env)"
