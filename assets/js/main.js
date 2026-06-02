const SUPABASE_URL = 'https://nsyifjnfyhnkqdibfvzq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zeWlmam5meWhua3FkaWJmdnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDI3NzAsImV4cCI6MjA5NTQxODc3MH0.weIdh_yFdF0LBRee93-yRMrT7-sB8YILRzHumCsKHAw';

window.CFG = { url: SUPABASE_URL, key: SUPABASE_KEY };
window.App = {};

App.keys = {
  cart: 'mk_carrinho',
  customer: 'mk_cliente',
  pedidos: 'mk_pedidos',
  session: 'mk_sessao',
  products: 'mk_produtos',
  promotions: 'mk_promocoes',
  lastPedidoId: 'mk_pedido_ultimo'
};

App.paths = function () {
  const inPages = location.pathname.includes('/pages/');
  const root = inPages ? '../../' : './';
  return { root, inPages, img: root + 'assets/img/', css: root + 'assets/css/', js: root + 'assets/js/' };
};

App.formatBRL = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
App.escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
App.cleanPhone = value => String(value || '').replace(/\D/g, '');
App.icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
App.safeIcons = () => {
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  if (typeof App.initMotion === 'function') App.initMotion(document);
};
App.prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

App.get = (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
App.set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

App.toast = msg => {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(App.toastTimer);
  App.toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
};

App.getSession = () => App.get(App.keys.session, null);
App.setSession = (role, name = 'Equipe') => App.set(App.keys.session, { role, name, at: new Date().toISOString() });
App.clearSession = () => localStorage.removeItem(App.keys.session);
App.hasRole = role => {
  const s = App.getSession();
  if (!s || !s.role) return false;
  return s.role === role || s.role === 'admin';
};

App.renderHeader = (opts = {}) => {
  if (typeof opts === 'boolean') opts = { showCart: opts };
  const showCart = Boolean(opts.showCart);
  const showTrack = Boolean(opts.showTrack);
  const showInternal = Boolean(opts.showInternal);

  const p = App.paths();
  const links = p.inPages
    ? { home: '../../index.html', cliente: '../cliente/index.html', cozinha: '../cozinha/index.html', admin: '../admin/index.html', balcao: '../balcao/index.html', pedido: '../pedido/index.html' }
    : { home: './index.html', cliente: './pages/cliente/index.html', cozinha: './pages/cozinha/index.html', admin: './pages/admin/index.html', balcao: './pages/balcao/index.html', pedido: './pages/pedido/index.html' };

  return `<header class="site-header"><div class="header-inner"><a href="${links.home}" class="brand"><img src="${p.img}logo-petrocerva.jpg" alt="Petrocerva Gastrobar"><div><div class="brand-title">PETROCERVA</div><div class="brand-sub">Gastrobar</div></div></a><nav class="nav"><a class="nav-link" href="${links.cliente}">Cardápio</a>${showTrack ? `<a class="nav-link" href="${links.pedido}">${App.icon('clock-3')} Acompanhar</a>` : ''}${showInternal ? `<a class="nav-link" href="${links.cozinha}">${App.icon('chef-hat')} Cozinha</a><a class="nav-link" href="${links.admin}">Admin</a>` : ''}${showCart ? `<a class="cart-link bg-gold-gradient hover-lift" href="${links.balcao}">${App.icon('shopping-bag')} Carrinho <span class="cart-badge" data-cart-count>${App.count()}</span></a>` : ''}</nav></div></header>`;
};

App.cart = () => App.get(App.keys.cart, []);
App.customer = () => App.get(App.keys.customer, null);
App.saveCart = items => App.set(App.keys.cart, items);
App.count = () => App.cart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
App.total = () => App.cart().reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price_cents || 0), 0);

App.addCart = (item, qty = 1) => {
  const cart = App.cart();
  const found = cart.find(i => i.id === item.id);
  if (found) found.qty += qty;
  else cart.push({ ...item, qty });
  App.saveCart(cart);
  App.refreshCartBadges();
  App.pulseCartBadges();
  App.toast(`${item.name} adicionado`);
};

App.updateQty = (id, qty) => {
  const updated = qty <= 0
    ? App.cart().filter(i => i.id !== id)
    : App.cart().map(i => i.id === id ? { ...i, qty } : i);
  App.saveCart(updated);
  App.refreshCartBadges();
};

