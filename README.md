# Câmeras de casa: Frigate + painel

Gravação 24/7 das câmeras Yoosee via RTSP, com detecção de pessoas/carros e um painel web próprio.

| Serviço | Endereço | O que é |
|---|---|---|
| Painel (Vue) | `http://<servidor>:8090` | ao vivo, gravações, eventos, exportações, sistema |
| Frigate UI | `http://<servidor>:8091` | interface oficial (configuração, máscaras, zonas) |

O login é o mesmo nos dois (`PAINEL_USUARIO` / `PAINEL_SENHA` do `.env`).

## Instalar numa máquina nova

Requisitos: Linux x86_64 com Docker e o plugin `docker compose`, na mesma rede das câmeras, com ~45 GB livres para as gravações.

```bash
git clone <url-do-repositorio> cams
cd cams
./instalar.sh
```

Na primeira vez, o script pergunta o IP e a senha da câmera, a pasta das gravações e o usuário/senha do painel, gera o `.env` e sobe tudo. Rodar de novo só atualiza (o `.env` é mantido).

Para configurar sem perguntas: `cp .env.example .env`, edite e rode `./instalar.sh`.

### Disco das gravações

Use um disco ou partição **ext4** dedicado e monte pelo `/etc/fstab` com `nofail`:

```bash
sudo mkfs.ext4 -L cams /dev/sdX1          # APAGA o disco
sudo mkdir -p /srv/cams
echo 'LABEL=cams /srv/cams ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount /srv/cams && sudo mkdir -p /srv/cams/gravacoes
```

Evite NTFS: se o Windows deixar o volume "sujo", o Linux não monta e a gravação para.

Se o disco não montar, o Frigate **não sobe**, de propósito, para não lotar o disco do sistema.

## O que fica onde

```
.env                  segredos e caminhos desta máquina (não vai pro git)
config/config.yml     câmeras, detecção, retenção (5 dias), portas
scripts/usuario.py    cria/atualiza o login do painel no banco do Frigate
painel/               código do painel (Vue 3 + Vite, servido por nginx)
instalar.sh           instalação/atualização
```

## Comandos

```bash
docker compose ps                        # status
docker compose logs -f frigate           # logs
docker compose restart frigate           # depois de editar config/config.yml
docker compose up -d --build painel      # depois de mexer no painel
docker compose run --rm usuario          # depois de trocar PAINEL_SENHA no .env
git pull && ./instalar.sh                # atualizar tudo
```

## Trocar usuário ou senha

Edite `PAINEL_USUARIO` / `PAINEL_SENHA` no `.env` e rode `docker compose run --rm usuario`.

A senha é gravada direto no banco, porque a API do Frigate exige 12+ caracteres. Esse login vale na rede de casa. **Não exponha as portas 8090/8091 na internet** com senha curta. Para acesso de fora, use VPN (Tailscale, WireGuard).

O Frigate também cria um usuário `admin` com senha aleatória na primeira subida (`docker compose logs frigate | grep Password`). Ele pode ficar como reserva.

## Adicionar câmera

1. Teste o stream: `ffprobe -rtsp_transport udp "rtsp://admin:SENHA@IP:554/onvif1"`
2. Em `config/config.yml`, copie os blocos `sala` / `sala_sub` (em `go2rtc.streams`) e a câmera `sala` (em `cameras`) com o novo nome.
3. Coloque o IP no `.env` (ex.: `CAMERA_GARAGEM_IP=...`) e no `environment` do serviço `frigate` no `docker-compose.yml` (ex.: `FRIGATE_GARAGEM_IP: ${CAMERA_GARAGEM_IP}`). Use `{FRIGATE_GARAGEM_IP}` no config.
4. `docker compose up -d`

O painel mostra automaticamente todas as câmeras do Frigate.

## Detector (hardware)

O padrão é OpenVINO na CPU, que roda em qualquer x86 (~5–15 ms por inferência com 1–2 câmeras).

Com **iGPU Intel** (N100, Celeron/i3/i5 com vídeo integrado), é mais leve rodar na GPU:
- no `docker-compose.yml`, descomente o `devices: /dev/dri/renderD128`
- no `config.yml`, use `device: GPU` no detector

Em **ARM (Raspberry Pi)**, o OpenVINO não roda. Troque o detector por `type: cpu` e remova o bloco `model:`.

## Notas da câmera Yoosee

- Só aceita RTSP via **UDP**, por isso os containers usam `network_mode: host`.
- `onvif1` = 1280x720 @ 15 fps (gravação/HD), `onvif2` = 640x360 (detecção/grade).
- A senha é a do **dispositivo** (app Yoosee → Configurações → Segurança), não a da conta. Caracteres especiais vão URL-encoded no `.env` (`#` → `%23`); o `instalar.sh` faz isso sozinho.
- Recomendado: reservar IP fixo da câmera no roteador e bloquear o acesso dela à internet.
