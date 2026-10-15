# Changelog

## Unreleased

### New

| Change | Where | What it does |
|---|---|---|
| Watermark tab | Admin | Choose many photos and videos at once from the phone gallery. The server adds the watermark, and the files wait in a library |
| Watermark settings | Admin, Watermark tab | Text (your handle by default), six fonts, moving or a fixed corner, size, opacity and speed, with a live preview. The last settings used are kept |
| Leave while it works | Admin, Watermark tab | After the uploads finish, close the page. The server keeps going, and the files are ready when you come back |
| Add to product | Admin, Watermark tab | "Add to product…" puts a ready file at the end of a product's photos and videos. "Copy link" copies its address |
| From library | Admin, product editor | A new "From library" tile picks watermarked files for the product |
| Previewer | Admin, Watermark tab | Tap a ready file to see it full size, play videos, and swipe through the rest. Add it to a product, move it, copy its link, or delete it from there |
| Folders | Admin, Watermark tab | Make folders to sort the library. Uploads go into the folder that is open. Deleting a folder keeps its files in Unfiled |

### Notes

- Keep the page open until the uploads finish. A phone browser cannot upload from a closed page. The page asks before it closes and keeps the screen awake while uploading.
- Videos are saved at up to 1080p as MP4. iPhone HDR videos are converted so their colours look right. Location data is removed from the files.
- The original files are deleted once the watermarked copy exists. To change the text, upload again.
- One file is watermarked at a time. A big batch waits its turn.
- Set the R2 lifecycle rule in [01 Prepare, 3.6](docs/setup/01-prepare.md#36-lifecycle-rule-for-originals) before the first deploy.

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
