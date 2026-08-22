name: Set Featured Crew Card

permissions:
  contents: write

on:
  workflow_dispatch:
    inputs:
      player:
        description: "Player slug or exact name (example: bostnmike)"
        required: true
        type: string
      edition:
        description: "Card edition (the player must have earned it)"
        required: true
        default: "Automatic - best earned card"
        type: choice
        options:
          - "Automatic - best earned card"
          - "Base Edition"
          - "Milestone - 10 Club"
          - "Milestone - 25 Club"
          - "Milestone - 50 Club"
          - "Milestone - 75 Club"
          - "Milestone - 100 Club"
          - "Heater - 2-game cash streak"
          - "Heater - 3-game cash streak"
          - "Heater - 4-game cash streak"
          - "Heater - 5-game cash streak"
          - "Heater - 9-game cash streak"
          - "Hall - Tax Collector"
          - "Hall - Direct Deposit"
          - "Hall - Billing Department"
          - "Infamy - Boy in the Bubble"
          - "Leader - Profit Leader"
          - "Leader - Knockout Leader"
          - "Leader - ROI Leader"
          - "Leader - Cash Rate Leader"

concurrency:
  group: tlpt-data-pipeline-main
  cancel-in-progress: false

jobs:
  set-featured-card:
    runs-on: ubuntu-latest

    steps:
      - name: Check out the latest site
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Refresh all source-derived data
        run: |
          python scripts/parse-event-reports.py
          node scripts/generate-event-index.js
          python scripts/build-site-data.py
          python scripts/build-knockouts.py

      - name: Resolve selected card ID
        id: card
        env:
          TLPT_CARD_OPTION: ${{ inputs.edition }}
        run: |
          case "$TLPT_CARD_OPTION" in
            "Automatic - best earned card") edition_id="auto" ;;
            "Base Edition") edition_id="base" ;;
            "Milestone - 10 Club") edition_id="milestone-10" ;;
            "Milestone - 25 Club") edition_id="milestone-25" ;;
            "Milestone - 50 Club") edition_id="milestone-50" ;;
            "Milestone - 75 Club") edition_id="milestone-75" ;;
            "Milestone - 100 Club") edition_id="milestone-100" ;;
            "Heater - 2-game cash streak") edition_id="heater-2" ;;
            "Heater - 3-game cash streak") edition_id="heater-3" ;;
            "Heater - 4-game cash streak") edition_id="heater-4" ;;
            "Heater - 5-game cash streak") edition_id="heater-5" ;;
            "Heater - 9-game cash streak") edition_id="heater-9" ;;
            "Hall - Tax Collector") edition_id="hall-tax-collector" ;;
            "Hall - Direct Deposit") edition_id="hall-direct-deposit" ;;
            "Hall - Billing Department") edition_id="hall-billing-department" ;;
            "Infamy - Boy in the Bubble") edition_id="infamy-boy-in-the-bubble" ;;
            "Leader - Profit Leader") edition_id="leader-profit" ;;
            "Leader - Knockout Leader") edition_id="leader-knockouts" ;;
            "Leader - ROI Leader") edition_id="leader-roi" ;;
            "Leader - Cash Rate Leader") edition_id="leader-cash-rate" ;;
            *)
              echo "::error::Unknown card option: $TLPT_CARD_OPTION"
              exit 2
              ;;
          esac
          echo "edition_id=$edition_id" >> "$GITHUB_OUTPUT"

      - name: Apply commissioner selection
        env:
          TLPT_PLAYER: ${{ inputs.player }}
          TLPT_EDITION: ${{ steps.card.outputs.edition_id }}
        run: python scripts/set-featured-card.py "$TLPT_PLAYER" "$TLPT_EDITION"

      - name: Rebuild selected Crew design
        run: python scripts/build-site-data.py

      - name: Validate and audit the complete site
        run: |
          python scripts/validate-site-data.py
          python scripts/audit-site-integrity.py

      - name: Publish featured-card selection
        env:
          TLPT_PLAYER: ${{ inputs.player }}
          TLPT_EDITION: ${{ steps.card.outputs.edition_id }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git add data/featured-cards.json
          git add data/parsed/events/
          git add data/generated/site-data.json
          git add data/generated/validation-report.json
          git add data/generated/integrity-report.json
          git add data/generated/knockouts-generated.json
          git add data/generated/knockouts.json
          git add knockouts.json
          git add knockout-events-full.json
          git add knockout-name-map-full.json

          if git diff --cached --quiet; then
            echo "No featured-card changes to publish."
            exit 0
          fi

          git commit -m "Feature ${TLPT_EDITION} Crew card for ${TLPT_PLAYER}"
          git push origin HEAD:main
