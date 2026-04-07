# Franco-Arabic Track Migration

## Goal

This migration introduces a track-aware academic model without removing the legacy `Enrollment`
table immediately.

## What is added

- `AcademicTrack`: `FRANCOPHONE`, `ARABOPHONE`
- `RotationGroup`: `GROUP_A`, `GROUP_B`
- `AcademicPlacementStatus`: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `COMPLETED`
- `PedagogicalRuleType`:
  - `FIRST_CYCLE_PARALLEL_ROTATION`
  - `SECOND_CYCLE_WEEKLY_TRACK_SPLIT`
- `StudentTrackPlacement` as the new academic positioning source of truth
- `PedagogicalRule` for configurable rotation and weekly track rules
- Track-aware fields on:
  - `levels`
  - `classes`
  - `enrollments`
  - `grades`
  - `report_cards`
  - `attendance`
  - `timetable_slots`

## Backfill performed

Existing mono-track data is backfilled as:

- `track = FRANCOPHONE` by default
- one `StudentTrackPlacement` created from each existing `Enrollment`
- legacy rows linked through `legacy_enrollment_id`
- `grades`, `report_cards` and `attendance` linked to the corresponding placement when found

## Temporary compatibility assumptions

- Existing data is considered `FRANCOPHONE` until explicitly migrated otherwise.
- `Enrollment` remains available for compatibility during the transition.
- The new source of truth is `StudentTrackPlacement`.
- `Enrollment` is still synchronized when a placement has a concrete classroom.

## Business decisions now implemented

- report cards:
  - `PRIMARY + PRIMARY` active placements generate one combined primary report card
  - any strategy involving a `SECONDARY` or `HIGHER` placement generates distinct track report cards
  - combined primary report cards store explicit section details for both tracks
- finance:
  - the principal placement is determined automatically from the academic hierarchy
    (`academicStage` -> `cycle.sortOrder` -> `level.sortOrder`)
  - invoicing follows the principal placement
  - the secondary placement remains visible on invoice reads
- portal/admin display:
  - parent and admin views now expose `classe principale` and `classe secondaire`
  - track-aware placement lists remain available for deeper inspection

## Recommended rollout

1. Apply the Prisma migration.
2. Regenerate Prisma Client.
3. Verify `StudentTrackPlacement` backfill counts against `Enrollment`.
4. Validate:
   - reference data creation with `track`
   - cycle creation with `academicStage`
   - enrollment creation
   - principal/secondary placement ordering
   - invoice creation against the principal placement level
   - attendance creation
   - timetable rule validation
   - grade/report-card generation, including combined primary bulletins
   - teacher/parent portal reads
5. Only then start migrating legacy `Enrollment` to read-only flows.
