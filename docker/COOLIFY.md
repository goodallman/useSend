# Image a nasazení na Coolify

Coolify stack používá předem sestavený multi-platformní image:

```text
ghcr.io/goodallman/usesend:latest
```

Image se sestavuje pro `linux/amd64` i `linux/arm64` pomocí workflow
`.github/workflows/publish.yml`. Workflow se spustí při pushi do `main`, při
vytvoření tagu `v*` nebo ručně přes GitHub Actions. Publikuje tyto tagy:

- `latest` pro aktuální `main`
- Git tag, například `v1.0.0`
- neměnný `sha-<commit>` tag

Po prvním publikování nastav GitHub package `goodallman/usesend` jako **Public**,
aby jej Coolify mohl stáhnout bez přihlašovacích údajů k registru.

## Nasazení jako Coolify Service

Obsah `docker-compose.coolify.yml` lze vložit jako raw Docker Compose service,
případně může Coolify načíst soubor z repozitáře. Compose už nic nesestavuje;
pouze stáhne publikovaný image.

- Docker Compose Location při použití repozitáře: `/docker-compose.coolify.yml`
- Veřejná služba: `usesend`, port `3000`
- Volitelný `USESEND_IMAGE_TAG`: výchozí je `latest`; pro neměnné nasazení
  použij například `sha-0123...`

Coolify automaticky vygeneruje veřejnou URL, heslo PostgreSQL,
`NEXTAUTH_SECRET` a `NOYRA_API_KEY`. Ručně je potřeba vyplnit pouze:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- volitelně `AWS_DEFAULT_REGION` (výchozí je `us-east-1`)
- volitelně SMTP a ostatní proměnné s výchozí hodnotou

Po načtení Compose nastav u služby `usesend` vlastní doménu, pokud nechceš
použít automatickou doménu Coolify. `SERVICE_URL_USESEND_3000` se použije jako
`NEXTAUTH_URL`.

Pro externí Noyra službu zkopíruj z přehledu proměnných v Coolify hodnotu
`SERVICE_HEX_64_NOYRA`. V kontejneru je stejná hodnota dostupná jako
`NOYRA_API_KEY`.

PostgreSQL ani Redis nemají namapovaný port hostitele a jsou dostupné pouze v
privátní síti Compose stacku. Jejich data zůstávají v persistentních Docker
volumes.
