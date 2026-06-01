const BALCAO_PASS = 'balcao123';
let panelTimer = null;
let isFinalizing = false;

function ensureBalcaoAccess() {
  if (App.hasRole('balcao')) return true;
  const code = window.prompt('Acesso restrito ao balcão. Informe o código de acesso:');
  if (code === BALCAO_PASS) {
    App.setSession('balcao');
    return true;
  }
  App.toast('Acesso negado');
  location.href = '../../index.html';
  return false;
}

function canOpenCheckoutWithoutAuth() {
  return Boolean(App.customer()) || App.cart().length > 0;
}

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  if (header) header.innerHTML = App.renderHeader({ showCart: true, showInternal: true });

  const mode = new URLSearchParams(location.search).get('modo');
  if (mode === 'painel') {
    if (!ensureBalcaoAccess()) return;
    renderCounterPanel();
    panelTimer = setInterval(renderCounterPanel, 2000);
  } else {
    if (!canOpenCheckoutWithoutAuth() && !App.hasRole('balcao')) {
      if (!ensureBalcaoAccess()) return;
    }
    renderCheckout();
  }

  App.safeIcons();
});

function renderCheckout() {
  const customer = App.customer();
  document.getElementById('app').innerHTML = `<section class="container page-pad" style="max-width:48rem"><h1 class="font-display text-4xl">Seu pedido</h1>${customer ? `<p class="text-sm muted mt-1">${customer.type === 'mesa' ? `Mesa ${App.escapeHTML(customer.table_number || '')} • ${Number(customer.party_size || 1)} pessoa(s)` : `Delivery • ${App.escapeHTML(customer.street || '')}, ${App.escapeHTML(customer.house_number || '')}`}</p>` : ''}<div class="card-surface rounded-2xl p-6 mt-6" id="checkout-box"></div><p class="text-xs muted mt-4">Precisa operar no balcão? Abra <a href="?modo=painel" style="color:var(--gold)">modo painel</a>.</p></section>`;
  drawBox();
}

function drawBox() {
  const box = document.getElementById('checkout-box');
  const items = App.cart();

  if (!items.length) {
    box.innerHTML = `<div class="py-10 text-center"><p class="muted">Seu carrinho está vazio.</p><a href="../cliente/index.html" class="btn btn-gold mt-4">Ver cardápio</a></div>`;
    return;
  }

  box.innerHTML = `<ul class="cart-list">${items.map(i => `<li class="cart-item"><img src="${typeof i.image_url === 'string' ? i.image_url : '../../assets/img/hero-beer.jpg'}" alt="${App.escapeHTML(i.name)}"><div style="flex:1;min-width:0"><div class="font-display truncate">${App.escapeHTML(i.name)}</div><div class="text-xs muted">${App.formatBRL(i.price_cents)} cada</div></div><div class="qty"><button class="icon-btn" data-dec="${App.escapeHTML(i.id)}">${App.icon('minus')}</button><span class="font-display" style="width:1.5rem;text-align:center">${i.qty}</span><button class="icon-btn" data-inc="${App.escapeHTML(i.id)}">${App.icon('plus')}</button></div><div class="price cart-price" style="width:5.5rem;text-align:right">${App.formatBRL(i.price_cents * i.qty)}</div><button class="icon-btn muted" data-rm="${App.escapeHTML(i.id)}">${App.icon('trash-2')}</button></li>`).join('')}</ul><label class="field mt-4"><span class="label">Observações (opcional)</span><textarea id="notes" class="textarea" rows="2" placeholder="Ex.: sem cebola, ponto da carne, etc."></textarea></label><div class="total-row"><span class="font-display uppercase tracking muted">Total</span><span class="font-display text-2xl text-gradient-gold">${App.formatBRL(App.total())}</span></div><button id="finalize" class="btn btn-gold hover-lift w-full mt-5">Finalizar pedido ${App.icon('arrow-right')}</button>`;

  document.querySelectorAll('[data-dec]').forEach(btn => btn.onclick = () => {
    const item = App.cart().find(i => i.id === btn.dataset.dec);
    if (!item) return;
    App.updateQty(btn.dataset.dec, item.qty - 1);
    drawBox();
  });

  document.querySelectorAll('[data-inc]').forEach(btn => btn.onclick = () => {
    const item = App.cart().find(i => i.id === btn.dataset.inc);
    if (!item) return;
    App.updateQty(btn.dataset.inc, item.qty + 1);
    drawBox();
  });

  document.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
    App.remove(btn.dataset.rm);
    drawBox();
  });

  document.getElementById('finalize').onclick = finalize;
  App.safeIcons();
}

