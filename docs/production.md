# Production runbook (TrueNAS + Portainer, via Tailscale)

Spec 031. Everything below the server line is done **by the owner**; the repos only provide the files and these snippets. Placeholders: `<HOST_IP>` (home server), `<TRUENAS_IP>` (NFS server, often the same machine), `<generated-password>`, `<generated-secret>`. Never write real values in this file.

| Piece                  | Value                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| API container / port   | `life-planner-back-prod` / host `1015` → 3000                                            |
| Web container / port   | `life-planner-web-prod` / host `1016` → 80 (frontend repo)                               |
| Backup container       | `life-planner-backup-prod` (daily `pg_dump`, 7 daily/4 weekly/6 monthly)                 |
| Hostnames              | `life-planner-api.example.com` → `:1015`, `life-planner.example.com` → `:1016` |
| Database / role        | `life_planner_prod` / `life_planner_prod` on `postgres_db` (17.5, port 8001)             |
| Staging (do not touch) | `life-planner-back`, port `1009`                                                         |

## 1. Prerequisites

- Backend and frontend PRs of spec 031 merged to `main` (Portainer follows `refs/heads/main`).
- Tailscale up on the machine you operate from.
- Generate the secrets once and keep them in your password manager:

```bash
openssl rand -base64 48   # JWT_SECRET (must differ from staging's)
openssl rand -base64 24   # database password for life_planner_prod
```

## 2. Postgres (database, role, isolation)

Run as the Postgres superuser on `postgres_db`:

```sql
CREATE ROLE life_planner_prod LOGIN PASSWORD '<generated-password>';
CREATE DATABASE life_planner_prod OWNER life_planner_prod;
REVOKE CONNECT ON DATABASE life_planner_prod FROM PUBLIC;
```

