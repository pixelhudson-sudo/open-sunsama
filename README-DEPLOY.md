# Open Sunsama — VPS Deployment Guide

This guide deploys your customized Open Sunsama to a Hostinger VPS (or any VPS with Docker) and serves it on your own domain with automatic HTTPS.

## What you get

- Web app at `https://your-domain.com`
- API at `https://your-domain.com/api`
- WebSocket at `wss://your-domain.com/api/ws`
- PostgreSQL database persisted on the VPS
- Automatic HTTPS via Caddy

## Requirements

- A VPS with Docker + Docker Compose installed
- A domain pointing to the VPS IP (A record)
- Ports 80, 443, and 443/udp open in the firewall

## 1. Clone the repo on your VPS

```bash
ssh user@your-vps-ip
cd ~
git clone https://github.com/ShadowWalker2014/open-sunsama.git
# or your fork
```

## 2. Configure environment

```bash
cd open-sunsama
cp .env.production.example .env
nano .env
```

Edit these required values:

```env
DOMAIN=schedule.yourdomain.com
POSTGRES_PASSWORD=some_strong_password
JWT_SECRET=generate_with_openssl_rand_base64_32
```

Generate a JWT secret:

```bash
openssl rand -base64 32
```

## 3. Deploy

```bash
./deploy.sh
```

This will:
- Start PostgreSQL
- Run database migrations
- Build the API and web containers
- Start Caddy reverse proxy
- Obtain an SSL certificate automatically

## 4. Connect

After the deploy script finishes, open:

```
https://your-domain.com
```

Create your first account at `/signup`.

## Updating later

```bash
cd open-sunsama
git pull
./deploy.sh
```

## Troubleshooting

**Caddy not getting a certificate?**
- Make sure your domain A record points to the VPS IP
- Make sure ports 80 and 443 are open

**Database migrations fail?**
- Check `DATABASE_URL` is correct
- Check PostgreSQL is healthy: `docker compose -f docker-compose.prod.yml ps`

**Want to see logs?**
- All: `docker compose -f docker-compose.prod.yml logs -f`
- API: `docker compose -f docker-compose.prod.yml logs -f api`
- Web: `docker compose -f docker-compose.prod.yml logs -f web`

## Customizations made

- Editing a time block's start/end time in the detail sheet now cascades shifts to all later blocks of the day.
- Drag/resize on the calendar already cascades later blocks.
- Create dialog now includes exact start/end time inputs.
- Toolbar adds a one-click **Break** button (15 min, gray block appended after the last block of the day).
- Toolbar adds a **Print** button that opens a simple text-based daily schedule in a printable window.
