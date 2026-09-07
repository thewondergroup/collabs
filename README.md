# Wonder Collabs

A single-page invitations site for the influencer list, with a request form that writes straight into a Google Sheet.

## Files

- `index.html` — the page (fonts from Google Fonts, no build step)
- `mark.png` — transparent W mark
- `apps-script.gs` — the Google Sheets backend (form handler + emails)

## Set up (about 15 minutes)

1. **Sheet.** Create a Google Sheet called *Wonder Collabs*. Extensions → Apps Script. Paste `apps-script.gs`, save, run `setup()` once and authorise it.
2. **Deploy.** Deploy → New deployment → Web app → Execute as *Me*, access *Anyone* → Deploy. Copy the URL.
3. **Trigger.** In Apps Script, Triggers → Add trigger → function `onEditStatus`, event source *From spreadsheet*, type *On edit*.
4. **Page.** In `index.html`, paste the URL into `const ENDPOINT = ""` near the bottom. Check the emails in `apps-script.gs` (`REPLY_TO`, `NOTIFY`) and the handle in the "How it works" section.
5. **Publish.** Push the folder to a GitHub repo (or a `collabs/` folder in an existing Pages repo). It works at any path.

## Linking from the email

Each button in the email deep-links to the page with the form already open and that invitation ticked (they can tick more):

- `…/collabs/?op=tantrums`
- `…/collabs/?op=temper`
- `…/collabs/?op=paradiso`
- `…/collabs/?op=brix`
- `…/collabs/?op=notto`

## Running it from the sheet

Every invitation a creator ticks lands as its own row with **Status = Requested** and the creator gets an automatic "we've got it" email; you get a ping at `NOTIFY`.

- If they gave dates, check them with the venue. If they didn't (or theirs don't work), type the options into **Dates offered** and set **Status → Dates sent** — they get an email asking them to pick one.
- Fill **Confirmed date/time** (and anything in **Details for guest**), then set **Status → Confirmed**. They get the confirmation email with what's agreed. The **Confirmation sent** column stamps itself so it can't double-send.
- **Status → Declined** sends a polite no.
- **Attended / Content received / No show** are for your own tracking — nothing is emailed.

## Adding or removing invitations

Three places, all in `index.html`: the `<article class="op">` block, the `OPS` object in the script, and the `<select id="op">` options. Add the same key to `OPS` in `apps-script.gs` so the sheet gets a clean title. Change the count in `<div class="count">` and the season in the header.

## Things to check before sending

- The "Includes" and "In return" lines on each invitation are placeholders based on the email copy — confirm them with each venue.
- The hero and the Temper invitation currently use the same surf-and-turf photo (different crops). Swap `img/hero.jpg` for a wider shot when you have one.
- The launch-party dates are "to be confirmed" on the page; the confirmation email carries the actual date.
- `hello@thewonder.group` is used throughout — swap if a different inbox should handle this.
