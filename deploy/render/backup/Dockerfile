# Separate, pinned PostgreSQL 17 client + Node runtime for the optional cron.
FROM node:24.21.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg awscli \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && rm -rf /var/lib/apt/lists/* /usr/share/postgresql-common/pgdg

COPY deploy/render/backup/render-backup.mjs /app/render-backup.mjs
RUN chown -R node:node /app
USER node
ENTRYPOINT ["node", "/app/render-backup.mjs"]
