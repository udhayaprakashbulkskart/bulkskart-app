---
name: product-images
description: "Plan professional product photos for a BulkSkart listing. Covers the shot list with multiple angles, the cover image, a phone-friendly photography brief for the factory floor, captions, alt text under 125 characters, file names, upload steps for the product-images bucket, a have/missing/retake status table and image-rights checks. Works for one product, a whole catalogue, or labelled demo plans in bulk. Use when a product needs photos, its images are weak or missing, or alt text and captions are needed."
argument-hint: "[product name or listing | audit <product slug> | demo <count> [category]]"
---

# BulkSkart product images

Plan the photos a bulk buyer needs before asking for a quote: what it looks like, how it is made, how it is packed and how big it is. The plan fits what the site does with images.

Request: **$ARGUMENTS**

| Mode | When | Output |
| --- | --- | --- |
| **Plan** (default) | A product or listing that needs photos | Shot list, brief, captions, alt text, file names, status table |
| **Audit** | "audit", "check images", a product slug or the listing's current image list | What is wrong with the current images, then the plan for what is missing |
| **Catalogue / demo** | Many products, or "demo …" | One plan per product in `content-drafts/` or `demo-content/` |

## How BulkSkart uses images

Read once per session: `src/components/common/MultiImageUploader.tsx` and `src/lib/storage.ts`.

- **Where they live.** Images are stored in `products.images` (`text[]`). **`images[0]` is the cover** (marked "Cover Photo" in the
  uploader) on product cards and search results; the rest form the gallery on the product page.
- **Limits.** At most **10 images** per product, each up to 5 MB, uploaded under **Dashboard → Products → edit → Images**.
  The browser converts them to WebP, at most 1920 px wide and about 1 MB, into the public `product-images` bucket.
- **File names.** The upload keeps the first 30 characters of the file name (non-letters become `_`), then adds a time
  stamp. So name files so that the first 30 characters say what they show.
- **Company photos** (`logo_url`, `cover_url`, `banner_url`, `gallery_images`) go to `company-assets` from the company
  profile page. Factory photos belong there, not on products.
- **Credits.** A licensed image from elsewhere must have its credit recorded in `product_image_sources`: provider,
  source page, creator, licence and URL, with `status` `needs_review` until an admin applies it.

## The shot list (merged from the general product-images skill, adapted for B2B)

Pick 6–10 shots, cover first, in this order. Skip the ones that make no sense for the product and say why.

| # | Shot | What it shows a bulk buyer | Required? |
| --- | --- | --- | --- |
| 1 | **Cover: front, plain background** | The product filling ~80% of a square frame, white or light-grey seamless background, no props | Always |
| 2 | **Back / reverse** | Construction, stitching, rear ports or fittings | Usually |
| 3 | **Side / 45° angle** | Depth and shape | Usually |
| 4 | **Close-up of material or finish** | Weave, grain, weld, coating, print quality: the thing they will judge the sample on | Always |
| 5 | **Scale reference** | Next to a ruler, a hand or a standard object, or with dimensions marked | Always for anything whose size is not obvious |
| 6 | **Label / nameplate / marking** | Rating plate, batch label, size tag, GSM tag | When the product carries one |
| 7 | **Packing: unit and carton** | Polybag / inner box, master carton with marking, pallet or bag stack | Always: bulk buyers price freight from it |
| 8 | **Bulk quantity** | Many units together: stacked cartons, a rack of rolls, a bag pile | Strongly advised |
| 9 | **In use / application** | Fitted, worn or installed. Only a real use, never a staged claim | When it helps |
| 10 | **Variants** | Colour, size or finish range in one frame | When variants exist |

Food, chemicals and agro products also need: the product spread on a white tray (colour and size), a sealed pack with
its label, and the bag or drum with its marking. Never a lab report as a "photo".

## Photography brief (for a phone on the factory floor)

Most BulkSkart sellers shoot with a phone, so write the brief for that:

