# Student-first lesson selection and document-aware coaching

30 October 2026. Release based on production `c0a9860c22898a0828a6eba2ee8d3c0a26015818`; it excludes the unrelated private Lesson workspace and Practice follow-up. Existing AI credentials and model configuration remain in use.

## Behaviour

Select the student before starting, then choose a prepared lesson, an app slide PDF, a saved teaching pack or a learning-plan overview. Original conversation practice is an explicit alternative. A dashboard student can be preselected. Student changes stop listening, clear lesson context and require consent again. The setup folds away when listening starts.

The saved-folder connection reads Current_Library_Manifest.json and lists only the selected student's packs. It selects the current Teaching.pptx and its Delivery_Guide.md, rather than older supporting PDFs. It reads a selected deck on the device, including its embedded notes; no full folder or lesson binary is published to the repository or server. The folder remains connected across student changes within this teaching session and must be selected again after closing/reloading the tab. Verified against the real saved folder: 46 decks, 18 Ferdi and 28 Valentin.

An uploaded PDF is indexed across all pages before live coaching can start. Its bounded whole-document map, current exercise and matching teacher notes accompany coaching and private questions. The current page image remains available for visual grounding. Image-only PDFs support the displayed page image, but cannot reliably locate other pages from speech alone.

Automatic lesson tracking estimates the current exercise from the actual conversation and document map. A private AI reference changes only when a high-confidence model estimate is supported by an explicit matching page number or sufficiently distinctive words in the actual document. Ambiguous/repeated exercises do not trigger a jump. Manual reference mode and teacher page changes take precedence over pending estimates. AI reference updates never change the displayed or student slide, reveal an answer, establish completion or create a grade. A cover image is excluded when the AI reference has moved to another page. This is inferred lesson position, not observation of an external PowerPoint window.

## Cloud library boundary

The existing owner-private online library remains available as a browse link. Publishing its separate connection assets is still blocked because git.chatgpt-team.site cannot resolve in this environment. The failed direct connection button is not exposed in this release. The working in-app route for all prepared packs uses the saved folder; approved app PDFs and learning-plan choices work independently. No Site access, credential, R2 catalogue, sync automation or file-sharing setting changed.

## Validation

516 focused-release tests and TypeScript pass. Tests exercise the real live component handlers with synthetic WebRTC events, full-document context, private reference changes while the displayed cover stays fixed, stale image exclusion, manual overrides, setup gating and consent. Existing speaker estimates and Fast mode remain. The active development build passed during implementation. Local preview sockets are denied; production build/preview and signed-in UI verification are handled by the existing GitHub/Vercel pipeline. No real audio or paid model request has been used to claim lesson-position accuracy.
