# Changelog

## 2026-10-15

### New

| Change | Where | What it does |
|---|---|---|
| Several buy links per platform | Admin, product editor | Each platform (Shopee, TikTok, WhatsApp) can have more than one link. Select "+ Add Shopee link" to add one, and ✕ to remove one |
| Link labels | Admin, product editor | Each link has an optional label, for example "Size M" or "Set of 4". Visitors see the label on the buy button: "Shopee · Size M" |
| Drag to reorder media | Admin, product editor | Hold a photo or video and drag it to a new place. This works with a mouse and on a phone. The first photo is still the cover |
| Full-screen review editor | Admin, product editor | Select "Expand" next to "My honest review" to write in a full-screen box. Select "Done" or press Esc to close it |

### Changed

| Change | Where | What it does |
|---|---|---|
| Click counts per link | Admin, products list | Each link counts its own taps. The products list shows the total for each platform |
| Buy buttons | Public page | A product shows one buy button for each link, in the order set in admin |

### Removed

| Change | Where |
|---|---|
| Watermark with the handle over photos and videos | Public page, product view |
| "Some links are affiliate links" line | Public page, footer. The Privacy link stays |

### Fixed

| Change | Where |
|---|---|
| Parts of the admin page were hidden when an ad blocker was on | Admin |
| Layout and account menu on small screens | Admin |

### Upgrade notes

- The database updates itself on the first start. Existing links and click counts move to the new link list, with no label.
- Old buy-button addresses in the form `/go/<product>/<shop>` now show "Not found". New addresses are `/go/<link id>`. The public page uses the new form, so only a page that was open before the update is affected. Reload it to fix.
