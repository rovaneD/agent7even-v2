#!/usr/bin/env bash
# Fix Stripe product tax codes for Managed Payments "Needs info" badges.
#
# Usage:
#   chmod +x scripts/stripe-fix-product-tax-codes.sh
#   ./scripts/stripe-fix-product-tax-codes.sh          # test mode
#   ./scripts/stripe-fix-product-tax-codes.sh --live   # live mode
#
# Live mode: `stripe login` often gives rk_live_* (read-only). For writes, either:
#   1. Stripe Dashboard → each product → Edit → Product tax code → SaaS business use
#   2. Export your secret key and run:
#        export STRIPE_LIVE_SECRET_KEY=sk_live_...   # Dashboard → Developers → API keys
#        ./scripts/stripe-fix-product-tax-codes.sh --live
#
# First-time live CLI read access: stripe login

set -euo pipefail

LIVE_FLAG=()
API_KEY_FLAG=()
MODE="test"
if [[ "${1:-}" == "--live" ]]; then
  LIVE_FLAG=(--live)
  MODE="live"
  if [[ -n "${STRIPE_LIVE_SECRET_KEY:-}" ]]; then
    API_KEY_FLAG=(--api-key "$STRIPE_LIVE_SECRET_KEY")
    echo "Using STRIPE_LIVE_SECRET_KEY (sk_live) for writes"
  elif [[ -n "${STRIPE_SECRET_KEY:-}" && "${STRIPE_SECRET_KEY}" == sk_live_* ]]; then
    API_KEY_FLAG=(--api-key "$STRIPE_SECRET_KEY")
    echo "Using STRIPE_SECRET_KEY (sk_live) for writes"
  else
    echo "Note: stripe login uses rk_live (restricted). Updates may fail without sk_live."
    echo "      Set STRIPE_LIVE_SECRET_KEY=sk_live_... or edit products in Dashboard."
    echo ""
  fi
fi

TAX="txcd_10103001"

echo "Stripe product tax-code fix ($MODE mode)"
echo "Tax code: $TAX (SaaS — business use)"
echo ""

while IFS=$'\t' read -r id name current; do
  [[ -z "$id" ]] && continue
  if [[ "$current" == "$TAX" ]]; then
    echo "✓  $name ($id) — already set"
    continue
  fi
  echo "→  $name ($id)"
  stripe products update "$id" --tax-code="$TAX" -c "${LIVE_FLAG[@]}" "${API_KEY_FLAG[@]}"
done < <(
  stripe products list --active=true --limit=100 "${LIVE_FLAG[@]}" "${API_KEY_FLAG[@]}" | node -pe "
    JSON.parse(require('fs').readFileSync(0,'utf8')).data
      .map(p => [p.id, p.name, p.tax_code || ''].join('\t'))
      .join('\n')
  "
)

echo ""
echo "Verify seat price (live):"
echo "  stripe prices retrieve price_1TjjuPCxbhDrehHZ3fNwEK9U --live -c"
echo ""
echo "Refresh Stripe Dashboard → Product catalog."
