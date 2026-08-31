# Lesson Persistence Contract

Date: 2026-08-31

## Current User Flow

1. Generate lesson content in `lesson-plan-generator.tsx`.
2. Save to `lesson_plans` from the generator flow.
3. Auto-save to `saved_lessons` after generation.
4. Reload and edit from `lesson-view.tsx`.
5. List and delete from `my-lesson-plans-list.tsx` and `workspace.tsx`.

## Persistence Notes

- `lesson_plans` is the earlier candidate for a boundary move because it is localized to the generator screen.
- `saved_lessons` is migration critical and spans generation, reload, and delete flows.
- There is already a schema-compatibility fallback for `saved_lessons.chapter` in the generator save path, which makes the contract more delicate than a plain insert/update.

## Risk Notes

- Saving is user-visible and irreversible once content is reused across screens.
- The persistence path must keep row ownership checks, response shapes, and failure behavior intact.

