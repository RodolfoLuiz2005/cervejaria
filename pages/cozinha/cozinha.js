const COZINHA_PASS = 'cozinha123';
let kitchenTimer = null;
let lastReceivedIds = new Set();
let rendering = false;
let filter = 'all';

function ensureCozinhaAccess() {
  if (App.hasRole('cozinha')) return true;
  const code = window.prompt('Acesso restrito à cozinha. Informe o código de acesso:');
  if (code === COZINHA_PASS) {
    App.setSession('cozinha');
    return true;
  }
  App.toast('Acesso negado');
  location.href = '../../index.html';
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!ensureCozinhaAccess()) return;
  const header = document.getElementById('header');
  if (header) header.innerHTML = App.renderHeader({ showInternal: true });
  renderKitchen();
  kitchenTimer = setInterval(renderKitchen, 2000);
  App.safeIcons();
});

function detectNewOrders(pedidos) {
  const current = new Set(pedidos.filter(p => p.status === 'recebido').map(p => String(p.id)));
  if (lastReceivedIds.size > 0) {
    for (const id of current) {
      if (!lastReceivedIds.has(id)) {
        App.playNewOrderSound();
        break;
      }
    }
  }
  lastReceivedIds = current;
}

function getKitchenPedidos() {
  const allowed = ['recebido', 'preparando', 'pronto'];
  return App.getPedidos().filter(p => allowed.includes(p.status));
}

function nextStatus(pedido) {
  if (pedido.status === 'recebido') return ['preparando', 'Iniciar preparo'];
  if (pedido.status === 'preparando') return ['pronto', 'Marcar pronto'];
  if (pedido.status === 'pronto') return ['entregue', pedido.tipo === 'delivery' ? 'Saiu para entrega' : 'Entregue na mesa'];
  return null;
}

function formatPedidoTime(iso) {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function renderKitchen() {
  if (rendering) return;
  rendering = true;
  try {
    let pedidos = getKitchenPedidos();
    detectNewOrders(pedidos);

    if (filter !== 'all') pedidos = pedidos.filter(p => p.tipo === filter);

    document.getElementById('app').innerHTML = `<section class="container-xl page-pad"><div class="top-row"><div><h1 class="font-display text-4xl">Painel da Cozinha</h1><p class="text-sm muted">Atualização em tempo real — ${pedidos.length} pedido(s) ativo(s).</p></div><div class="flex gap-2"><button class="chip ${filter === 'all' ? 'active' : ''}" data-filter="all">Todos</button><button class="chip ${filter === 'mesa' ? 'active' : ''}" data-filter="mesa">mesa</button><button class="chip ${filter === 'delivery' ? 'active' : ''}" data-filter="delivery">delivery</button></div></div><div class="kanban" id="board"></div></section>`;

    document.querySelectorAll('[data-filter]').forEach(btn => btn.onclick = () => {
      filter = btn.dataset.filter;
      renderKitchen();
    });

    const board = document.getElementById('board');
    const cols = [
      ['recebido', 'Recebidos', 'bell'],
      ['preparando', 'Em preparo', 'chef-hat'],
      ['pronto', 'Prontos', 'package-check']
    ];

    for (const col of cols) {
      const list = pedidos.filter(p => p.status === col[0]);
      board.insertAdjacentHTML('beforeend', `<div class="column"><div class="column-head"><div class="column-title"><i data-lucide="${col[2]}" style="color:var(--gold)"></i>${col[1]}</div><span class="count">${list.length}</span></div><div class="space-y">${list.map(card).join('') || '<div class="empty">Vazio</div>'}</div></div>`);
    }

    document.querySelectorAll('[data-next]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.id;
      const next = btn.dataset.next;
      if (!id || !next) return;
      const ok = App.updatePedidoStatus(id, next);
      App.toast(ok ? 'Status atualizado' : 'Não foi possível atualizar este pedido');
      renderKitchen();
    });

    App.safeIcons();
  } finally {
    rendering = false;
  }
}

function card(pedido) {
  const next = nextStatus(pedido);
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

  return `<article class="order-card card-surface"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="font-display text-gradient-gold">${App.escapeHTML(pedido.codigo)}</span>${pedido.tipo === 'delivery' ? `<span class="tag tag-delivery"><i data-lucide="bike"></i> Delivery</span>` : `<span class="tag tag-mesa">${App.escapeHTML(pedido.mesa || 'Mesa')}</span>`}</div><span class="text-xs muted flex gap-1"><i data-lucide="clock"></i>${formatPedidoTime(pedido.criadoEm)}</span></div><div class="mt-1 text-sm muted">${App.escapeHTML(pedido.cliente || '')}</div>${pedido.endereco ? `<div class="text-xs muted">${App.escapeHTML(pedido.endereco)}</div>` : ''}<ul class="mt-2" style="padding:0;list-style:none">${itens.map(i => `<li class="flex justify-between text-sm"><span><span class="price">${Number(i.quantidade || 0)}x</span> ${App.escapeHTML(i.nome || '')}</span><span class="muted">${App.formatBRL(Number(i.preco || 0) * Number(i.quantidade || 0))}</span></li>`).join('') || '<li class="text-xs muted">Sem itens</li>'}</ul>${pedido.observacoes ? `<p class="mt-2 text-xs" style="background:rgba(217,130,54,.1);color:var(--ember);padding:.35rem .5rem;border-radius:.4rem">${App.escapeHTML(pedido.observacoes)}</p>` : ''}<div class="mt-3 flex items-center justify-between"><span class="price">${App.formatBRL(pedido.total)}</span>${next ? `<button class="add-btn" data-id="${App.escapeHTML(pedido.id)}" data-next="${next[0]}"><i data-lucide="check"></i>${next[1]}</button>` : ''}</div></article>`;
}

