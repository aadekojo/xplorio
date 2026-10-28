# Security

Xplorio is a personal project that may be opened to a small group of invited friends.

## Principles

- **The API is the only thing that touches secrets or the database.** The app never sees the flight data key.
- **User ID comes from the validated token, never from the request.** Every query is scoped to that user's partition.
- **Store only what the app needs:** flight number, date, nickname, alert settings, email. No booking references, seats, passport or loyalty numbers.
- **Data stays in Canada** (Azure Canada Central).
- **No long-lived cloud credentials in GitHub.** Deploys use OIDC federated credentials.

## Repo hygiene

- `local.settings.json` and `.env*` files are git-ignored; use `local.settings.example.json` as the template.
- CI runs gitleaks on every push and pull request, and `pnpm audit` on production dependencies.
- Dependabot opens weekly dependency and GitHub Actions updates.

## Reporting

Found something? Email the repo owner directly rather than opening a public issue.
