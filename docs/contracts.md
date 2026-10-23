# Installed DSH contracts and verification

Target inspected and exercised: DeepSeek Harness Desktop 0.2.1-rc.2, dsh-claude-style 0.16.2, Windows. Shipped sources were inspected as inert data from app.asar; extracted files remain ignored under `.cache/installed/` and are not included in releases.

## Native integration

- `main` panel key and `sidebar.panellist` ID are both `md-reader`. Layout navigation selects the dedicated page.
- The panel declares `md-reader.conversation` as a session-scoped child slot. Its `SessionProvider` receives a retained document session reference; the child mounts `conversation.content` with `variant: embedded`, `hero: false`, `phase: active`.
- The chat, input, model, streaming, stop, tools, approvals and other input extensions are DSH's existing components. No separate provider client or credential store is introduced.
- `sessions.create()` allocates a session without requesting a model. `sessions.retain()` owns its binding/history. Before restoration, refresh the native catalog if the stored ID is absent. `reference.ready` can resolve with `openState: error`, so inspect that state explicitly. Abort pending opens and unmount the old Provider before releasing its reference.
- Native selection insertion uses `conversation.input.for(sessions.scope(id))`, `actions.captureInsertion()`, `insertReference()` and `focus()`. An input-trigger codec serializes the original selection as quoted document text.
- Mount custom Typert descriptors, then inject `remote.mdReader`. Host descriptors validate bounded input. Library endpoints reject non-owner principals.
- The host registers a required context named `dsh-md-reader:document`, with `interpolate: false`, only when `agent.id` matches a document-owned session. The complete text is a user-role runtime context; fence lengths preserve literal Markdown and untrusted instructions. The `agent/request` hook checks the complete context against model metadata without truncation.
- Full text and session mapping live under DSH home `dsh-md-reader/documents/`. Per-document queues serialize record read, field merge, atomic persistence and in-memory publication, preserving concurrent source-path and scroll changes.
- Local file identity comes from `__DSH_HOST_PATHS__.pathFor(file)`. Relative images resolve beside that source via the authenticated native `api/file` route. Network shares and script schemes are rejected.

## Claude-style compatibility

Claude's global replacement model button uses the main conversation and can show “选择模型” for an embedded independent session. Inside `.mdr-native` only, restore the existing session-scoped model host and suppress that replacement. Native menu interactions were exercised.

The narrow composer wraps its controls and lets the row grow. Claude's overlaid statistics dock is placed in normal flow within this page so it cannot cover model or send controls. Semantic attributes are used instead of generated class hashes. No Claude plugin files or unrelated chat plugins are modified.

## Validation evidence

- `npm test`: 16 tests, no failures. Includes literal/full context, dense backticks, budget rejection, session isolation, failed native session opens, native quote serialization, local paths and concurrent persistence regression (observed failing before the fix).
- `npm run build`: generated bundle is syntax checked through `vm.Script`.
- `node test/installed-smoke.mjs`: 8 installed integration groups, no reader/slot page errors. Import/drop, native Markdown, model menu, search, retained scroll/session, quote insertion, independent drafts, relative image loading, inert malicious links/HTML, divider and light/dark rendering.
- `npm run test:browser`: native model/send controls remain within the chat column. Narrow 760×900 viewport also has no horizontal reader overflow.
- Real model: `deepseek-v4.1-flash-1017`, through the native DSH composer. Selecting only the early signal paragraph and asking about the complete file produced `7.3 Gbit/s`, `ORCHID-7319-K8M`, and the correct later source sections. The separate fixture produced `2.6 Gbit/s` and `CEDAR-2600-T9P`. Native stop restored the send control, and a subsequent question completed correctly.

Test sessions contain authored synthetic facts only. Model calls are deliberately manual verification, never part of `npm test`. Screenshots are stored locally under ignored `test-results/`. Existing unrelated font-resource 404s and a pre-existing incompatible vision plugin were not modified. A transient desktop-host `ERR_NETWORK_IO_SUSPENDED` during a test-instance restart cleared on restart; it occurred before the reader loaded.

## 0.1.7: transient TOC follow (2026-10-23)

Body scrolling marks the current heading with `aria-current="location"` and changes only that TOC entry's text color/weight. The TOC adjusts its own scroll position only when the marked entry is outside its viewport; this also works when body scrolling continues within the same section after manually moving the TOC. One second without a body scroll clears the indication. Pending timers are cleaned up on document unmount.

`test/reader-scroll.mjs` mounts the actual Reader in React with a long synthetic heading fixture and checks real browser layout: forward/backward follow, manually displaced TOC, unchanged body position, short final section, timer reset, original style restoration, directory links, hide/show and unmount. This optional check uses Playwright, webpack, React and React DOM; it does not start DSH or call a model. The installed DSH smoke check now contains 9 groups, including native Markdown TOC tracking and idle clearing. All 16 existing unit tests and the native-control layout checks also pass.

## 0.1.8: TOC motion and shadow interaction

A single decorative marker sits behind the TOC buttons and animates its transform/height between active headings. The marker adds a soft shadow and an accent edge, fades in/out through CSS, and cannot intercept pointer input. The TOC reveals headings with native smooth scrolling; reduced-motion uses instant scrolling and disables transitions. Existing heading detection, the 1000ms idle delay, document position and native AI session bindings are preserved. Browser checks also verify marker alignment, transform transitions, idle reopening without a flash, and reduced-motion behavior.

## 0.1.9: reader-only side-chat control

The reader's `.mdr-native` area hides only `dsh-side-chat`'s stable `.dsh-side-chat-trigger` control. The standalone side-chat plugin and its normal conversation entry remain registered and unchanged. Browser checks verify the CSS does not hide the same control outside the reading conversation. Switching between the installed reader and the normal DSH conversation also confirms the control is hidden in the reader and visible in the normal conversation.

## Limits

UTF-8 `.md`/`.markdown`, maximum 2 MiB per file. Imported documents are immutable snapshots; reimport changed content to start its own session. Local images require the original source path and image file to remain available. Closing a tab preserves the document library and session history. DSH extensions and runtime changes beyond the versions above are not exhaustively tested.
