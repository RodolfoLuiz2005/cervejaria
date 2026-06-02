let trackTimer = null;
let lookup = { mode: 'latest', value: '' };

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  if (header) header.innerHTML = App.renderHeader({ showTrack: true, showInternal: false });

  const idFromUrl = new URLSearchParams(location.search).get('id');
  if (idFromUrl) {
    lookup = { mode: 'id', value: idFromUrl };
  }

  renderTrackPage();
  trackTimer = setInterval(() => renderTrackPage(false), 2000);
  App.safeIcons();
});

function getPedidoByLookup() {
  const pedidos = App.getPedidos();
  if (!pedidos.length) return null;

  if (lookup.mode === 'id' && lookup.value) {
    return App.getPedidoById(lookup.value) || null;
  }

  if (lookup.mode === 'codigo') {
    const code = String(lookup.value || '').trim().toUpperCase();
    if (!code) return null;
    return pedidos.find(p => String(p.codigo || '').toUpperCase() === code) || null;
  }

  if (lookup.mode === 'mesa') {
    const mesa = String(lookup.value || '').trim().toLowerCase();
    if (!mesa) return null;
    return pedidos.slice().reverse().find(p => String(p.mesa || '').toLowerCase().includes(mesa)) || null;
  }

  const lastId = App.getLastPedidoId();
  if (lastId) {
    const p = App.getPedidoById(lastId);
    if (p) return p;
  }

  return pedidos.slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))[0] || null;
}

function stepsFor() {
  return [
    ['recebido', 'Pedido recebido', 'clock'],
    ['preparando', 'Em preparo', 'chef-hat'],
    ['pronto', 'Pronto', 'package-check'],
    ['entregue', 'Finalizado', 'check']
  ];
}

function statusLabel(status) {
  return ({
    recebido: 'Pedido recebido',
    preparando: 'Em preparo',
    pronto: 'Pronto',
    entregue: 'Finalizado'
  }[status] || status);
}

function renderTrackPage(animate = true) {
  const pedido = getPedidoByLookup();
  const steps = stepsFor();
  const idx = pedido ? Math.max(0, steps.findIndex(s => s[0] === pedido.status)) : 0;
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];

  document.getElementById('app').innerHTML = `<section class="container page-pad ${animate ? 'motion-slide-up' : ''}" style="max-width:52rem"><div class="card-surface rounded-2xl p-6 ${animate ? 'motion-scale-in' : ''}"><div class="top-row"><div><div class="text-xs uppercase tracking muted">Acompanhar pedido</div><h1 class="font-display text-3xl text-gradient-gold">${App.escapeHTML(pedido?.codigo || 'Sem pedido')}</h1></div><div class="flex gap-2"><button class="chip ${lookup.mode === 'latest' ? 'active' : ''}" data-mode="latest">Mais recente</button><button class="chip ${lookup.mode === 'codigo' ? 'active' : ''}" data-mode="codigo">Por código</button><button class="chip ${lookup.mode === 'mesa' ? 'active' : ''}" data-mode="mesa">Por mesa</button></div></div><form id="lookup-form" class="mt-4 flex gap-2 ${lookup.mode === 'latest' ? 'hidden' : ''}"><input id="lookup-input" class="input" placeholder="${lookup.mode === 'codigo' ? 'Ex.: PED-001' : 'Ex.: Mesa 01'}" value="${App.escapeHTML(lookup.value || '')}"><button class="btn btn-outline" type="submit">Buscar</button></form>${pedido ? `<div class="mt-4 text-sm muted">Cliente: <span class="price">${App.escapeHTML(pedido.cliente || '-')}</span> • ${pedido.tipo === 'delivery' ? `Delivery` : App.escapeHTML(pedido.mesa || 'Mesa')}</div>` : `<p class="muted mt-4">Nenhum pedido encontrado para os critérios atuais.</p>`}<ol class="status-steps ${animate ? 'reveal-stagger' : ''}">${steps.map((s, i) => `<li class="status-step ${animate ? 'reveal-scale' : ''} ${pedido && i <= idx ? 'active' : ''}"><div class="status-icon">${pedido && i === idx ? '<span class="animate-shimmer" style="position:absolute;inset:0;border-radius:999px"></span>' : ''}<i data-lucide="${s[2]}"></i></div><span class="status-label">${s[1]}</span></li>`).join('')}</ol><div class="mt-8 ${animate ? 'reveal' : ''}"><h2 class="font-display text-sm uppercase tracking muted">Itens</h2><ul class="cart-list mt-2 ${animate ? 'motion-stagger reveal-stagger' : ''}">${itens.map(i => `<li class="flex justify-between text-sm ${animate ? 'reveal-left' : ''}" style="padding:.5rem 0;border-bottom:1px solid rgba(74,83,96,.65)"><span>${Number(i.quantidade || 0)}x ${App.escapeHTML(i.nome || '')}</span><span class="price">${App.formatBRL(Number(i.preco || 0) * Number(i.quantidade || 0))}</span></li>`).join('') || '<li class="muted text-sm" style="padding:.5rem 0">Sem itens para exibir.</li>'}</ul></div>${pedido ? `<div class="mt-4 flex items-center justify-between"><span class="muted">Status atual: <span class="price">${App.escapeHTML(statusLabel(pedido.status))}</span></span><span class="price">${App.formatBRL(pedido.total || 0)}</span></div>` : ''}<a href="../cliente/index.html" class="mt-6" style="display:inline-block;color:var(--gold)">Voltar ao cardápio</a></div></section>`;

  document.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => {
    lookup.mode = btn.dataset.mode;
    lookup.value = '';
    renderTrackPage();
  });

  const form = document.getElementById('lookup-form');
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      lookup.value = String(document.getElementById('lookup-input')?.value || '').trim();
      if (!lookup.value && lookup.mode !== 'latest') {
        App.toast('Informe um valor para buscar');
        return;
      }
      renderTrackPage();
    };
  }

  App.safeIcons();
}
