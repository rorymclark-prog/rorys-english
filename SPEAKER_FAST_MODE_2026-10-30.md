# Hands-free speakers and fast coaching

30 October 2026. Focused release based on production main `cb288c342e304211c0b70bed61bb5d12cb82be86`. Keeps the existing server credentials and model configuration. No billing, sharing, learner records, library bridge or unpublished Lesson workspace changes.

Automatic speaker mode is the default for room and online audio. Each response references one exact current item plus up to four earlier audio items for voice/conversation context, including opening voices or teacher-confirmed examples. Earlier model estimates stay unconfirmed. The model can return teacher, learner, mixed or unknown with high/low confidence. Labels are visibly marked AI estimates and remain separate from the confirmed evidence role in saved notes and exports. Only high-confidence single-learner estimates can display a faithfully bounded possible correction, explicitly requiring teacher judgement. Other turns keep useful conversation prompts instead of blocking on labels. Per-caption correction is optional and folded away; it invalidates linked in-flight and completed advice.

Fast mode defaults to a 650 ms end-of-speech threshold and a 900-token response ceiling, using the same configured real-time model. Balanced permits 1,100 ms and 1,400 tokens. Timing changes work during the same session without acquiring another microphone. These settings do not guarantee end-to-end response latency.

Validation: 473 automated checks passed in the focused release, including real component event handlers with synthetic WebRTC responses. The larger active development checkout also passed its existing production build and 532 tests before the six additional speaker tests were added. The focused build was blocked downloading the unchanged Google Fonts because local DNS cannot resolve fonts.googleapis.com. Local preview sockets are denied (EPERM), so no browser or real-audio identification quality claim is made. Realtime role estimation is model judgement, not the diarization API or verified voice recognition. No paid audio request or real microphone access was used during these checks.

Publication and CI receipts will be recorded after release.