- **Light.** Daylight near a big window or under a shed, not direct sun; turn off yellow tube lights; no flash.
- **Background.** A white sheet or chart paper taped up in a curve (a "sweep"); grey for white products.
- **Phone settings.** Clean the lens; use the main (1×) lens, no digital zoom; turn on the grid; tap to focus on the
  product; shoot in square 1:1, or leave room to crop square. At least 1200 × 1200 px.
- **Each shot.**
  - Take 3 frames and keep the sharpest.
  - Hold the same distance and height for every product in a range so the catalogue looks consistent.
  - Use a tripod or rest the phone on something.
- **Clean.** Remove dust, threads and fingerprints. Hide other brands' logos, price stickers and people's faces.
- **No edits that change the product.** Crop, straighten and fix brightness only. Never change the colour away from
  the real product, remove defects, or add text or badges on the image.

## Captions and alt text

- **Caption** (shown in the gallery and to the seller), 80 characters at most: factual, with the shot name.
  Example: "Master carton, 50 pcs, 5-ply, 60 × 40 × 40 cm".
- **Alt text** for screen readers and search, **under 125 characters**:
  - product + key spec + what this view shows;
  - no "image of" or "photo of", no keyword stuffing, no claims.
  - Example: "White 180 GSM cotton round-neck T-shirt, front view on white background".
- **File name** (≤ 30 meaningful characters): `<product>-<nn>-<shot>.jpg`, lowercase, e.g. `tee-180gsm-01-front.jpg`.

## Image rights (always check)

| Source | Rule |
| --- | --- |
| The seller's own photos | ✔ The default. |
| Licensed stock / Creative Commons | ✔ Only with a licence that allows commercial use, and the credit recorded in `product_image_sources`. The caption says "Representative image". |
| AI-generated or 3D-rendered | Only labelled "Illustration" or "Rendered image" in the caption. Never as the cover of a real listing; buyers expect the real product. |
| Another seller's or website's photo, catalogue scans, watermarked images, brand photos | ✘ Never, not even "for now". |

## Plan / audit: output

1. **Status table**: each shot → `have` / `missing` / `needs retake` (and why: blurry, cluttered, wrong colour,
   watermark, not square, product too small).
2. **Shot list** for this product, in upload order, with what each must show.
3. **Captions, alt text and file names**: one line per shot.
4. **Brief**: the photography steps above, trimmed to this product (e.g. "shoot the GSM tag close-up").
5. **Upload steps**: Dashboard → Products → edit → Images; at most 10. The first image is the cover; use the
   "Move left" / "Move right" buttons to put the shots in order, then save.

For several products, write `content-drafts/product-images/<YYYY-MM-DD>-<company-or-topic>.md`, plus a `.json` with one
object per product: `{ product, shots: [{ n, shot, status, caption, alt, file_name }] }`. Never overwrite a file: add `-2`, `-3`…

## Demo mode

Demo image plans go with demo products. The product-listing skill makes those; their names end in `(Demo)`.

- **Where.** Write the plans in the batch's own folder: `demo-content/<YYYY-MM-DD>-batch-<NNN>-<topic>/image-plan.json`
  (and `.md`). Never overwrite.
- **Labels.** Every caption starts "Demo image —", and the plan says the images are placeholders.
- **No downloads.** Do not download or link photos from the web for demo products. Leave `images` empty (the site
  shows its own placeholder), or use images the user made or owns.
- **If the user supplies images.** They upload them to BulkSkart storage first (`product-images` bucket). Only those
  URLs (`https://www.bulkskart.com/storage/v1/object/public/...`) go into the demo `data.json` `images` list. The
  helper rejects any other URL.
- **For batches.** Generate the plans from the batch's `data.json`: one plan per product, with shots chosen by
  category from the table above, so 1,000 products get 1,000 consistent plans.

## Before you finish

- [ ] The cover is shot 1, square, on a plain background. At most 10 images.
- [ ] Every alt text is under 125 characters, with no "image of" and no claims. Every caption is 80 characters or fewer.
- [ ] The status table covers every planned shot.
- [ ] The rights check is done. Stock credits go in `product_image_sources`; nothing from other sellers.
- [ ] Demo: captions start "Demo image —"; no web photos; new files only.
