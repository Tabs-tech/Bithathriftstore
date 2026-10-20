# Bitha store

A plain website: no build step. Netlify publishes whatever is in this folder.

## Files you will edit

| File | What it controls |
| --- | --- |
| `products.json` | Every product on the site. Add, edit or mark pieces as sold here. |
| `config.js` | Paystack key, WhatsApp number, Instagram, TikTok, pickup location, hours. |
| `reviews.json` | Customer reviews. Empty means the section stays hidden. |
| `images/` | Your logo and photos. |
| `style.css` | Colours and fonts. The bright red is the `--red` line at the top. |

## Add a product

Open `products.json` and copy one block (from `{` to `}`), paste it after the last one with a comma between, then change the details:

```json
{
  "id": "bitha-004",
  "name": "Black Leather Jacket",
  "price": 35000,
  "category": "Jackets",
  "size": "M",
  "measurements": "Chest 54cm, Length 62cm",
  "condition": "Excellent",
  "image": "images/bitha-004.jpg",
  "sold": false
}
```

- `id` must be unique for every piece.
- Price is a plain number in naira, no commas or symbols.
- A new `category` automatically becomes a filter and a tile.
- When a piece sells, change `"sold": false` to `"sold": true`.

## Photos

- Upload photos to the `images` folder on GitHub, then point `image` in `products.json` at them.
- `images/hero.jpg` is the big photo behind the top headline.
- `images/feature.jpg` is the photo in the "One of one" section.
- To use your logo, save it as `images/logo.png`, then follow the comment in `index.html` near the top.

## Reviews

Only add real reviews from real customers. Format:

```json
[
  { "name": "Customer name", "text": "What they said.", "piece": "Black Leather Jacket" }
]
```

`piece` is optional.

## Going live with payments

1. Create a free account at paystack.com.
2. Copy your **public** key (starts with `pk_`) into `config.js`. Never use the secret key.
3. Test with the `pk_test_` key first, then switch to `pk_live_`.
4. Every paid order is saved in Netlify under **Forms**, then **orders**: name, phone, email, pickup or delivery, address, items, total and Paystack reference.
5. To get an email for each order: in Netlify go to **Site configuration**, then **Notifications**, then **Form submission notifications**, and add your email.

## Two ways to order

- **Pay online:** the order is saved in Netlify under **Forms**, as described above.
- **Order on WhatsApp:** the customer's cart, name, phone and pickup or delivery choice arrive as a ready-written WhatsApp message to your number. These orders are not saved in Netlify, so keep your WhatsApp chats as the record.

## When an order comes in

Each piece is one of one, so after an order from either route:

1. Open `products.json` on GitHub and change `"sold": false` to `"sold": true` for the pieces that were bought. The site updates within a minute.
2. Until you do, another customer could still buy the same piece. Do this quickly.

The site can't mark pieces sold by itself yet. That needs a small database, which we can add later.
