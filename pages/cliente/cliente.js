document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  if (header) header.innerHTML = App.renderHeader({ showCart: true, showTrack: true, showInternal: false });

  const qs = new URLSearchParams(location.search);
  let tipo = qs.get('tipo');
  const customer = App.customer();

  if (!tipo && customer) {
    renderMenu();
    return;
  }

  if (tipo !== 'delivery') tipo = 'mesa';
  renderForm(tipo);
  App.safeIcons();
  App.initMotion();
});

function renderForm(tipo) {
  const isMesa = tipo === 'mesa';
  document.getElementById('app').innerHTML = `<section class="container page-pad motion-slide-up" style="max-width:42rem"><div class="pill">${isMesa ? App.icon('qr-code') + ' Pedido na mesa' : App.icon('bike') + ' Pedido delivery'}</div><h1 class="font-display text-4xl mt-4">${isMesa ? 'Bem-vindo à mesa' : 'Seu delivery, sua vibe'}</h1><p class="muted mt-2">Preencha rapidinho para enviarmos seu pedido para a cozinha.</p><form id="customer-form" class="form-card card-surface mt-8 space-y motion-scale-in"><label class="field"><span class="label">Seu nome</span><input class="input" name="customer_name" placeholder="Ex.: João Silva" required minlength="2"><span class="err" data-err="customer_name"></span></label><label class="field"><span class="label">WhatsApp</span><input class="input" name="whatsapp" placeholder="(11) 99999-9999" required minlength="10"><span class="err" data-err="whatsapp"></span></label>${isMesa ? `<div class="grid-2"><label class="field"><span class="label">Quantas pessoas?</span><input class="input" name="party_size" type="number" min="1" max="30" value="1" required><span class="err" data-err="party_size"></span></label><label class="field"><span class="label">Número da mesa</span><input class="input" name="table_number" placeholder="Ex.: 12" required><span class="err" data-err="table_number"></span></label></div>` : `<label class="field"><span class="label">Rua</span><input class="input" name="street" placeholder="Ex.: Rua das Flores" required></label><div class="grid-2"><label class="field"><span class="label">Número</span><input class="input" name="house_number" placeholder="123" required></label><label class="field"><span class="label">Referência</span><input class="input" name="reference" placeholder="Próx. à praça"></label></div>`}<button class="btn btn-gold hover-lift w-full" type="submit">Continuar para o cardápio ${App.icon('arrow-right')}</button></form></section>`;

  document.getElementById('customer-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const c = Object.fromEntries(fd.entries());

    c.type = tipo;
    c.customer_name = String(c.customer_name || '').trim();
    c.whatsapp = String(c.whatsapp || '').trim();

    if (c.customer_name.length < 2) return App.toast('Informe seu nome');
    const digits = App.cleanPhone(c.whatsapp);
    if (digits.length < 10 || digits.length > 13) return App.toast('WhatsApp inválido');

    if (isMesa) {
      c.table_number = String(c.table_number || '').trim();
      c.party_size = Math.min(30, Math.max(1, Number(c.party_size || 1)));
      if (!c.table_number) return App.toast('Número da mesa obrigatório');
    } else {
      c.street = String(c.street || '').trim();
      c.house_number = String(c.house_number || '').trim();
      c.reference = String(c.reference || '').trim();
      if (!c.street || !c.house_number) return App.toast('Informe o endereço completo');
    }

    App.set(App.keys.customer, c);
    App.toast('Tudo certo! Bora montar o pedido?');
    renderMenu();
  });

  App.safeIcons();
}

async function loadMenu() {
  const localProducts = App.applyPromocoesToProducts(App.getProductsLocal()).filter(p => p.available !== false);
  const localCategories = buildCategories(localProducts);

  if (localProducts.length) {
    return { categories: localCategories, products: localProducts };
  }

  try {
    const [categories, products] = await Promise.all([
      App.rest('categories?select=*&order=sort_order.asc'),
      App.rest('products?select=*&available=eq.true&order=sort_order.asc')
    ]);
    const normalizedProducts = App.applyPromocoesToProducts(products).filter(p => p.available !== false);
    return { categories: buildCategories(normalizedProducts, categories), products: normalizedProducts };
  } catch {
    return { categories: localCategories, products: localProducts };
  }
}

function buildCategories(products, base = App.sampleCategories) {
  const map = new Map();

  (Array.isArray(base) ? base : []).forEach((c, idx) => {
    const id = String(c.id || '').trim();
    if (!id) return;
    map.set(id, { id, name: c.name || id, sort_order: Number(c.sort_order || idx + 1) });
  });

  products.forEach((p, idx) => {
    const id = String(p.category_id || '').trim();
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: id.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()),
        sort_order: 1000 + idx
      });
    }
  });

  return [...map.values()].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

