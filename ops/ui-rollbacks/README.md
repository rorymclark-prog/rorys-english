# Independent visual rollbacks

The 23 September visual redesign is divided into fifteen areas. Each `.patch` changes only its named area back to its previous presentation, and the command disables that area's stylesheet. The patches were prepared against the combined release at `87966f7`; the separate voice recording, document transcript and local profile picture features are retained. Student records and saved work are never edited by these patches.

Run `npm run ui:rollbacks` to see the available areas. To roll back one area, run `npm run ui:rollback -- homework` (replace `homework` with another listed name). The command changes the local checkout only. Review the diff, run `npm test`, `npm run lint` and `npm run build`, commit and push the change, then run `npm run deploy` in the linked `rorys-english` Vercel project. A production deployment is required for everyone to see it. To bring that area back, run `npm run ui:restore -- homework` and repeat the checks and deployment. Multiple names can be supplied in one command.

The script requires a clean checkout and rejects a patch if later edits overlap it. This prevents a rollback from silently discarding newer work. A full release rollback is separately available through Vercel deployment history, but it affects all areas at once. These switches cover the visual redesign; they do not turn off the separate functional features added to the app afterward.

The areas are `entry`, `navigation`, `today`, `homework`, `lessons`, `practice`, `resources`, `writing-help`, `speaking`, `feedback`, `test-prep`, `documents`, `teacher`, `settings` and `header`.
