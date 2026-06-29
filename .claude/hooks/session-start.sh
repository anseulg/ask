#!/bin/bash
# SessionStart hook for pmcamp (Claude Code on the web).
# Prepares a PHP/Composer project so code, linters and tests are ready to run.
set -euo pipefail

# Run only in remote (Claude Code on the web) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$PROJECT_DIR"

# --- Git submodules ---------------------------------------------------------
# Vendored deps (e.g. lib/facebook-php-sdk-v4) live as submodules. Outbound
# egress is policy-controlled in remote sessions, so a clone failure is
# non-fatal: warn and continue rather than blocking session startup.
if [ -f .gitmodules ]; then
  echo "==> Initializing git submodules"
  if ! git submodule update --init --recursive; then
    echo "WARN: submodule init failed (likely network policy); continuing." >&2
  fi
fi

# --- Composer (PHP) ---------------------------------------------------------
# Install PHP dependencies when a manifest is present. The container is cached
# after the hook completes, so a plain install (not --no-dev) keeps dev tools
# such as phpunit/phpcs available for tests and linting.
if [ -f composer.json ]; then
  echo "==> Installing Composer dependencies"
  if ! composer install --no-interaction --no-progress; then
    echo "WARN: composer install failed; continuing." >&2
  fi
else
  echo "==> No composer.json yet; skipping Composer install"
fi

echo "==> Session start hook complete"
