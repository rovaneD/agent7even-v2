# CONTEXTV29 — Foundation rescore persistence hardening
*Snapshot: July 14, 2026 — supersedes `CONTEXTV28.md`*

## Repository state

- Repository: `rovaneD/agent7even-v2`
- Development branch: `cursor/critical-bug-investigation-5955`
- Prior handoff: `CONTEXTV28.md`

## Critical bug fixed

`POST /api/foundation/score` used a delete-then-insert sequence for
`foundation_field_scores`. Both writes ignored Supabase errors. If the delete
succeeded and the insert failed, the route returned success after permanently
removing every per-field score for the profile. Reloaded Foundation section
scores disappeared, and the image/video generation floor could reject the
profile as having no scores.

The route now:

1. Fails closed if existing scores cannot be read.
2. Upserts the complete replacement set before deleting anything.
3. Prunes only historical keys after the upsert succeeds.
4. Returns 500 on score or profile persistence errors instead of reporting a
   successful rescore.

An upsert failure now leaves the previously persisted score set intact.

## Carry-forward

All open items and implementation rules from `CONTEXTV28.md` remain current.
See `SESSION_2026-07-14.md` for investigation and validation details.
