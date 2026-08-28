# Repository Guidelines

## Project Structure & Module Organization

Probe-X is an Nx TypeScript monorepo. Applications live in `apps/`: `frontend` is the React/Ant Design dashboard, `web-sdk` is the tracking SDK, `ecommerce-demo` is the demo site, and the NestJS services include `receiving-point-service`, `data-dashboard-api-service`, `preliminary-data-processing-service`, and `final-data-cleaning-service`. Shared code lives in `libs/shared-types` and `libs/shared-utils`. Static frontend assets are in `apps/frontend/public`; service environment templates are in each `config/env/.env.example`. Architecture and operating notes are under `docs/`.

## Build, Test, and Development Commands

Use Node `22` from `.nvmrc` and Yarn 1.x (`packageManager` is `yarn@1.22.22`).

- `yarn install`: install workspace dependencies.
- `yarn start:frontend`: run the dashboard locally.
- `yarn start:frontend-system`: run `frontend` and `data-dashboard-api-service` together.
- `yarn start:dashboard-api`, `yarn start:receiving-point`, `yarn start:preliminary-processing`, `yarn start:final-cleaning`: run individual backend services.
- `yarn start:web-sdk`: run the SDK Rollup watcher.
- `yarn build:sequence`: build shared libraries and apps in dependency order.
- `yarn build`: build all configured projects in parallel.
- `yarn lint` / `yarn lint:fix`: run or auto-fix lint checks across projects.
- `yarn nx test web-sdk`: run SDK Jest tests. There is no root `yarn test` script currently.

## Coding Style & Naming Conventions

Write TypeScript with 2-space indentation. ESLint enforces no semicolons, trailing commas on multiline structures, React hook rules, JSX self-closing spacing, and no trailing spaces. Prettier is configured for 2 spaces, double quotes, semicolons, LF endings, and `avoid` arrow parens; when in conflict, follow the project lint result for touched files. Use PascalCase for React components, camelCase for functions and variables, and colocate page/component styles as `styles.module.scss`.

## Testing Guidelines

Tests live in `apps/web-sdk/src/__tests__` (Jest + `ts-jest` + `jsdom`, run via `yarn nx test web-sdk`) and `apps/final-data-cleaning-service/src/__tests__` (Jest + `ts-jest`, run via `yarn nx test final-data-cleaning-service`). Name tests `*.test.ts`, `*.spec.ts`, or place them under `__tests__/`. Add focused tests for SDK behavior and shared utilities when changing collection, session, sender, or config logic. The cleaning service's `e2e-real-data.test.ts` connects to a real ClickHouse and is excluded from the default run; use `yarn test:e2e` in that package to run it explicitly. For service or UI changes without tests, document manual verification in the PR.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style prefixes such as `feat:` and `fix:`; keep subjects concise and scoped to the change. Pull requests should describe the behavior change, list commands run, link related issues or OpenSpec changes when applicable, include screenshots for UI updates, and call out new environment variables, migrations, or deployment steps.

## Security & Configuration Tips

Never commit real secrets or local `.env` files. Start from the relevant `config/env/.env.example` and document any new required settings in the same directory and in PR notes.