async function renderMenu() {
  const customer = App.customer();
  if (!customer) return renderForm('mesa');

  const latestId = App.getLastPedidoId();
  const trackHref = latestId ? `../pedido/index.html?id=${encodeURIComponent(latestId)}` : '../pedido/index.html';

  document.getElementById('app').innerHTML = `<section class="container page-pad"><div class="top-row motion-slide-up"><div><h1 class="font-display text-4xl">Cardápio</h1><p class="text-sm muted">Olá, <span class="price">${App.escapeHTML(customer.customer_name)}</span> — ${customer.type === 'mesa' ? `Mesa ${App.escapeHTML(customer.table_number || '')}` : 'Delivery'}</p></div><div class="flex items-center gap-2"><a href="${trackHref}" class="btn btn-outline">Acompanhar pedido</a><div class="search-wrap"><i data-lucide="search" class="icon"></i><input id="search" class="input search-input" placeholder="Buscar no cardápio..."></div></div></div><div id="promos"></div><div class="mt-8 chips motion-slide-up" id="chips"></div><div class="product-grid" id="products"><div class="card-surface rounded-2xl p-6 muted">Carregando cardápio...</div></div></section><a data-bottom-cart href="../balcao/index.html" class="bottom-cart bg-gold-gradient hover-lift ${App.count() ? '' : 'hidden'}"><span>Ver carrinho (<span data-bottom-count>${App.count()}</span>)</span><span>Finalizar -></span></a>`;

  const data = await loadMenu();
  let active = 'all';
  let search = '';

  const imageFor = src => {
    if (typeof src !== 'string') return '../../assets/img/hero-beer.jpg';
    if (/^https?:\/\//i.test(src) || src.startsWith('../../') || src.startsWith('./') || src.startsWith('/')) return src;
    return '../../assets/img/hero-beer.jpg';
  };

  const getPriceCents = product => {
    if (product && product.promo_active && Number.isFinite(Number(product.promo_price_cents))) return Number(product.promo_price_cents);
    return Number(product?.price_cents || 0);
  };

  const aplicarAnimacaoCards = selector => {
    if (App.prefersReducedMotion()) return;
    document.querySelectorAll(selector).forEach((card, index) => {
      card.classList.remove('animate-in');
      card.style.animationDelay = `${Math.min(index * 45, 320)}ms`;
      requestAnimationFrame(() => {
        card.classList.add('animate-in');
        setTimeout(() => {
          card.classList.remove('animate-in');
          card.style.animationDelay = '';
        }, 620 + Math.min(index * 45, 320));
      });
    });
  };

  const draw = () => {
    const filtered = data.products.filter(p => (active === 'all' || p.category_id === active) && (!search || String(p.name || '').toLowerCase().includes(search.toLowerCase())));
    const productsEl = document.getElementById('products');

    document.getElementById('chips').innerHTML = `<button class="chip ${active === 'all' ? 'active' : ''}" data-cat="all">Tudo</button>` + data.categories.map(c => `<button class="chip ${active === c.id ? 'active' : ''}" data-cat="${App.escapeHTML(c.id)}">${App.escapeHTML(c.name)}</button>`).join('');

    document.querySelectorAll('[data-cat]').forEach(btn => btn.onclick = () => {
      const productsEl = document.getElementById('products');
      const change = () => {
        active = btn.dataset.cat;
        draw();
      };
      if (productsEl && !App.prefersReducedMotion()) {
        productsEl.classList.add('is-transitioning');
        setTimeout(change, 120);
        return;
      }
      change();
    });

    productsEl.innerHTML = filtered.length
      ? filtered.map(p => {
        const price = getPriceCents(p);
        const priceHtml = p.promo_active
          ? `<div><div class="muted text-xs"><s>${App.formatBRL(p.price_cents)}</s></div><span class="price">${App.formatBRL(price)}</span></div>`
          : `<span class="price">${App.formatBRL(price)}</span>`;
        return `<article class="product-card card-surface hover-lift"><img src="${imageFor(p.image_url)}" alt="${App.escapeHTML(p.name)}" loading="lazy"><div class="product-info"><div><h3 class="font-display">${App.escapeHTML(p.name)}</h3>${p.description ? `<p class="line-clamp text-xs muted">${App.escapeHTML(p.description)}</p>` : ''}</div><div class="flex items-center justify-between mt-2">${priceHtml}<button class="add-btn" data-add="${App.escapeHTML(p.id)}">${App.icon('plus')} Adicionar</button></div></div></article>`;
      }).join('')
      : `<div class="text-center muted" style="grid-column:1/-1;padding:4rem 0">Nada encontrado.</div>`;
    productsEl.classList.remove('is-transitioning');
    aplicarAnimacaoCards('#products .product-card');

    document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => {
      const p = data.products.find(item => item.id === btn.dataset.add);
      if (!p) return;
      btn.classList.add('is-bumping');
      setTimeout(() => btn.classList.remove('is-bumping'), 420);
      App.addCart({ id: p.id, name: p.name, price_cents: getPriceCents(p), image_url: p.image_url });
    });

    App.safeIcons();
  };

  const promos = data.products.filter(p => p.is_promo).slice(0, 6);
  if (promos.length) {
    document.getElementById('promos').innerHTML = `<div class="mt-8 motion-slide-up"><div class="mb-3 flex items-center gap-2"><i data-lucide="flame" style="color:var(--ember)"></i><h2 class="font-display text-lg uppercase tracking">Promoções do dia</h2></div><div class="promo-scroll">${promos.map(p => `<button class="promo-card card-surface hover-lift relative" data-promo="${App.escapeHTML(p.id)}"><img src="${imageFor(p.image_url)}" alt="${App.escapeHTML(p.name)}"><span class="promo-badge">Promo</span><div class="p-3"><div class="font-display">${App.escapeHTML(p.name)}</div><div class="price mt-1">${App.formatBRL(getPriceCents(p))}</div></div></button>`).join('')}</div></div>`;
    aplicarAnimacaoCards('.promo-card');
  }

  document.querySelectorAll('[data-promo]').forEach(btn => btn.onclick = () => {
    const p = promos.find(item => item.id === btn.dataset.promo);
    if (!p) return;
    btn.classList.add('is-bumping');
    setTimeout(() => btn.classList.remove('is-bumping'), 420);
    App.addCart({ id: p.id, name: p.name, price_cents: getPriceCents(p), image_url: p.image_url });
  });

  document.getElementById('search').oninput = e => {
    search = e.target.value;
    draw();
  };

  draw();
  App.safeIcons();
  App.initMotion();
}
