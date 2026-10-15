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

| Analytics tab | Admin | Taps by day, by hour of day and by day of week, taps per shop, top products and top buy links, with insights in plain sentences. Choose 7, 30 or 90 days. Times are Malaysia time |
| One button per shop | Public page, product view | A shop with several links shows one button, "Buy on Shopee · 2 options", that opens the list of options |
| Bio paragraphs | Profile, public page | Press Enter in the bio to start a new paragraph |
| Bio text size | Profile, public page | Choose Small, Medium or Large for the bio. Medium is the size it had before |

| Analytics dashboard | Admin, Analytics tab | Filter by category, product and shop. Tiles for visits, product views, buy taps, taps per visit and WhatsApp chats. Overview diagrams replace the sentences. Sections for visits, taps, products, shops and searches |
| Visits, views and searches | Public page | The page records visits, which products are opened, and what visitors search for, with how many finds each search showed |
| WhatsApp button | Public page | A round WhatsApp button at the bottom left opens a chat with the number in Profile |
| Drag to reorder products | Admin, Products | Drag the handle on a row to move a product. The up and down buttons are gone |

### Changed

| Change | Where |
|---|---|
| "Nothing here yet" uses the same font as the page, in bold | Public page |
| The product photo is square and at most 40% of the screen height | Public page, product view |
| A product video over 50 MB, or not a video, now fails at once with the file name, under the media tiles | Admin, product editor |
| Buy buttons sit under the product name, above the review, so they show without scrolling. The photo area is at most half the screen height | Public page, product view |
| The privacy page says that the time of each tap is recorded | Privacy |

### Notes

- The analytics charts start from this release. Earlier taps are in the all-time total only, because their times were not recorded.

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
