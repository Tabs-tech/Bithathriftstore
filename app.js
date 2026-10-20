(function () {
  "use strict";

  var CURRENCY = window.BITHA_CURRENCY || "NGN";
  var WA = window.BITHA_WHATSAPP || "";
  var KEY = window.BITHA_PAYSTACK_KEY || "";
  var STORE_KEY = "bitha-cart-v1";

  var products = [];
  var cart = []; // array of product ids (each piece is one-of-one, so no quantities)
  var activeFilter = "All";

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return "₦" + Number(n).toLocaleString("en-NG"); };

  function loadCart() {
    try { cart = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { cart = []; }
  }
  function saveCart() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function byId(id) { return products.find(function (p) { return p.id === id; }); }

  // ---------- Shop grid ----------
  function renderFilters() {
    var cats = ["All"].concat(Array.from(new Set(products.map(function (p) { return p.category; }))));
    var box = $("filters");
    box.innerHTML = "";
    cats.forEach(function (c) {
      var b = document.createElement("button");
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
      card.className = "card";
      card.innerHTML =
        '<div class="img"><img loading="lazy" alt=""><span class="badge' + (p.sold ? " sold" : "") + '">' +
        (p.sold ? "Sold" : "Size " + esc(p.size)) + "</span></div>" +
        "<h3></h3>" +
        '<div class="meta"></div>' +
        '<div class="price">' + fmt(p.price) + "</div>" +
        '<button class="add"></button>';
      card.querySelector("img").src = p.image;
      card.querySelector("img").alt = p.name;
      card.querySelector("h3").textContent = p.name;
      card.querySelector(".meta").textContent = p.measurements + " · " + p.condition;
      var btn = card.querySelector(".add");
      btn.textContent = p.sold ? "SOLD" : inCart ? "IN CART" : "ADD TO CART";
      btn.disabled = p.sold || inCart;
      btn.onclick = function () { addToCart(p.id); };
      grid.appendChild(card);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Cart ----------
  function addToCart(id) {
    if (cart.indexOf(id) === -1) cart.push(id);
    saveCart(); renderAll(); openCart();
  }
  function removeFromCart(id) {
    cart = cart.filter(function (x) { return x !== id; });
    saveCart(); renderAll();
  }
  function cartProducts() {
    return cart.map(byId).filter(function (p) { return p && !p.sold; });
  }
  function total() {
    return cartProducts().reduce(function (s, p) { return s + p.price; }, 0);
  }

  function renderCart() {
    var items = cartProducts();
    // drop any ids that no longer exist or are sold
    cart = items.map(function (p) { return p.id; });
    $("cart-count").textContent = items.length;
    $("cart-total").textContent = fmt(total());
    var box = $("cart-items");
    box.innerHTML = "";
    if (!items.length) {
      box.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
      return;
    }
    items.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "line";
      row.innerHTML = '<img alt=""><div class="info"><strong></strong><span class="meta"></span><div class="price"></div><button>Remove</button></div>';
      row.querySelector("img").src = p.image;
      row.querySelector("strong").textContent = p.name;
      row.querySelector(".meta").textContent = "Size " + p.size;
      row.querySelector(".price").textContent = fmt(p.price);
      row.querySelector("button").onclick = function () { removeFromCart(p.id); };
      box.appendChild(row);
    });
  }

  function openCart() {
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("overlay").hidden = false;
  }
  function closeCart() {
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("overlay").hidden = true;
  }

  function renderAll() { renderCart(); renderGrid(); }

  // ---------- Checkout ----------
  function msg(text, isErr) {
    var m = $("form-msg");
    m.textContent = text;
    m.className = "tiny" + (isErr ? " err" : "");
  }

  function orderSummary() {
    return cartProducts().map(function (p) { return p.name + " (size " + p.size + ", " + fmt(p.price) + ")"; }).join("; ");
  }

  function recordOrder(data, reference) {
    var body = new URLSearchParams({
      "form-name": "orders",
      name: data.name, email: data.email, phone: data.phone, address: data.address,
      items: orderSummary(), total: String(total()), reference: reference
    });
    return fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).catch(function () {});
  }

  function formData() {
    var f = $("checkout-form");
    return {
      name: f.name.value.trim(), email: f.email.value.trim(),
      phone: f.phone.value.trim(), address: f.address.value.trim()
    };
  }

  $("checkout-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!cartProducts().length) { msg("Your cart is empty.", true); return; }
    if (!window.PaystackPop) { msg("Payment could not load. Check your connection and try again.", true); return; }
    if (!KEY || KEY.indexOf("REPLACE_ME") !== -1) { msg("Payments are not set up yet (add your Paystack key in config.js).", true); return; }

    var data = formData();
    var amount = total();
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
        { display_name: "Address", variable_name: "address", value: data.address },
        { display_name: "Items", variable_name: "items", value: orderSummary() }
      ]},
      callback: function (res) {
        recordOrder(data, res.reference).then(function () {
          cart = []; saveCart(); renderAll();
          $("checkout-form").reset();
          $("pay-btn").disabled = false;
          msg("Payment received. Thank you! Reference: " + res.reference + ". We will contact you about delivery.");
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
    var f = $("checkout-form");
    if (!f.name.value.trim()) { msg("Add your name first so we know who the order is for.", true); return; }
    var d = formData();
    var text = "Hi Bitha, I'd like to order:\n" +
      cartProducts().map(function (p) { return "- " + p.name + " (size " + p.size + ") " + fmt(p.price); }).join("\n") +
      "\nTotal: " + fmt(total()) +
      "\nName: " + d.name + (d.phone ? "\nPhone: " + d.phone : "") + (d.address ? "\nDelivery: " + d.address : "");
    window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  });

  // ---------- Wire up ----------
  $("open-cart").onclick = openCart;
  $("close-cart").onclick = closeCart;
  $("overlay").onclick = closeCart;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });
  $("year").textContent = new Date().getFullYear();
  $("wa-help").href = "https://wa.me/" + WA;

  loadCart();
  fetch("products.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) { products = data; renderFilters(); renderAll(); })
    .catch(function () {
      $("grid").innerHTML = '<p class="empty">Could not load products. If you opened this file directly, run it through a local server or deploy it.</p>';
    });
})();
