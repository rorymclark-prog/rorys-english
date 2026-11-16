# Current homework and readable lesson feedback

Current homework can carry an explicit `assignmentId` and `unitId` in its safe lesson-practice record. HomeworkHub resolves the conversation for that assignment, and uses that same plan for writing, vocabulary and the optional retained reading source. A newer unrelated conversation cannot silently replace it. Legacy unbound plans remain supported. The practice editor preserves the binding and source fields.

An active homework hub takes priority over static starter exercises. Earlier exercises remain in the reference disclosure, without depending on an old reset assignment being present.

`src/lib/homework-refresh.ts` generates title and numbered instructions from one checked practice plan. Before saving and after native readback, run from this checkout:

```
node scripts/check-homework-refresh.mjs /absolute/private/plans.json /absolute/private/ready-plans.json
```

A plan entry contains `learner`, `date`, `assignmentNumber` and the shared `record` with its bounded `lessonPractice`. The generated assignment has a new stable ID for a genuinely new writing task and no inferred deadline. Supersede previous current assignments, preserving all originals and historical submissions. A supplied `assignment` is checked rather than overwritten: mismatched links, title, writing, vocabulary, speaking, source or an expired deadline fail verification. Do not checkpoint the lesson workflow complete until exact saved records and student placement agree.

The feedback view leads with the short plain-language review and private teaching advice. Full evidence, scores and method are closed initially. Text has a comfortable reading width and larger body size, the expanded summary is not repeated, and unmarked work says Not scored without an empty score bar. Formal publication remains an explicit separate action.

Validation: 598 automated tests, TypeScript and production build pass. Regression checks cover exact homework-to-conversation matching, current homework versus starter exercises, coherent generated tasks and dates, bounded safe source fields, and initially closed assessment evidence. Isolated desktop and 390px browser checks verified the teaching-before-evidence order, readable feedback, both homework identities, full writing briefs, Ferdi's source disclosure and no horizontal overflow. All preview services were stopped afterwards. No backend deployment or model/provider change is required.