Isolation the other way (staging's role must not reach production, and the new role must not reach staging):

```sql
SELECT datname, datacl FROM pg_database WHERE NOT datistemplate;
-- for the staging database and any other app database whose datacl has a "=Tc/..." (PUBLIC) entry:
REVOKE CONNECT ON DATABASE <staging_db> FROM PUBLIC;
```

The owner of a database keeps access after this. If an app connects with a role that is **not** the database owner, grant it explicitly first: `GRANT CONNECT ON DATABASE <db> TO <role>;`. This is the only step that changes permissions on a database that is not Life Planner's, so do it in a quiet moment and restart that app's container to confirm it still connects.

Proof (all four must be refused / accepted as shown):

```bash
psql -h <HOST_IP> -p 8001 -U life_planner_prod -d life_planner_prod -c 'select 1'   # works
psql -h <HOST_IP> -p 8001 -U life_planner_prod -d <staging_db> -c 'select 1'        # permission denied
psql -h <HOST_IP> -p 8001 -U <staging_role>   -d life_planner_prod -c 'select 1'    # permission denied
```

## 3. TrueNAS backup dataset

1. Create the dataset `prod_containers/life-planner-prod/backups`.
2. Share it over NFS with the same options as the other container volumes, and allow writes for uid `999` (the `postgres` user of the backup image), e.g. maproot/mapall to a user that owns the dataset.
3. Note the mounted path (`/mnt/<pool>/prod_containers/life-planner-prod/backups`): it is `BACKUP_NFS_PATH`.

## 4. Portainer stack `life-planner-prod-api`

Stacks → Add stack → **Repository**: `https://github.com/salomaoluiz/life-planner-back`, reference `refs/heads/main`, compose path `docker-compose.prod.yml`. Environment variables (stack environment only, never in Git):

| Variable                   | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| `DB_HOST`                  | `<HOST_IP>`                                             |
| `DB_PORT`                  | `8001`                                                  |
| `DB_NAME`                  | `life_planner_prod`                                     |
| `DB_USER`                  | `life_planner_prod`                                     |
| `DB_PASSWORD`              | `<generated-password>`                                  |
| `JWT_SECRET`               | `<generated-secret>`                                    |
| `JWT_EXPIRES_IN`           | `3600`                                                  |
| `SESSION_IDLE_TTL_SECONDS` | `172800`                                                |
| `CORS_ORIGINS`             | `https://life-planner.example.com`                 |
| `BACKUP_NFS_ADDR`          | `<TRUENAS_IP>`                                          |
| `BACKUP_NFS_PATH`          | `/mnt/<pool>/prod_containers/life-planner-prod/backups` |

Deploy. Expected: `life-planner-back-prod` and `life-planner-backup-prod` running, the API `healthy`; the API log shows `prisma migrate deploy` applying every migration (the first start also creates the seeded system categories). A failed migration makes the container exit and restart in a loop: read the log, fix, redeploy. The API never serves on a half-migrated schema.

## 5. Nginx and DNS

Two server blocks in the main Nginx, same pattern and wildcard certificate as the other services (copy the `ssl_*` lines from an existing block):

```nginx
server {
  listen 443 ssl;
  server_name life-planner-api.example.com;
  # ssl_certificate / ssl_certificate_key / ssl_* : copy from an existing service block
  location / {
    proxy_pass http://<HOST_IP>:1015;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 443 ssl;
  server_name life-planner.example.com;
  # ssl_* : same as above
  location / {
    proxy_pass http://<HOST_IP>:1016;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Add both names in AdGuard / Tailscale DNS the way the other subdomains are. Then `nginx -t` and reload.

## 6. Verify the API

```bash
curl -s https://life-planner-api.example.com/api/health                        # ok
curl -s -o /dev/null -w '%{http_code}\n' https://life-planner-api.example.com/swagger   # 404
# a JWT from staging must be rejected by production:
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer <staging-jwt>" \
  https://life-planner-api.example.com/api/v1/user/me                         # 401
```

## 7. Backup proof (before go-live)

1. Trigger a run: `docker exec life-planner-backup-prod /backup.sh`. A file must appear under the NFS path (`last/`, `daily/`). If it can't write, fix the NFS permissions from step 3.
2. Restore into a scratch database and check it:

```bash
createdb -h <HOST_IP> -p 8001 -U <superuser> lp_restore_test
gunzip -c <backup-file>.sql.gz | psql -h <HOST_IP> -p 8001 -U <superuser> -d lp_restore_test
psql -h <HOST_IP> -p 8001 -U <superuser> -d lp_restore_test -c '\dt' -c 'select count(*) from "User"'
dropdb -h <HOST_IP> -p 8001 -U <superuser> lp_restore_test
```

3. Restore into `life_planner_prod` itself (disaster recovery): stop the API stack, then
   `DROP DATABASE life_planner_prod; CREATE DATABASE life_planner_prod OWNER life_planner_prod; REVOKE CONNECT ON DATABASE life_planner_prod FROM PUBLIC;`, load the dump as above (as the superuser, into that database), start the stack. Do this once with the still-empty database before go-live; with real data, take a fresh dump first.

## 8. Web stack, Android app, monitoring, snapshots

- Web stack and the Android APK: see `Production` in the frontend README (`life-planner`).
- Monitoring: add `https://life-planner-api.example.com/api/health` to the targets of the existing Blackbox HTTP probe job in Prometheus (`<job name>` is whichever job probes the other services), reload Prometheus, check Grafana. Logs already reach Loki through the Docker log driver.
- ZFS snapshots of the dataset are still listed as "to configure" in the server docs; set them up in addition to the dumps.

## 9. Release and rollback

- **Release:** merge to `main` → Portainer "Pull and redeploy" of the affected stack (API and web together when the API contract changes) → new APK only when the app changed. `main` must stay deployable: PRs merge green and migrations are additive.
- **Rollback of code:** set the stack's reference to the previous commit hash and redeploy. Because migrations are additive, the older code keeps working on the newer schema.
- **Rollback of data:** restore from the latest dump (step 7).