function finalize() {
  if (isFinalizing) return;
  const customer = App.customer();
  const items = App.cart();

  if (!customer) return App.toast('Identifique-se antes.');
  if (!items.length) return App.toast('Carrinho vazio.');

  isFinalizing = true;
  const finalizeBtn = document.getElementById('finalize');
  if (finalizeBtn) finalizeBtn.disabled = true;

  try {
    const notes = String(document.getElementById('notes')?.value || '').trim();
    const pedido = App.createPedidoFromCart({ customer, items, notes });
    App.addPedido(pedido);
    App.clearCart();
    App.toast(`Pedido ${pedido.codigo} enviado para a cozinha!`);
    location.href = `../pedido/index.html?id=${encodeURIComponent(pedido.id)}`;
  } catch (err) {
    console.error(err);
    App.toast('Erro ao finalizar pedido. Tente novamente.');
    isFinalizing = false;
    if (finalizeBtn) finalizeBtn.disabled = false;
  }
}

function renderCounterPanel() {
  const allowed = ['recebido', 'preparando', 'pronto'];
  const pedidos = App.getPedidos().filter(p => allowed.includes(p.status));

  document.getElementById('app').innerHTML = `<section class="container page-pad"><div class="top-row"><div><h1 class="font-display text-4xl">Balcão</h1><p class="text-sm muted">Atualização automática a cada 2s — ${pedidos.length} pedido(s) em andamento.</p></div><a href="./index.html" class="btn btn-outline">Voltar ao carrinho</a></div><div class="kanban mt-6" id="counter-board"></div></section>`;

  const board = document.getElementById('counter-board');
  const cols = [
    { status: 'recebido', title: 'Recebidos', icon: 'bell' },
    { status: 'preparando', title: 'Em preparo', icon: 'chef-hat' },
    { status: 'pronto', title: 'Prontos', icon: 'package-check' }
  ];

  for (const col of cols) {
    const list = pedidos.filter(p => p.status === col.status);
    board.insertAdjacentHTML('beforeend', `<div class="column"><div class="column-head"><div class="column-title"><i data-lucide="${col.icon}" style="color:var(--gold)"></i>${col.title}</div><span class="count">${list.length}</span></div><div class="space-y">${list.map(renderCard).join('') || '<div class="empty">Vazio</div>'}</div></div>`);
  }

  document.querySelectorAll('[data-next]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.id;
    const next = btn.dataset.next;
    if (!id || !next) return;
    const ok = App.updatePedidoStatus(id, next);
    App.toast(ok ? 'Status atualizado' : 'Não foi possível atualizar este pedido');
    renderCounterPanel();
  });

  App.safeIcons();
}

function renderCard(pedido) {
  const nextMap = {
    recebido: ['preparando', 'Iniciar preparo'],
    preparando: ['pronto', 'Marcar pronto'],
    pronto: ['entregue', 'Entregue']
  };

  const next = nextMap[pedido.status];
  return `<article class="order-card card-surface"><div class="flex items-center justify-between"><div class="font-display text-gradient-gold">${App.escapeHTML(pedido.codigo)}</div><span class="text-xs muted">${pedido.tipo === 'delivery' ? 'Delivery' : App.escapeHTML(pedido.mesa || '')}</span></div><div class="mt-1 text-sm muted">${App.escapeHTML(pedido.cliente || 'Cliente')}</div><div class="mt-3 flex items-center justify-between"><span class="price">${App.formatBRL(pedido.total)}</span>${next ? `<button class="add-btn" data-id="${App.escapeHTML(pedido.id)}" data-next="${next[0]}">${next[1]}</button>` : ''}</div></article>`;
}

