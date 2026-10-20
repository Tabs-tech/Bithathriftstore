(function () {
  "use strict";

  var CURRENCY = window.BITHA_CURRENCY || "NGN";
  var WA = window.BITHA_WHATSAPP || "";
  var KEY = window.BITHA_PAYSTACK_KEY || "";
  var CART_KEY = "bitha-cart-v1";
  var FUL_KEY = "bitha-fulfilment-v1";

  var products = [];
  var cart = [];            // product ids (each piece is one-of-one, so no quantities)
  var activeFilter = "All";
  var fulfilment = "Pickup"; // "Pickup" or "Delivery"
  var drawerOpen = false;

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return "₦" + Number(n).toLocaleString("en-NG"); };

  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function recall(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function byId(id) { return products.find(function (p) { return p.id === id; }); }
  function waLink(text) { return "https://wa.me/" + WA + (text ? "?text=" + encodeURIComponent(text) : ""); }

  // ---------- Pickup / delivery ----------
  function fulNote(v) {
    return v === "Delivery"
      ? "We deliver to your address and message you to confirm the details."
      : "Pick up your order. We message you where and when.";
  }

  function setFulfilment(v) {
    fulfilment = v === "Delivery" ? "Delivery" : "Pickup";
    store(FUL_KEY, fulfilment);
    document.querySelectorAll("[data-seg] button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-val") === fulfilment));
    });
    $("order-note").textContent = fulNote(fulfilment);
    $("drawer-note").textContent = fulNote(fulfilment);
    var a = $("checkout-form").elements["address"];
    a.placeholder = fulfilment === "Delivery" ? "Delivery address" : "Notes for pickup (optional)";
    a.required = fulfilment === "Delivery";
  }

  // ---------- Hero featured piece ----------
  function renderFeatured() {
    var p = products.filter(function (x) { return !x.sold; })[0];
    var box = $("feat");
    if (!p) { box.hidden = true; return; }
    box.hidden = false;
    $("feat-name").textContent = p.name;
    $("feat-meta").textContent = "Size " + p.size + ", " + fmt(p.price);
    var inCart = cart.indexOf(p.id) !== -1;
    var b = $("feat-add");
    b.textContent = inCart ? "In cart" : "Add to cart";
    b.disabled = inCart;
    b.onclick = function () { addToCart(p.id); };
  }

  // ---------- Category tiles ----------
  function renderTiles() {
    var box = $("tiles");
    box.innerHTML = "";
    var cats = [];
    products.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    $("tiles-section").hidden = cats.length < 2;
    cats.forEach(function (c) {
      var items = products.filter(function (p) { return p.category === c; });
      var avail = items.filter(function (p) { return !p.sold; });
      var lead = avail[0] || items[0];
      var t = document.createElement("button");
      t.type = "button";
      t.className = "tile";
      t.innerHTML = '<img alt="" loading="lazy"><span class="tile-shade"></span>' +
        '<span class="tile-text"><span class="tile-name"></span><span class="tile-count"></span></span>';
      t.querySelector("img").src = lead.image;
      t.querySelector(".tile-name").textContent = c;
      t.querySelector(".tile-count").textContent = avail.length + (avail.length === 1 ? " piece available" : " pieces available");
      t.onclick = function () {
        activeFilter = c;
        renderFilters();
        renderGrid();
        $("shop").scrollIntoView({ behavior: "smooth" });
      };
      box.appendChild(t);
    });
  }

  // ---------- Shop rail ----------
  function renderFilters() {
    var cats = ["All"].concat(Array.from(new Set(products.map(function (p) { return p.category; }))));
    var box = $("filters");
    box.innerHTML = "";
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      if (c === activeFilter) b.className = "on";
      b.onclick = function () { activeFilter = c; renderFilters(); renderGrid(); };
      box.appendChild(b);
    });
  }

  function renderGrid() {
    var grid = $("grid");
    grid.innerHTML = "";
    var list = products.filter(function (p) { return activeFilter === "All" || p.category === activeFilter; });
    $("empty").hidden = list.length > 0;
    list.forEach(function (p) {
      var inCart = cart.indexOf(p.id) !== -1;
      var card = document.createElement("article");
      card.className = "card" + (p.sold ? " sold" : "");
      card.innerHTML =
        '<div class="card-img"><img loading="lazy" alt=""><span class="chip' + (p.sold ? " sold" : "") + '"></span></div>' +
        '<div class="card-body">' +
        '<div class="card-row"><h3 class="card-name"></h3><span class="price"></span></div>' +
        '<p class="meta meta-size"></p>' +
        '<p class="meta meta-fit"></p>' +
        '<button type="button" class="add"></button>' +
        "</div>";
      card.querySelector("img").src = p.image;
      card.querySelector("img").alt = p.name;
      card.querySelector(".chip").textContent = p.sold ? "Sold" : "Size " + p.size;
      card.querySelector("h3").textContent = p.name;
      card.querySelector(".price").textContent = fmt(p.price);
      card.querySelector(".meta-size").textContent = p.condition + " condition";
      card.querySelector(".meta-fit").textContent = p.measurements;
      var btn = card.querySelector(".add");
      btn.textContent = p.sold ? "Sold" : inCart ? "In cart" : "Add to cart";
      btn.disabled = p.sold || inCart;
      btn.onclick = function () { addToCart(p.id); };
      grid.appendChild(card);
    });
  }

  // ---------- Cart ----------
  function addToCart(id) {
    if (cart.indexOf(id) === -1) cart.push(id);
    store(CART_KEY, JSON.stringify(cart));
    renderAll();
    openCart();
  }
  function removeFromCart(id) {
    cart = cart.filter(function (x) { return x !== id; });
    store(CART_KEY, JSON.stringify(cart));
    renderAll();
  }
  function cartProducts() {
    return cart.map(byId).filter(function (p) { return p && !p.sold; });
  }
  function total() {
    return cartProducts().reduce(function (s, p) { return s + p.price; }, 0);
  }

  function renderCart() {
    var items = cartProducts();
    cart = items.map(function (p) { return p.id; }); // drop ids that vanished or sold
    $("cart-count").textContent = items.length;
    $("cart-total").textContent = fmt(total());
    $("pill-count").textContent = items.length;
    $("pill-total").textContent = fmt(total());
    $("cart-pill").hidden = items.length === 0 || drawerOpen;
    var box = $("cart-items");
    box.innerHTML = "";
    if (!items.length) {
      box.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
      return;
    }
    items.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "line";
      row.innerHTML = '<img alt=""><div class="info"><strong></strong><span class="meta"></span><div class="price"></div><button type="button">Remove</button></div>';
      row.querySelector("img").src = p.image;
      row.querySelector("strong").textContent = p.name;
      row.querySelector(".meta").textContent = "Size " + p.size;
      row.querySelector(".price").textContent = fmt(p.price);
      row.querySelector("button").onclick = function () { removeFromCart(p.id); };
      box.appendChild(row);
    });
  }

  function openCart() {
    drawerOpen = true;
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("overlay").hidden = false;
    $("cart-pill").hidden = true;
  }
  function closeCart() {
    drawerOpen = false;
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("overlay").hidden = true;
    renderCart();
  }

  function renderAll() { renderCart(); renderGrid(); renderFeatured(); }

  // ---------- Checkout ----------
  function msg(text, isErr, isOk) {
    var m = $("form-msg");
    m.textContent = text;
    m.className = "tiny" + (isErr ? " err" : "") + (isOk ? " ok" : "");
  }

  function orderSummary() {
    return cartProducts().map(function (p) { return p.name + " (size " + p.size + ", " + fmt(p.price) + ")"; }).join("; ");
  }

  function formData() {
    var f = $("checkout-form").elements;
    return {
      name: f["name"].value.trim(), email: f["email"].value.trim(),
      phone: f["phone"].value.trim(), address: f["address"].value.trim()
    };
  }

  function recordOrder(data, reference) {
    var body = new URLSearchParams({
      "form-name": "orders",
      name: data.name, email: data.email, phone: data.phone,
      fulfilment: fulfilment, address: data.address,
      items: orderSummary(), total: String(total()), reference: reference
    });
    return fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).catch(function () {});
  }

  $("checkout-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!cartProducts().length) { msg("Your cart is empty.", true); return; }
    if (!window.PaystackPop) { msg("Payment could not load. Check your connection and try again.", true); return; }
    if (!KEY || KEY.indexOf("REPLACE_ME") !== -1) { msg("Online payment is not open yet. You can order on WhatsApp instead.", true); return; }

    var data = formData();
    var amount = total();
    var summary = orderSummary();
    $("pay-btn").disabled = true;
    msg("");

    var handler = window.PaystackPop.setup({
      key: KEY,
      email: data.email,
      amount: amount * 100, // Paystack wants kobo
      currency: CURRENCY,
      ref: "BITHA-" + Date.now(),
      metadata: { custom_fields: [
        { display_name: "Name", variable_name: "name", value: data.name },
        { display_name: "Phone", variable_name: "phone", value: data.phone },
        { display_name: "Pickup or delivery", variable_name: "fulfilment", value: fulfilment },
        { display_name: "Address or notes", variable_name: "address", value: data.address },
        { display_name: "Items", variable_name: "items", value: summary }
      ]},
      callback: function (res) {
        recordOrder(data, res.reference).then(function () {
          cart = []; store(CART_KEY, "[]"); renderAll();
          $("checkout-form").reset();
          setFulfilment(fulfilment);
          $("pay-btn").disabled = false;
          msg("Order placed. Thank you! Your reference is " + res.reference + ". We will message you about your " + fulfilment.toLowerCase() + ".", false, true);
        });
      },
      onClose: function () {
        $("pay-btn").disabled = false;
        msg("Payment window closed. Your cart is still saved.");
      }
    });
    handler.openIframe();
  });

  $("wa-order").addEventListener("click", function () {
    if (!cartProducts().length) { msg("Your cart is empty.", true); return; }
    var d = formData();
    if (!d.name) { msg("Add your name first so we know who the order is for.", true); return; }
    if (fulfilment === "Delivery" && !d.address) { msg("Add your delivery address first.", true); return; }
    var text = "Hi Bitha, I'd like to order:\n" +
      cartProducts().map(function (p) { return "- " + p.name + " (size " + p.size + ") " + fmt(p.price); }).join("\n") +
      "\nTotal: " + fmt(total()) +
      "\n" + fulfilment +
      "\nName: " + d.name + (d.phone ? "\nPhone: " + d.phone : "") +
      (d.address ? "\n" + (fulfilment === "Delivery" ? "Address: " : "Notes: ") + d.address : "");
    window.open(waLink(text), "_blank", "noopener");
  });

  // ---------- Reviews (only shown when reviews.json has entries) ----------
  function loadReviews() {
    fetch("reviews.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) return;
        var box = $("reviews-list");
        list.forEach(function (r) {
          if (!r || !r.text) return;
          var q = document.createElement("blockquote");
          q.className = "review";
          q.innerHTML = "<p></p><footer></footer>";
          q.querySelector("p").textContent = r.text;
          q.querySelector("footer").textContent = (r.name || "Customer") + (r.piece ? ", bought " + r.piece : "");
          box.appendChild(q);
        });
        $("reviews").hidden = !box.children.length;
      })
      .catch(function () {});
  }

  // ---------- Contact ----------
  function cleanHandle(h) { return String(h).replace(/^@/, "").trim(); }
  function renderContact() {
    var list = $("contact-list");
    function row(label, value, href) {
      var r = document.createElement("div");
      r.className = "crow";
      var l = document.createElement("span");
      l.className = "clabel";
      l.textContent = label;
      var v;
      if (href) {
        v = document.createElement("a");
        v.href = href; v.target = "_blank"; v.rel = "noopener";
      } else {
        v = document.createElement("span");
      }
      v.textContent = value;
      r.appendChild(l); r.appendChild(v);
      list.appendChild(r);
    }
    row("WhatsApp", "Message us", waLink(""));
    if (window.BITHA_INSTAGRAM) row("Instagram", "@" + cleanHandle(window.BITHA_INSTAGRAM), "https://instagram.com/" + cleanHandle(window.BITHA_INSTAGRAM));
    if (window.BITHA_TIKTOK) row("TikTok", "@" + cleanHandle(window.BITHA_TIKTOK), "https://www.tiktok.com/@" + cleanHandle(window.BITHA_TIKTOK));
    if (window.BITHA_LOCATION) row("Pickup", window.BITHA_LOCATION);
    if (window.BITHA_HOURS) row("Hours", window.BITHA_HOURS);
  }

  // ---------- Wire up ----------
  $("open-cart").onclick = openCart;
  $("close-cart").onclick = closeCart;
  $("overlay").onclick = closeCart;
  $("cart-pill").onclick = openCart;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });

  document.querySelectorAll("[data-seg] button").forEach(function (b) {
    b.onclick = function () { setFulfilment(b.getAttribute("data-val")); };
  });

  var menuBtn = $("menu-btn"), nav = $("site-nav");
  menuBtn.onclick = function () {
    var open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Close" : "Menu";
  };
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.textContent = "Menu";
    }
  });

  $("prev").onclick = function () { $("grid").scrollBy({ left: -$("grid").clientWidth * 0.8, behavior: "smooth" }); };
  $("next").onclick = function () { $("grid").scrollBy({ left: $("grid").clientWidth * 0.8, behavior: "smooth" }); };
  $("see-all").onclick = function () {
    var all = $("grid").classList.toggle("all");
    this.textContent = all ? "Show fewer" : "See all";
    $("prev").hidden = all;
    $("next").hidden = all;
  };

  $("year").textContent = new Date().getFullYear();
  $("status-text").textContent = window.BITHA_STATUS || "New pieces drop weekly";
  $("wa-book").href = waLink("Hi Bitha, I'd like to book a fitting or pickup slot.");
  renderContact();

  try { cart = JSON.parse(recall(CART_KEY) || "[]"); } catch (e) { cart = []; }
  setFulfilment(recall(FUL_KEY) === "Delivery" ? "Delivery" : "Pickup");

  fetch("products.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      products = data;
      renderTiles();
      renderFilters();
      renderAll();
      loadReviews();
    })
    .catch(function () {
      $("grid").innerHTML = '<p class="empty">Could not load products. If you opened this file directly, run it through a local server or deploy it.</p>';
    });
})();
