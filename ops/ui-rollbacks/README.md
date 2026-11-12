# Independent visual rollbacks

The 23 September visual redesign is divided into fifteen areas. Each `.patch` changes only its named area back to its previous presentation, and the command disables that area's stylesheet. The patches were prepared against the combined release at `87966f7`; the separate voice recording, document transcript and local profile picture features are retained. Student records and saved work are never edited by these patches.

Run `npm run ui:rollbacks` to see the available areas. To roll back one area, run `npm run ui:rollback -- homework` (replace `homework` with another listed name). The command changes the local checkout only. Review the diff, run `npm test`, `npm run lint` and `npm run build`, commit and push the change, then run `npm run deploy` in the linked `rorys-english` Vercel project. A production deployment is required for everyone to see it. To bring that area back, run `npm run ui:restore -- homework` and repeat the checks and deployment. Multiple names can be supplied in one command.

The script requires a clean checkout and rejects a patch if later edits overlap it. This prevents a rollback from silently discarding newer work. A full release rollback is separately available through Vercel deployment history, but it affects all areas at once. These switches cover the visual redesign; they do not turn off the separate functional features added to the app afterward.

The areas are `entry`, `navigation`, `today`, `homework`, `lessons`, `practice`, `resources`, `writing-help`, `speaking`, `feedback`, `test-prep`, `documents`, `teacher`, `settings` and `header`.

`simplicity` (repaired 22 October 2026) returns the student screens, sign-in and year plan to the production presentation at `a669938`, without disabling a stylesheet. It includes only the named student components/styles and their dedicated tests. It preserves the teacher coach, audio capture, archive, API and later practice-ring credit. The earlier branch-wide reverse patch deleted the coach stylesheet and left incompatible tests; it has been replaced. Validate an applied rollback with the full tests, type checking and a build in an isolated copy. If later edits make this patch stale, review its explicit file scope before regenerating it; never reverse the entire branch diff.


`writing-feedback` restores the prior presentation of the three shared writing renderers. It keeps new feedback preparation, checkpoints, sentence validation, saved exercises, conversation links, private checks and learner records. The patch does not disable a stylesheet because its styling is shared with these retained functional features. As with all rollback areas, review and validate the applied patch before publication; later overlapping edits intentionally block automatic application.


`findability` (12 November 2026) returns the tab bar, sidebar and menu to their separate lists, removes Find from the student and teacher menus, and restores the second Back control on Resource library and Writing help. It covers only the navigation components, `student-navigation.ts`, the Find files, the navigation styles and `tests/find.test.mjs`; it does not disable a stylesheet. Release notes and the design spec stay as written, so add a note when it is applied. Recorded against the commit that introduced it and proven by applying it in an isolated copy, then running type checking and the full tests.

Four more areas were recorded on 12 November 2026, one per commit, and each rolls back on its own or with any of the others, in any order:

- `today-diet` puts the full practice panel back on Today, removes it from Feedback and restores the Speak and Feedback rows.
- `teacher-tabs` returns one student's workspace to seven tiles. `findability` shares `find.ts` and its test with this area, so roll `teacher-tabs` back first if `findability` has to go.
- `needs-you` removes the Needs you today list from the teacher home and makes Notifications the primary button again.
- `dashboard-folds` shows every block of the learning dashboard again, empty or not.

Each covers its own components, styles and tests, and none disables a stylesheet. Release notes and the design spec stay as written, so add a note when one is applied. Each was proven in an isolated copy, alone and all four together, with type checking and the full tests.

State on 12 November: `npm run ui:rollbacks` reports `entry`, `header` and these four as ready; `findability` becomes ready once `teacher-tabs` is rolled back.

`live-coach-resilience` (13 November 2026) returns live teaching to stopping its queue when one coaching request cannot be sent, ending the session on any service error, and four live sessions an hour. It covers `LiveTeachingCoach.tsx`, `coach-turns.ts`, the live-coach route, their tests and the paragraph in `LIVE_TEACHING.md`. It has no visual effect and disables no stylesheet. Proven in an isolated copy with type checking and the full tests.