App.remove = id => {
  App.saveCart(App.cart().filter(i => i.id !== id));
  App.refreshCartBadges();
};

App.clearCart = () => {
  App.saveCart([]);
  App.refreshCartBadges();
};

App.refreshCartBadges = () => {
  document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = App.count());
  const bar = document.querySelector('[data-bottom-cart]');
  if (bar) {
    bar.classList.toggle('hidden', App.count() === 0);
    const countEl = bar.querySelector('[data-bottom-count]');
    if (countEl) countEl.textContent = App.count();
  }
};

App.pulseCartBadges = () => {
  if (App.prefersReducedMotion()) return;
  document.querySelectorAll('[data-cart-count], [data-bottom-count]').forEach(el => {
    el.classList.remove('is-bumping');
    void el.offsetWidth;
    el.classList.add('is-bumping');
  });
};

App.showSuccessPulse = message => {
  if (App.prefersReducedMotion()) return;
  const current = document.querySelector('.action-success');
  if (current) current.remove();
  const el = document.createElement('div');
  el.className = 'action-success';
  el.innerHTML = `${App.icon('circle-check')}<span>${App.escapeHTML(message)}</span>`;
  document.body.appendChild(el);
  App.safeIcons();
  setTimeout(() => el.remove(), 950);
};

App.animateNumbers = (root = document, opts = {}) => {
  if (App.prefersReducedMotion()) return;
  const duration = Number(opts.duration || 850);
  root.querySelectorAll('[data-count-to]').forEach(el => {
    const target = Number(el.dataset.countTo || 0);
    const type = el.dataset.countType || 'number';
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = type === 'currency' ? App.formatBRL(value) : String(value);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

App.applyMotionDelays = (root = document) => {
  root.querySelectorAll('.motion-stagger, .reveal-stagger, .product-grid, .promo-scroll, .kanban, .admin-kpi-grid').forEach(group => {
    [...group.children].forEach((el, index) => {
      if (!el.style.getPropertyValue('--motion-index')) el.style.setProperty('--motion-index', index);
    });
  });
};

App.bindRipples = (root = document) => {
  root.querySelectorAll('.btn, .add-btn, .chip, .icon-btn').forEach(el => {
    if (el.dataset.rippleBound) return;
    el.dataset.rippleBound = 'true';
    el.classList.add('ripple-host');
    el.addEventListener('click', event => {
      if (App.prefersReducedMotion() || el.disabled) return;
      const rect = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
};

App.initMotion = (root = document) => {
  App.applyMotionDelays(root);
  App.bindRipples(root);

  const revealEls = [...root.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')].filter(el => !el.dataset.revealBound);
  if (!revealEls.length) return;

  if (App.prefersReducedMotion() || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => {
      el.dataset.revealBound = 'true';
      el.classList.add('is-visible');
    });
    return;
  }

  if (!App.revealObserver) {
    App.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        App.revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  }

  revealEls.forEach(el => {
    el.dataset.revealBound = 'true';
    App.revealObserver.observe(el);
  });
};

App.CATEGORIAS_CARDAPIO = [
  'Promo��es',
  'Cervejas',
  'Chopes',
  'Drinks',
  'Guaran�s',
  'N�o alco�licos',
  'Petiscos',
  'Por��es',
  'Prato da casa',
  'Sobremesas'
];

App.FILTROS_CLIENTE = ['Tudo', ...App.CATEGORIAS_CARDAPIO];

App.sampleCategories = App.CATEGORIAS_CARDAPIO.map((name, index) => ({
  id: name,
  name,
  slug: String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, ''),
  sort_order: index + 1
}));

App.defaultProducts = [
  { id: 'std-promo-1', category_id: 'Promo��es', name: 'Combo Chopp + Petisco', description: '1 chopp pilsen 500ml + por��o de batata.', price_cents: 2990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: true },
  { id: 'std-promo-2', category_id: 'Promo��es', name: 'Balde de Cerveja', description: 'Balde com 5 long necks selecionadas.', price_cents: 4990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: true },
  { id: 'std-promo-3', category_id: 'Promo��es', name: 'Dose Dupla de Drink', description: 'Na compra de 1 drink, leve 2 no happy hour.', price_cents: 2790, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: true },
  { id: 'std-promo-4', category_id: 'Promo��es', name: 'Happy Hour Chopp', description: 'Chopp pilsen com pre�o especial at� 20h.', price_cents: 990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: true },
  { id: 'std-promo-5', category_id: 'Promo��es', name: 'Combo da Casa', description: '2 chopes + 1 petisco da casa.', price_cents: 3890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: true },

  { id: 'std-cer-1', category_id: 'Cervejas', name: 'Heineken Long Neck', description: 'Cerveja puro malte 330ml.', price_cents: 1490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-cer-2', category_id: 'Cervejas', name: 'Corona Long Neck', description: 'Cerveja leve e refrescante 330ml.', price_cents: 1590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-cer-3', category_id: 'Cervejas', name: 'Budweiser Long Neck', description: 'American lager 330ml.', price_cents: 1290, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-cer-4', category_id: 'Cervejas', name: 'Stella Artois Long Neck', description: 'Premium lager 330ml.', price_cents: 1490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-cer-5', category_id: 'Cervejas', name: 'Eisenbahn Pilsen', description: 'Pilsen equilibrada e leve.', price_cents: 1390, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-chp-1', category_id: 'Chopes', name: 'Chopp Pilsen 300ml', description: 'Pilsen da casa tirado na hora.', price_cents: 890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-chp-2', category_id: 'Chopes', name: 'Chopp Pilsen 500ml', description: 'Pilsen da casa 500ml.', price_cents: 1290, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-chp-3', category_id: 'Chopes', name: 'Chopp IPA 300ml', description: 'IPA arom�tica e refrescante.', price_cents: 1090, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-chp-4', category_id: 'Chopes', name: 'Chopp IPA 500ml', description: 'IPA da casa 500ml.', price_cents: 1590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-chp-5', category_id: 'Chopes', name: 'Torre de Chopp', description: 'Torre 2L para compartilhar.', price_cents: 4590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-drk-1', category_id: 'Drinks', name: 'Caipirinha', description: 'Lim�o, cacha�a e a��car.', price_cents: 1890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-drk-2', category_id: 'Drinks', name: 'Gin T�nica', description: 'Gin premium com t�nica e especiarias.', price_cents: 2490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-drk-3', category_id: 'Drinks', name: 'Mojito', description: 'Rum, hortel� e lim�o.', price_cents: 2290, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-drk-4', category_id: 'Drinks', name: 'Moscow Mule', description: 'Vodka, gengibre e espuma c�trica.', price_cents: 2390, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-drk-5', category_id: 'Drinks', name: 'Aperol Spritz', description: 'Aperol, espumante e �gua com g�s.', price_cents: 2590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-gua-1', category_id: 'Guaran�s', name: 'Guaran� Antarctica Lata', description: 'Lata 350ml gelada.', price_cents: 690, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-gua-2', category_id: 'Guaran�s', name: 'Guaran� Antarctica 600ml', description: 'Garrafa 600ml.', price_cents: 990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-gua-3', category_id: 'Guaran�s', name: 'Guaran� Antarctica 1L', description: 'Garrafa 1 litro.', price_cents: 1390, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-gua-4', category_id: 'Guaran�s', name: 'Guaran� Zero Lata', description: 'Lata 350ml sem a��car.', price_cents: 690, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-gua-5', category_id: 'Guaran�s', name: 'Guaran� Natural da Casa', description: 'Guaran� artesanal da casa.', price_cents: 1190, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-na-1', category_id: 'N�o alco�licos', name: '�gua Mineral', description: 'Garrafa 500ml sem g�s.', price_cents: 490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-na-2', category_id: 'N�o alco�licos', name: '�gua com G�s', description: 'Garrafa 500ml com g�s.', price_cents: 590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-na-3', category_id: 'N�o alco�licos', name: 'Coca-Cola Lata', description: 'Lata 350ml gelada.', price_cents: 690, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-na-4', category_id: 'N�o alco�licos', name: 'Suco Natural', description: 'Suco natural 400ml.', price_cents: 1090, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-na-5', category_id: 'N�o alco�licos', name: 'Energ�tico', description: 'Lata 250ml.', price_cents: 1590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-pet-1', category_id: 'Petiscos', name: 'Batata Frita', description: 'Por��o crocante com molho da casa.', price_cents: 1890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-pet-2', category_id: 'Petiscos', name: 'Bolinho de Bacalhau', description: 'Unidades sequinhas e saborosas.', price_cents: 2490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-pet-3', category_id: 'Petiscos', name: 'Dadinho de Tapioca', description: 'Servido com geleia de pimenta.', price_cents: 2190, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-pet-4', category_id: 'Petiscos', name: 'Frango a Passarinho', description: 'Frango crocante com alho frito.', price_cents: 2990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-pet-5', category_id: 'Petiscos', name: 'Isca de Peixe', description: 'Iscas empanadas com lim�o.', price_cents: 3290, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-por-1', category_id: 'Por��es', name: 'Por��o de Calabresa', description: 'Calabresa acebolada na chapa.', price_cents: 2590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-por-2', category_id: 'Por��es', name: 'Por��o de Contra-fil�', description: 'Tiras de carne com cebola.', price_cents: 3990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-por-3', category_id: 'Por��es', name: 'Por��o Mista', description: 'Mix da casa para compartilhar.', price_cents: 4490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-por-4', category_id: 'Por��es', name: 'Por��o de Camar�o', description: 'Camar�o empanado com molho.', price_cents: 4990, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-por-5', category_id: 'Por��es', name: 'Por��o de Macaxeira', description: 'Macaxeira frita da casa.', price_cents: 1890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-prt-1', category_id: 'Prato da casa', name: 'Carne de Sol com Macaxeira', description: 'Carne de sol servida com macaxeira.', price_cents: 4590, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-prt-2', category_id: 'Prato da casa', name: 'Fil� Acebolado', description: 'Fil� acebolado com acompanhamento.', price_cents: 4290, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-prt-3', category_id: 'Prato da casa', name: 'Til�pia Grelhada', description: 'Til�pia com legumes salteados.', price_cents: 4390, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-prt-4', category_id: 'Prato da casa', name: 'Escondidinho da Casa', description: 'Escondidinho cremoso especial.', price_cents: 3890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-prt-5', category_id: 'Prato da casa', name: 'Parmegiana da Casa', description: 'Fil� � parmegiana com arroz.', price_cents: 4690, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },

  { id: 'std-sob-1', category_id: 'Sobremesas', name: 'Pudim', description: 'Pudim de leite condensado.', price_cents: 1290, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-sob-2', category_id: 'Sobremesas', name: 'Brownie com Sorvete', description: 'Brownie quente com sorvete.', price_cents: 1690, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-sob-3', category_id: 'Sobremesas', name: 'Petit Gateau', description: 'Bolo quente com recheio cremoso.', price_cents: 1890, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-sob-4', category_id: 'Sobremesas', name: 'Ta�a de Sorvete', description: 'Ta�a com calda e cobertura.', price_cents: 1490, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false },
  { id: 'std-sob-5', category_id: 'Sobremesas', name: 'Mousse de Maracuj�', description: 'Mousse leve e refrescante.', price_cents: 1190, image_url: '../../assets/img/hero-beer.jpg', available: true, is_promo: false }
];

App.legacyProductKeys = ['produtos', 'menuItems', 'cardapio', 'mk_cardapio', 'petrocerva_produtos'];

App.normalizarCategoria = (categoria, nomeProduto = '') => {
  const nome = String(nomeProduto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const cat = String(categoria || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/cafe[\s\-_]*da[\s\-_]*manha/.test(cat)) return 'Prato da casa';
  if (cat.includes('promo') || cat.includes('combo')) return 'Promo��es';
  if (cat.includes('chopp') || cat.includes('chope')) return 'Chopes';
  if (cat.includes('cerveja') || nome.includes('heineken') || nome.includes('corona') || nome.includes('budweiser') || nome.includes('stella') || nome.includes('eisenbahn')) return 'Cervejas';
  if (cat.includes('drink') || nome.includes('caipirinha') || nome.includes('gin') || nome.includes('mojito') || nome.includes('spritz') || nome.includes('moscow')) return 'Drinks';
  if (cat.includes('guaran') || nome.includes('guarana')) return 'Guaran�s';
  if (
    cat.includes('nao alcool') ||
    cat.includes('alco') ||
    cat.includes('bebida') ||
    cat.includes('refriger') ||
    cat.includes('suco') ||
    cat.includes('agua') ||
    nome.includes('agua') ||
    nome.includes('gua') ||
    nome.includes('suco') ||
    nome.includes('coca') ||
    nome.includes('energ') ||
    nome.includes('refrigerante')
  ) return 'N�o alco�licos';
  if (cat.includes('petisco') || cat.includes('lanche') || cat.includes('hamb')) return 'Petiscos';
  if (cat.includes('por')) return 'Por��es';
  if (cat.includes('sobremesa') || nome.includes('pudim') || nome.includes('brownie') || nome.includes('mousse') || nome.includes('petit gateau') || nome.includes('sorvete')) return 'Sobremesas';
  if (cat.includes('almoco') || cat.includes('jantar') || cat.includes('prato')) return 'Prato da casa';

  return 'Prato da casa';
};

App.normalizeProduct = (product, index = 0) => {
  const src = product && typeof product === 'object' ? product : {};
  const name = String(src.name || src.nome || '').trim();
  if (!name) return null;

  const id = String(src.id || `prod-${Date.now()}-${index}`);
  const sourceCategory = src.category_id || src.category || src.categoria || src.tipo;
  const categoryName = App.normalizarCategoria(sourceCategory, name);
  const sourceCategoryNorm = String(sourceCategory || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const parsePriceCents = () => {
    const centsRaw = Number(src.price_cents);
    if (Number.isFinite(centsRaw) && centsRaw >= 0) return Math.round(centsRaw);
    const currencyRaw = Number(src.preco ?? src.price ?? src.valor);
    if (!Number.isFinite(currencyRaw) || currencyRaw < 0) return 0;
    return currencyRaw > 1000 ? Math.round(currencyRaw) : Math.round(currencyRaw * 100);
  };

  const fromLegacyAvailable = src.ativo === undefined ? true : Boolean(src.ativo);
  let available = src.available === undefined ? fromLegacyAvailable : Boolean(src.available);
  if (/cafe[\s\-_]*da[\s\-_]*manha/.test(sourceCategoryNorm)) {
    available = false;
  }

  return {
    id,
    category_id: categoryName,
    name,
    description: String(src.description || src.descricao || '').trim(),
    price_cents: parsePriceCents(),
    image_url: String(src.image_url || src.imagem || src.image || '../../assets/img/hero-beer.jpg'),
    available,
    is_promo: Boolean(src.is_promo)
  };
};

App.normalizeProducts = list => {
  if (!Array.isArray(list)) return [];
  const map = new Map();

  list.forEach((item, index) => {
    const normalized = App.normalizeProduct(item, index);
    if (!normalized) return;
    const key = `${normalized.name.toLowerCase()}::${normalized.category_id}`;
    if (!map.has(key)) {
      map.set(key, normalized);
      return;
    }
    const existing = map.get(key);
    if (!existing.available && normalized.available) map.set(key, normalized);
  });

  return [...map.values()];
};

App.mergeMissingDefaultProducts = products => {
  const current = App.normalizeProducts(products);
  const existingKey = new Set(current.map(p => `${String(p.name).toLowerCase()}::${String(p.category_id)}`));
  const defaults = App.normalizeProducts(App.defaultProducts);

  for (const def of defaults) {
    const key = `${String(def.name).toLowerCase()}::${String(def.category_id)}`;
    if (existingKey.has(key)) continue;
    current.push({ ...def });
    existingKey.add(key);
  }

  return current;
};

App.loadProductsSafe = () => {
  const current = App.get(App.keys.products, null);
  if (Array.isArray(current) && current.length > 0) {
    const normalizedCurrent = App.mergeMissingDefaultProducts(current);
    App.set(App.keys.products, normalizedCurrent);
    return normalizedCurrent;
  }

  const mergedLegacy = [];
  for (const key of App.legacyProductKeys) {
    const data = App.get(key, null);
    if (Array.isArray(data) && data.length > 0) mergedLegacy.push(...data);
  }

  if (mergedLegacy.length > 0) {
    const migrated = App.mergeMissingDefaultProducts(mergedLegacy);
    App.set(App.keys.products, migrated);
    return migrated;
  }

  const seeded = App.mergeMissingDefaultProducts(App.defaultProducts.map(p => ({ ...p })));
  App.set(App.keys.products, seeded);
  return seeded;
};

App.getProductsLocal = () => App.loadProductsSafe();

App.saveProductsLocal = products => {
  if (!Array.isArray(products)) return false;

  const normalized = App.normalizeProducts(products);
  if (normalized.length === 0) {
    console.warn('Bloqueado: tentativa de salvar lista vazia de produtos.');
    return false;
  }

  const safeList = App.mergeMissingDefaultProducts(normalized);
  return App.set(App.keys.products, safeList);
};

App.promoTypes = [
  'percentual',
  'valor',
  'combo',
  'leve_2_pague_1',
  'preco_fixo',
  'promocao_do_dia'
];

App.promoTypeLabel = type => ({
  percentual: 'Desconto (%)',
  valor: 'Desconto (R$)',
  combo: 'Combo',
  leve_2_pague_1: 'Leve 2 pague 1',
  preco_fixo: 'Preço fixo',
  promocao_do_dia: 'Promoção do dia'
}[type] || type);

App.normalizePromocaoStatus = value => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'inativo' || raw === 'inactive' || raw === 'false' ? 'inativo' : 'ativo';
};

App.normalizePromocao = (promo, index = 0) => {
  const src = promo && typeof promo === 'object' ? promo : {};
  const id = String(src.id || `promo-${Date.now()}-${index}`);
  const produtoId = String(src.produtoId || src.productId || src.product_id || '').trim();
  const tipo = App.promoTypes.includes(src.tipo) ? src.tipo : 'preco_fixo';
  const status = App.normalizePromocaoStatus(src.status);

  const valorRaw = Number(src.valorPromocional ?? src.valor_promocional ?? 0);
  const valorPromocional = Number.isFinite(valorRaw) && valorRaw >= 0 ? valorRaw : 0;

  const normalizeDate = value => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  const inicioRaw = src.inicio || src.dataInicio || src.data_inicio || '';
  const fimRaw = src.fim || src.dataFim || src.data_fim || '';
  const inicio = normalizeDate(inicioRaw);
  const fim = normalizeDate(fimRaw);

  return {
    id,
    produtoId,
    nome: String(src.nome || src.nomePromocao || 'Promoção').trim() || 'Promoção',
    tipo,
    valorPromocional,
    inicio,
    fim,
    status
  };
};

App.getPromocoes = () => {
  const list = App.get(App.keys.promotions, []);
  if (!Array.isArray(list)) return [];
  return list.map((p, i) => App.normalizePromocao(p, i));
};

App.savePromocoes = list => {
  const safe = Array.isArray(list) ? list.map((p, i) => App.normalizePromocao(p, i)) : [];
  return App.set(App.keys.promotions, safe);
};

App.promocaoAtiva = (promo, nowDate = new Date()) => {
  if (!promo || App.normalizePromocaoStatus(promo.status) !== 'ativo') return false;
  const now = new Date(nowDate);
  const start = promo.inicio ? new Date(`${promo.inicio}T00:00:00`) : null;
  const end = promo.fim ? new Date(`${promo.fim}T23:59:59`) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

App.calcPromoPriceCents = (basePriceCents, promo) => {
  const base = Math.max(0, Number(basePriceCents || 0));
  const value = Math.max(0, Number(promo?.valorPromocional || 0));
  if (!promo) return base;

  if (promo.tipo === 'percentual') return Math.max(0, Math.round(base * (1 - value / 100)));
  if (promo.tipo === 'valor') return Math.max(0, Math.round(base - (value * 100)));
  if (promo.tipo === 'preco_fixo') return Math.max(0, Math.round(value * 100));
  if (promo.tipo === 'promocao_do_dia') return Math.max(0, Math.round(value * 100));
  if (promo.tipo === 'leve_2_pague_1') return Math.max(0, Math.round(base / 2));
  if (promo.tipo === 'combo') return Math.max(0, Math.round(value * 100));
  return base;
};

App.applyPromocoesToProducts = products => {
  const list = Array.isArray(products) ? products : [];
  const promos = App.getPromocoes();
  const now = new Date();

  return list.map(product => {
    const base = Number(product.price_cents || 0);
    const activePromo = promos.find(p => p.produtoId === String(product.id) && App.promocaoAtiva(p, now));
    if (!activePromo) return { ...product, promo_active: false, promo_price_cents: null, is_promo: Boolean(product.is_promo) };
    const promoPrice = App.calcPromoPriceCents(base, activePromo);
    return {
      ...product,
      promo_active: true,
      promo_price_cents: promoPrice,
      is_promo: true,
      promo: activePromo
    };
  });
};

const PEDIDO_ALLOWED_STATUS = new Set(['recebido', 'preparando', 'pronto', 'entregue']);
const PEDIDO_STATUS_ALIASES = {
  pendente: 'recebido',
  recebido: 'recebido',
  em_preparo: 'preparando',
  empreparo: 'preparando',
  preparando: 'preparando',
  pronto: 'pronto',
  saiu_entrega: 'pronto',
  finalizado: 'entregue',
  concluido: 'entregue',
  entregue: 'entregue'
};

App.normalizePedidoStatus = status => {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const mapped = PEDIDO_STATUS_ALIASES[raw] || raw;
  return PEDIDO_ALLOWED_STATUS.has(mapped) ? mapped : 'recebido';
};

App.normalizePedido = (pedido, index = 0) => {
  const src = pedido && typeof pedido === 'object' ? pedido : {};
  const idSource = src.id ?? `${Date.now()}${index}`;
  const id = Number.isFinite(Number(idSource)) ? Number(idSource) : String(idSource);
  const tipo = src.tipo === 'delivery' || src.type === 'delivery' ? 'delivery' : 'mesa';
  const mesa = tipo === 'mesa' ? String(src.mesa || (src.table_number ? `Mesa ${src.table_number}` : '')).trim() : '';
  const endereco = tipo === 'delivery'
    ? String(src.endereco || `${src.street || ''}, ${src.house_number || ''}`).trim().replace(/^,\s*/, '')
    : '';

  const sourceItens = Array.isArray(src.itens) ? src.itens : (Array.isArray(src.items) ? src.items : []);
  const itens = sourceItens.map(item => ({
    id: item.id ?? item.product_id ?? '',
    nome: String(item.nome ?? item.name ?? 'Item').trim(),
    quantidade: Math.max(1, Number(item.quantidade ?? item.qty ?? 1) || 1),
    preco: Math.max(0, Number(item.preco ?? item.price_cents ?? item.unit_price_cents ?? 0) || 0)
  }));

  const totalFromItems = itens.reduce((sum, i) => sum + (i.preco * i.quantidade), 0);
  const totalRaw = Number(src.total ?? src.total_cents);
  const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : totalFromItems;

  const createdAtRaw = src.criadoEm || src.created_at;
  const createdAt = new Date(createdAtRaw || Date.now());
  const criadoEm = Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString();

  const codeRaw = String(src.codigo || src.code || '').trim();
  const codigo = codeRaw || `PED-${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    codigo,
    cliente: String(src.cliente || src.customer_name || 'Cliente').trim() || 'Cliente',
    mesa,
    tipo,
    endereco,
    itens,
    total,
    status: App.normalizePedidoStatus(src.status),
    criadoEm,
    observacoes: String(src.observacoes || src.notes || '').trim()
  };
};

App.normalizePedidos = pedidos => {
  if (!Array.isArray(pedidos)) return [];
  const map = new Map();

  pedidos.forEach((pedido, index) => {
    const normalized = App.normalizePedido(pedido, index);
    const key = `${String(normalized.id || '')}::${String(normalized.codigo || '')}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, normalized);
      return;
    }
    const currentAt = new Date(current.criadoEm).getTime();
    const nextAt = new Date(normalized.criadoEm).getTime();
    if ((Number.isFinite(nextAt) ? nextAt : 0) >= (Number.isFinite(currentAt) ? currentAt : 0)) {
      map.set(key, normalized);
    }
  });

  return [...map.values()].sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
};

App.getPedidos = () => App.normalizePedidos(App.get(App.keys.pedidos, []));
App.savePedidos = pedidos => App.set(App.keys.pedidos, App.normalizePedidos(pedidos));

App.migrateLegacyPedidos = () => {
  const already = App.getPedidos();
  if (already.length) return;

  const legacy = App.get('petrocerva.orders.v1', []);
  if (!Array.isArray(legacy) || !legacy.length) return;

  let seq = 0;
  const mapped = legacy.map(o => {
    seq += 1;
    return {
      id: Number(String(o.id || '').replace(/\D/g, '')) || Date.now() + seq,
      codigo: o.code || `PED-${String(seq).padStart(3, '0')}`,
      cliente: o.customer_name || 'Cliente',
      mesa: o.type === 'mesa' ? `Mesa ${o.table_number || ''}`.trim() : '',
      tipo: o.type || 'mesa',
      endereco: o.type === 'delivery' ? `${o.street || ''}, ${o.house_number || ''}`.trim().replace(/^,\s*/, '') : '',
      itens: Array.isArray(o.items) ? o.items.map(i => ({ id: i.product_id || i.id, nome: i.name, quantidade: Number(i.qty || 1), preco: Number(i.unit_price_cents || 0) })) : [],
      total: Number(o.total_cents || 0),
      status: ['recebido', 'preparando', 'pronto', 'entregue'].includes(o.status) ? o.status : (o.status === 'pendente' ? 'recebido' : o.status === 'saiu_entrega' ? 'pronto' : 'recebido'),
      criadoEm: o.created_at || new Date().toISOString(),
      observacoes: o.notes || ''
    };
  });

  App.savePedidos(mapped);
};

App.nextPedidoCodigo = () => {
  const pedidos = App.getPedidos();
  const max = pedidos.reduce((m, p) => {
    const n = Number(String(p.codigo || '').replace(/\D/g, ''));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `PED-${String(max + 1).padStart(3, '0')}`;
};

App.createPedidoFromCart = ({ customer, items, notes }) => {
  const id = Date.now();
  const tipo = customer?.type === 'delivery' ? 'delivery' : 'mesa';
  const mesa = tipo === 'mesa' ? `Mesa ${customer?.table_number || ''}`.trim() : '';
  const endereco = tipo === 'delivery' ? `${customer?.street || ''}, ${customer?.house_number || ''}${customer?.reference ? ` (${customer.reference})` : ''}`.trim().replace(/^,\s*/, '') : '';

  const itens = items.map(i => ({
    id: i.id,
    nome: i.name,
    quantidade: Number(i.qty || 1),
    preco: Number(i.price_cents || 0)
  }));

  const total = itens.reduce((sum, i) => sum + i.preco * i.quantidade, 0);

  return {
    id,
    codigo: App.nextPedidoCodigo(),
    cliente: String(customer?.customer_name || 'Cliente').trim(),
    mesa,
    tipo,
    endereco,
    itens,
    total,
    status: 'recebido',
    criadoEm: new Date().toISOString(),
    observacoes: String(notes || '').trim()
  };
};

App.addPedido = pedido => {
  const normalized = App.normalizePedido(pedido);
  const pedidos = App.getPedidos();
  const exists = pedidos.some(p => String(p.id) === String(normalized.id) && String(p.codigo) === String(normalized.codigo));
  if (!exists) pedidos.push(normalized);
  App.savePedidos(pedidos);
  App.set(App.keys.lastPedidoId, normalized.id);
  return normalized;
};

App.getPedidoById = id => App.getPedidos().find(p => String(p.id) === String(id));
App.getLastPedidoId = () => App.get(App.keys.lastPedidoId, null);

App.updatePedidoStatus = (id, status) => {
  const nextStatus = App.normalizePedidoStatus(status);
  if (!PEDIDO_ALLOWED_STATUS.has(nextStatus)) return false;
  let found = false;
  const next = App.getPedidos().map(p => {
    if (String(p.id) !== String(id)) return p;
    found = true;
    return { ...p, status: nextStatus };
  });
  if (!found) return false;
  App.savePedidos(next);
  return true;
};

App.playNewOrderSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 920;
    g.gain.value = 0.001;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    o.start(now);
    o.stop(now + 0.32);
  } catch {
    App.toast('Novo pedido recebido');
  }
};

App.rest = async (path, opt = {}) => {
  const res = await fetch(`${window.CFG.url}/rest/v1/${path}`, {
    ...opt,
    headers: {
      apikey: window.CFG.key,
      Authorization: `Bearer ${window.CFG.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opt.headers || {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

App.migrateLegacyPedidos();

document.addEventListener('DOMContentLoaded', () => {
  App.safeIcons();
  App.refreshCartBadges();
});
