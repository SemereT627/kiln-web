# One shared card-list component for table→mobile conversion

**Status:** accepted

Eight admin/inventory pages (Stock, Sales Log, Order Approvals, Ceramic Types, Brands, Finishes, Users, Audit Logs) each render a `Table` for their primary data, but below `md` these need to become a stacked card list (one card per row, every column shown as a label: value line — see the mobile-responsiveness grilling session, 2026-07-19) instead of a horizontally-scrolled or column-hidden table.

Considered building this per page (bespoke hidden-below-md Table + hidden-above-md card markup on each page) versus one shared `DataCardList`-style component driven by row data + field definitions, with a render-prop/field-renderer API so page-specific cells (product image + name, avatar initials, status dot, badges, trailing dropdown action menu) still work.

Decided: build the shared component. Rationale — the 8 pages are structurally identical (rows → labeled fields → optional trailing actions) even though individual cell renderers differ, and a single implementation means the card styling, spacing, and interaction rules stay consistent and only need fixing in one place. The trade-off accepted is a less trivial initial API (must support custom field renderers, not just plain strings) versus the simplicity of copy-pasted per-page markup.
