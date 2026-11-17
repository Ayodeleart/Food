/* Shared checkout: the dark cart bar, slide-up cart and edit sheet from the Donuts page.
   Every page loads this file and shares one cart (localStorage), so the cart follows you around the app.

   Checkout.init({ bar: true })          bar:false = no bottom bar (main app opens the sheet from its Cart tab)
   Checkout.add({ key, n, p, img }, qty, fromEl, done, toEl)   add an item (p = price number in naira); fromEl = optional element the dot flies from; toEl = optional element it flies to (default: the checkout bar)
   Checkout.open() / close()   Checkout.count() / total()   Checkout.onChange(fn)
   While the bar is showing, --ckh on <html> holds its height so a page can lift its own bottom controls. */
(function () {
  var KEY = 'burger_cart_v1', ACC = '#ffbd6e', INK = '#17100d';
  var items = {}, subs = [], opts = { bar: true }, root, built = false, editKey = null, barOn = false;   // barOn: this page added something, so its bar shows

  function load() { try { items = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { items = items || {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }
  function money(n) { return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function list() { return Object.keys(items).map(function (k) { var o = items[k]; return { key: k, n: o.n, p: o.p, img: o.img, q: o.q }; }); }
  function count() { return list().reduce(function (a, o) { return a + o.q; }, 0); }
  function total() { return list().reduce(function (a, o) { return a + o.q * o.p; }, 0); }
  function $(id) { return document.getElementById(id); }

  var CSS = [
    '.ck-root{position:fixed;left:0;right:0;top:0;bottom:0;max-width:430px;margin:0 auto;pointer-events:none;z-index:2147483000;font-family:"Outfit","Avenir Next",system-ui,-apple-system,sans-serif;color:#fff;-webkit-user-select:none;user-select:none}',
    '.ck-root *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}',
    '.ck-root button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}',
    '.ck-bar{pointer-events:auto;position:absolute;left:0;right:0;bottom:0;height:calc(88px + env(safe-area-inset-bottom,0px));background:rgba(23,16,13,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border-radius:22px 22px 0 0;display:flex;align-items:center;padding:0 18px env(safe-area-inset-bottom,0px);transform:translateY(105%);transition:transform .6s cubic-bezier(.34,1.3,.64,1);z-index:2;cursor:pointer}',
    '.ck-has .ck-bar{transform:none}',
    '.ck-nobar .ck-bar{display:none}',
    '.ck-ring{position:relative;width:44px;height:44px;border-radius:50%;background:' + ACC + ';display:grid;place-items:center;flex:none}',
    '.ck-ring svg{width:22px;height:22px;stroke:' + INK + ';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.ck-badge{position:absolute;top:-10px;right:-10px;min-width:20px;height:20px;border-radius:50%;background:#fff;color:' + INK + ';font-size:11px;font-weight:700;display:grid;place-items:center}',
    '.ck-tot{margin-left:12px;flex:1}.ck-tot small{display:block;font-size:9px;opacity:.7}.ck-tot b{font-size:18px;font-weight:500}',
    '.ck-chk{font-size:14px;font-weight:500}',
    '.ck-sheet{pointer-events:none;position:absolute;left:0;right:0;bottom:0;height:calc(88px + env(safe-area-inset-bottom,0px));z-index:5;background:rgba(23,16,13,.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:22px 22px 0 0;opacity:0;overflow:hidden;display:flex;flex-direction:column;transition:height .65s cubic-bezier(.34,1.15,.64,1),opacity .15s}',
    '.ck-sheet.open{height:78%;opacity:1;pointer-events:auto}',
    '.ck-sheet .ck-lbl,.ck-sheet .ck-items,.ck-sheet .ck-go{opacity:0;transition:opacity .4s}',
    '.ck-sheet.open .ck-lbl,.ck-sheet.open .ck-items,.ck-sheet.open .ck-go{opacity:1;transition-delay:.2s}',
    '.ck-sh{display:flex;align-items:center;padding:24px 18px 0}',
    '.ck-x{margin-left:auto;font-size:26px;line-height:1}',
    '.ck-lbl{display:flex;justify-content:space-between;font-size:10px;opacity:.7;padding:30px 18px 8px}',
    '.ck-items{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '.ck-item{display:flex;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer}',
    '.ck-th{position:relative;width:34px;height:34px;flex:none}',
    '.ck-th img,.ck-th i{width:100%;height:100%;object-fit:contain;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.12);font-style:normal;font-weight:700;font-size:15px}',
    '.ck-th img{background:none;border-radius:0}',
    '.ck-nm{font-size:11px;font-weight:600;min-width:0}.ck-nm small{display:block;font-weight:400;opacity:.8}',
    '.ck-pr{margin-left:auto;font-size:18px;white-space:nowrap}',
    '.ck-empty{padding:40px 18px;font-size:13px;opacity:.6}',
    '.ck-root .ck-go{margin:12px 18px 22px;height:48px;border-radius:99px;background:' + ACC + ';color:' + INK + '!important;font-weight:600;font-size:15px;flex:none}',
    '.ck-edit{pointer-events:none;position:absolute;left:0;right:0;bottom:0;z-index:6;background:' + ACC + ';color:' + INK + ';border-radius:22px 22px 0 0;height:62%;transform:translateY(105%);transition:transform .55s cubic-bezier(.34,1.2,.64,1);display:flex;flex-direction:column;align-items:center;padding-top:28px}',
    '.ck-edit.open{transform:none;pointer-events:auto}',
    '.ck-edit h2{font-size:32px;font-weight:600}.ck-edit h3{font-size:20px;font-weight:600;margin-top:6px;text-align:center;padding:0 20px}.ck-edit p{font-size:12px}',
    '.ck-es{position:relative;display:flex;align-items:center;justify-content:center;gap:28px;margin-top:18px;width:100%}',
    '.ck-es .ck-th{width:140px;height:140px}.ck-es .ck-th i{font-size:54px;background:rgba(23,16,13,.12)}',
    '.ck-es .ck-badge{background:#fff;top:-6px;right:-6px;min-width:26px;height:26px;font-size:13px}',
    '.ck-root .ck-dk{width:34px;height:34px;border-radius:50%;background:' + INK + ';color:#fff!important;font-size:22px;display:grid;place-items:center}',
    '.ck-ef{display:flex;align-items:center;justify-content:space-between;width:100%;padding:0 22px;margin-top:auto;margin-bottom:28px}',
    '.ck-ef svg{width:22px;height:22px;stroke:' + INK + ';fill:none;stroke-width:1.6}',
    '.ck-root .ck-done{background:' + INK + ';color:#fff!important;height:40px;width:130px;border-radius:99px;font-weight:600}',
    '.ck-dot{position:fixed;z-index:2147483600;width:14px;height:14px;border-radius:50%;background:#fff;pointer-events:none}',
    '.ck-toast{position:absolute;left:50%;bottom:calc(100px + env(safe-area-inset-bottom,0px));transform:translate(-50%,8px);background:rgba(20,20,20,.92);color:#fff;padding:10px 16px;border-radius:99px;font-size:13px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:9;white-space:nowrap}',
    '.ck-toast.show{opacity:1;transform:translate(-50%,0)}'
  ].join('\n');

  var CART_SVG = '<svg viewBox="0 0 24 24"><path d="M3 4h2.2l2.3 11h10.2l1.9-8H6"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="16.5" cy="19.5" r="1.3"/></svg>';

  function build() {
    if (built || !document.body) return; built = true;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.className = 'ck-root' + (opts.bar ? '' : ' ck-nobar');
    root.innerHTML =
      '<div class="ck-bar" id="ck-bar"><div class="ck-ring">' + CART_SVG + '<span class="ck-badge" id="ck-bc"></span></div><div class="ck-tot"><small>Total</small><b id="ck-tt"></b></div><span class="ck-chk">Checkout</span></div>' +
      '<div class="ck-sheet" id="ck-sheet"><div class="ck-sh"><div class="ck-ring">' + CART_SVG + '<span class="ck-badge" id="ck-bc2"></span></div><div class="ck-tot"><small>Total</small><b id="ck-tt2"></b></div><button class="ck-x" id="ck-cx" aria-label="Close">&#215;</button></div>' +
      '<div class="ck-lbl"><span>Your Yummy Cart</span><span>Prices</span></div><div class="ck-items" id="ck-items"></div><button class="ck-go" id="ck-go"></button></div>' +
      '<div class="ck-edit" id="ck-edit"></div><div class="ck-toast" id="ck-toast"></div>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    render();
  }

  function thumb(o) { return '<div class="ck-th">' + (o.img ? '<img src="' + esc(o.img) + '" alt="" draggable="false">' : '<i>' + esc((o.n || '?').charAt(0).toUpperCase()) + '</i>'); }

  function render() {
    if (!built) return;
    var n = count(), t = total(), l = list();
    root.classList.toggle('ck-has', n > 0 && barOn);
    document.documentElement.style.setProperty('--ckh', opts.bar && n > 0 && barOn ? '88px' : '0px');
    $('ck-bc').textContent = $('ck-bc2').textContent = n; $('ck-bc').style.display = n ? 'grid' : 'none';
    $('ck-tt').textContent = $('ck-tt2').textContent = money(t);
    $('ck-go').textContent = money(t) + ' - Proceed to checkout'; $('ck-go').style.display = n ? '' : 'none';
    $('ck-items').innerHTML = n ? l.map(function (o) {
      return '<div class="ck-item" data-ck-edit="' + esc(o.key) + '">' + thumb(o) + '<span class="ck-badge" style="width:16px;min-width:16px;height:16px;font-size:9px;top:-6px;left:-6px;right:auto">' + o.q + '</span></div>' +
        '<div class="ck-nm">' + esc(o.n) + '<small>' + money(o.p) + ' unit price</small></div><div class="ck-pr">' + money(o.q * o.p) + '</div></div>';
    }).join('') : '<div class="ck-empty">Nothing here yet.</div>';
    if (!n) $('ck-sheet').classList.remove('open');
    subs.forEach(function (f) { try { f(n, t, barOn); } catch (e) {} });
  }

  function changed() { save(); render(); }

  function openEdit(key, from) {
    var o = items[key]; if (!o) return; editKey = key;
    var e = $('ck-edit');
    e.innerHTML = '<h2>' + money(o.q * o.p) + '</h2><h3>' + esc(o.n) + '</h3><p>' + money(o.p) + ' unit price</p>' +
      '<div class="ck-es"><button class="ck-dk" data-ck-ei="1">+</button>' + thumb(o) + '<span class="ck-badge">' + o.q + '</span></div><button class="ck-dk" data-ck-ed="1">&#8722;</button></div>' +
      '<div class="ck-ef"><button data-ck-del="1" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button><button class="ck-done" data-ck-done="1">Done</button><span style="width:22px"></span></div>';
    e.classList.add('open');
    var th = e.querySelector('.ck-th');
    if (from && th && th.animate) {
      var r = from.getBoundingClientRect(), d = th.getBoundingClientRect(), dx = r.left + r.width / 2 - d.left - d.width / 2, dy = r.top + r.height / 2 - d.top - d.height / 2;
      th.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (r.width / d.width) + ') rotate(-320deg)', offset: 0, easing: 'ease-out' }, { transform: 'translate(' + dx * .82 + 'px,' + dy * .82 + 'px) scale(' + (r.width / d.width * .8) + ') rotate(-290deg)', offset: .12, easing: 'cubic-bezier(.34,1.56,.64,1)' }, { transform: 'none', offset: 1 }], { duration: 1100 });
    }
  }
  function closeEdit() { $('ck-edit').classList.remove('open'); editKey = null; render(); }

  function toast(msg) { var t = $('ck-toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800); }

  function onClick(e) {
    var t = e.target, el = t.closest ? t.closest('button,.ck-item,.ck-bar') : null; if (!el) return;
    if (el.id === 'ck-bar' || el.classList.contains('ck-bar')) { $('ck-sheet').classList.add('open'); return; }
    if (el.id === 'ck-cx') { $('ck-sheet').classList.remove('open'); return; }
    if (el.dataset.ckEdit) { openEdit(el.dataset.ckEdit, el.querySelector('.ck-th')); return; }
    if (el.dataset.ckEi) { if (items[editKey]) { items[editKey].q++; save(); openEdit(editKey); render(); } return; }
    if (el.dataset.ckEd) { if (items[editKey]) { if (--items[editKey].q <= 0) { delete items[editKey]; $('ck-edit').classList.remove('open'); editKey = null; } else openEdit(editKey); changed(); } return; }
    if (el.dataset.ckDel) { delete items[editKey]; $('ck-edit').classList.remove('open'); editKey = null; changed(); return; }
    if (el.dataset.ckDone) { closeEdit(); return; }
    if (el.id === 'ck-go') { if (typeof API.onCheckout === 'function') API.onCheckout(list(), total()); else toast('Checkout is not connected yet'); return; }
  }

  function fly(from, cb, to) {
    var ring = to || (root && root.querySelector('.ck-ring'));
    if (!from || !ring || !from.getBoundingClientRect || !document.body.animate) { cb(); return; }
    var r = from.getBoundingClientRect(), g = ring.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'ck-dot'; d.style.left = (r.left + r.width / 2 - 7) + 'px'; d.style.top = (r.top + r.height / 2 - 7) + 'px'; document.body.appendChild(d);
    d.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(' + (g.left + g.width / 2 - r.left - r.width / 2) + 'px,' + (g.top + g.height / 2 - r.top - r.height / 2) + 'px) scale(.7)' }], { duration: 650, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).onfinish = function () { d.remove(); cb(); };
  }
  function pop() { var b = $('ck-bc'); if (b && b.animate) b.animate([{ transform: 'scale(.3)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' }); }

  var API = {
    init: function (o) { opts = { bar: !(o && o.bar === false) }; load(); if (document.body) build(); else document.addEventListener('DOMContentLoaded', build); return API; },
    add: function (item, qty, from, done, to) {
      if (!built) build();
      qty = Math.max(1, qty || 1);
      function commit() {
        barOn = true;
        var k = String(item.key), o = items[k];
        if (o) o.q += qty; else items[k] = { n: item.n, p: Number(item.p) || 0, img: item.img || '', q: qty };
        changed(); pop(); if (done) done();
      }
      fly(from, commit, to);
    },
    count: count, total: total, items: list,
    open: function () { if (!built) build(); if (count()) $('ck-sheet').classList.add('open'); else toast('Your cart is empty'); },
    close: function () { if (built) $('ck-sheet').classList.remove('open'); },
    onChange: function (f) { subs.push(f); },
    toast: toast, money: money, onCheckout: null
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); render(); } });
  load();
  window.Checkout = API;
})();
