"""Cria/atualiza o usuário do painel direto no banco do Frigate.

A API do Frigate exige senha com 12+ caracteres; o login em si não valida tamanho,
então gravamos o hash no mesmo formato que o Frigate usa (pbkdf2_sha256$iter$salt$hash).
Roda como serviço one-shot do docker compose, depois que o Frigate está saudável.
"""

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
import sys
import time
from datetime import datetime

DB = "/config/frigate.db"
ITERATIONS = 600000


def hash_password(password, salt):
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt}${base64.b64encode(digest).decode().strip()}"


def matches(stored, password):
    try:
        _, iterations, salt, b64 = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
        return hmac.compare_digest(base64.b64encode(digest).decode().strip(), b64)
    except ValueError:
        return False


def main():
    user = os.environ.get("PAINEL_USUARIO", "").strip()
    password = os.environ.get("PAINEL_SENHA", "")
    if not user or not password:
        print("PAINEL_USUARIO/PAINEL_SENHA vazios no .env, nada a fazer")
        return

    # o Frigate cria a tabela na primeira subida
    for _ in range(60):
        try:
            con = sqlite3.connect(DB, timeout=30)
            if con.execute("SELECT name FROM sqlite_master WHERE name='user'").fetchone():
                break
            con.close()
        except sqlite3.Error:
            pass
        time.sleep(2)
    else:
        sys.exit("tabela de usuários do Frigate não apareceu")

    row = con.execute('SELECT password_hash FROM "user" WHERE username = ?', (user,)).fetchone()
    if row and matches(row[0], password):
        con.execute('UPDATE "user" SET role = ? WHERE username = ?', ("admin", user))
        con.commit()
        print(f"usuário {user} já está com essa senha")
        return

    # password_changed_at derruba sessões antigas, então só muda quando a senha muda
    con.execute(
        'INSERT INTO "user" (username, role, password_hash, password_changed_at, notification_tokens) '
        "VALUES (?, 'admin', ?, ?, '[]') "
        "ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, "
        "role = 'admin', password_changed_at = excluded.password_changed_at",
        (user, hash_password(password, secrets.token_hex(16)), datetime.now().isoformat(sep=" ")),
    )
    con.commit()
    print(f"usuário {user} {'atualizado' if row else 'criado'}")


if __name__ == "__main__":
    main()
