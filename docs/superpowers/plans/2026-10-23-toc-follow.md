# Reading-position TOC follow

User request: while scrolling Markdown, bold only the current TOC entry, reveal that entry by scrolling the TOC itself when necessary, and clear the indication one second after the last body scroll. Preserve other UI styles and native conversation behavior.

1. Add a real-browser regression around the existing Reader component with a long heading fixture; observe failure before implementation.
2. Track the current heading from the reading viewport, update a transient active entry, reveal it inside the TOC without scrolling the document, and clean up the idle timer. Limit CSS to current-entry text color/weight.
3. Verify forward/backward scroll, short final sections, TOC navigation, idle timeout reset, hide/show and unmount; run existing unit/build checks. Package and install the update, then close any isolated test instance.

Only Reader, its scoped CSS, version/package documentation and directly relevant tests need changes. Keep the internal plugin ID and storage format intact.
