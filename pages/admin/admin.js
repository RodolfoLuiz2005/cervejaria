const ADMIN_PASS = 'admin123';
const RESET_PASSWORD = '1234';

const ADMIN_RESET_KEY = 'mk_admin_dashboard_reset';
const ADMIN_BACKUP_KEY = 'mk_admin_backup_history';

const SUGGESTED_CATEGORIES = [
  { id: 'Promo��es', name: 'Promo��es' },
  { id: 'Cervejas', name: 'Cervejas' },
  { id: 'Chopes', name: 'Chopes' },
  { id: 'Drinks', name: 'Drinks' },
  { id: 'Guaran�s', name: 'Guaran�s' },
  { id: 'N�o alco�licos', name: 'N�o alco�licos' },
  { id: 'Petiscos', name: 'Petiscos' },
  { id: 'Por��es', name: 'Por��es' },
  { id: 'Prato da casa', name: 'Prato da casa' },
  { id: 'Sobremesas', name: 'Sobremesas' }
];

let adminTab = 'dashboard';
let editingId = null;
let promoEditingId = null;
let pedidoFilter = 'all';
let refreshTimer = null;
let productImageData = '';

function ensureAdminAccess() {
  if (App.hasRole('admin')) return true;
  const code = window.prompt('Acesso restrito ao admin. Informe o código de acesso:');
  if (code === ADMIN_PASS) {
    App.setSession('admin');
    return true;
  }
  App.toast('Acesso negado');
  location.href = '../../index.html';
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!ensureAdminAccess()) return;
  backupLogicalData();
  const header = document.getElementById('header');
  if (header) header.innerHTML = App.renderHeader({ showInternal: true });
  startAutoRefresh();
  window.addEventListener('storage', onStorageSync);
  renderAdmin();
  App.safeIcons();
});

function onStorageSync(e) {
  if (e && e.key && ![App.keys.pedidos, App.keys.products, App.keys.promotions].includes(e.key)) return;
  renderAdmin();
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (!['pedidos', 'dashboard', 'faturamento'].includes(adminTab)) return;
    renderAdmin();
  }, 2000);
}

function backupLogicalData() {
  const history = App.get(ADMIN_BACKUP_KEY, []);
  const now = new Date();
  const last = history[history.length - 1];
  if (last && last.at) {
    const diff = now.getTime() - new Date(last.at).getTime();
    if (Number.isFinite(diff) && diff < 5 * 60 * 1000) return;
  }
  history.push({
    at: now.toISOString(),
    pedidos: App.get(App.keys.pedidos, []),
    produtos: App.get(App.keys.products, []),
    promocoes: App.get(App.keys.promotions, []),
    config: App.get('mk_config', {})
  });
  App.set(ADMIN_BACKUP_KEY, history.slice(-10));
}

function getProducts() { return App.getProductsLocal(); }
function saveProducts(list) { return App.saveProductsLocal(list); }
function getPedidos() { return App.getPedidos(); }
function getPromocoes() { return App.getPromocoes(); }
function savePromocoes(list) { App.savePromocoes(list); }
function getConfig() { return App.get('mk_config', { mesas: 20 }); }
function saveConfig(cfg) { App.set('mk_config', cfg); }
function getResetState() { return App.get(ADMIN_RESET_KEY, { at: null, history: [] }); }
function saveResetState(state) { App.set(ADMIN_RESET_KEY, state); }

function statusLabel(status) {
  return ({ recebido: 'Recebido', preparando: 'Preparando', pronto: 'Pronto', entregue: 'Finalizado' }[status] || status);
}

function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function weekStart(d) {
  const s = dayStart(d);
  const diff = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - diff);
  return s;
}
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }

function periodMetrics(pedidos, start, now, resetAt) {
  const effectiveStart = resetAt && resetAt > start ? resetAt : start;
  const list = pedidos.filter(p => {
    const d = new Date(p.criadoEm || Date.now());
    if (Number.isNaN(d.getTime())) return false;
    return d >= effectiveStart && d <= now;
  });
  return {
    pedidos: list.length,
    faturamento: list.filter(p => p.status === 'entregue').reduce((sum, p) => sum + Number(p.total || 0), 0)
  };
}

function dashboardMetrics() {
  const pedidos = getPedidos();
  const now = new Date();
  const reset = getResetState();
  const resetAt = reset.at ? new Date(reset.at) : null;
  return {
    day: periodMetrics(pedidos, dayStart(now), now, resetAt),
    week: periodMetrics(pedidos, weekStart(now), now, resetAt),
    month: periodMetrics(pedidos, monthStart(now), now, resetAt),
    reset
  };
}

function renderAdmin() {
  document.getElementById('app').innerHTML = `<div class="admin-layout"><div class="admin-wrap"><header class="admin-head"><div><h1 class="font-display text-3xl text-gradient-gold">Admin</h1><p class="text-sm muted">Painel administrativo</p></div><div class="admin-actions"><a href="../cozinha/index.html" class="btn btn-outline">Cozinha</a><a href="../balcao/index.html?modo=painel" class="btn btn-outline">Balcão</a></div></header><section class="card-surface rounded-2xl p-4"><div class="chips"><button class="chip ${adminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button><button class="chip ${adminTab === 'produtos' ? 'active' : ''}" data-tab="produtos">Produtos</button><button class="chip ${adminTab === 'promocoes' ? 'active' : ''}" data-tab="promocoes">Promoções</button><button class="chip ${adminTab === 'pedidos' ? 'active' : ''}" data-tab="pedidos">Pedidos</button><button class="chip ${adminTab === 'faturamento' ? 'active' : ''}" data-tab="faturamento">Relatórios</button><button class="chip ${adminTab === 'config' ? 'active' : ''}" data-tab="config">Configurações</button></div></section><section id="admin-content" class="card-surface rounded-2xl p-6"></section></div></div>`;

  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => {
    adminTab = btn.dataset.tab;
    renderAdmin();
  });

  if (adminTab === 'dashboard') renderDashboard();
  if (adminTab === 'produtos') renderProdutos();
  if (adminTab === 'promocoes') renderPromocoes();
  if (adminTab === 'pedidos') renderPedidos();
  if (adminTab === 'faturamento') renderFaturamento();
  if (adminTab === 'config') renderConfig();
  App.safeIcons();
}

function renderDashboard() {
  const m = dashboardMetrics();
  const resetAt = m.reset.at ? new Date(m.reset.at).toLocaleString('pt-BR') : 'Nunca';
  const history = Array.isArray(m.reset.history) ? m.reset.history.slice(-5).reverse() : [];
  document.getElementById('admin-content').innerHTML = `<div class="flex items-center justify-between gap-2"><h2 class="font-display text-lg">Dashboard</h2><button id="reset-dashboard" class="btn btn-outline">Resetar números</button></div><p class="text-xs muted mt-2">Último reset: ${App.escapeHTML(resetAt)}</p><div class="admin-kpi-grid mt-4"><article class="card-surface rounded-xl p-4"><div class="label">Pedidos do dia</div><div class="font-display text-3xl">${m.day.pedidos}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Faturamento do dia</div><div class="font-display text-3xl">${App.formatBRL(m.day.faturamento)}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Pedidos da semana</div><div class="font-display text-3xl">${m.week.pedidos}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Faturamento da semana</div><div class="font-display text-3xl">${App.formatBRL(m.week.faturamento)}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Pedidos do mês</div><div class="font-display text-3xl">${m.month.pedidos}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Faturamento do mês</div><div class="font-display text-3xl">${App.formatBRL(m.month.faturamento)}</div></article></div><div class="mt-6"><h3 class="font-display text-sm uppercase tracking muted">Histórico de reset</h3><ul class="admin-reset-history">${history.map(item => `<li>${App.escapeHTML(new Date(item.at).toLocaleString('pt-BR'))}</li>`).join('') || '<li class="muted">Sem histórico.</li>'}</ul></div>`;
  const resetBtn = document.getElementById('reset-dashboard');
  if (resetBtn) resetBtn.onclick = resetDashboard;
}

function resetDashboard() {
  if (!window.confirm('Confirma resetar os números do dashboard? Isso não apaga produtos nem configurações.')) return;
  const pass = window.prompt('Informe a senha de reset:');
  if (pass !== RESET_PASSWORD) return App.toast('Senha inválida. Reset cancelado.');
  const nowIso = new Date().toISOString();
  const state = getResetState();
  saveResetState({
    at: nowIso,
    history: [...(Array.isArray(state.history) ? state.history : []), { at: nowIso }].slice(-20)
  });
  App.toast('Números do dashboard resetados.');
  renderDashboard();
}

function categoryCatalog() {
  const source = Array.isArray(App.CATEGORIAS_CARDAPIO) && App.CATEGORIAS_CARDAPIO.length
    ? App.CATEGORIAS_CARDAPIO
    : SUGGESTED_CATEGORIES.map(c => c.name);
  return source.map(name => ({ id: name, name }));
}

function sortProducts(products) {
  const categories = categoryCatalog();
  const order = new Map(categories.map((c, i) => [String(c.id), i]));
  return products.slice().sort((a, b) => {
    const aCat = String(a.category_id || '');
    const bCat = String(b.category_id || '');
    const byCat = (order.get(aCat) ?? 999) - (order.get(bCat) ?? 999);
    if (byCat !== 0) return byCat;
    return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
  });
}

function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Erro ao ler imagem'));
    reader.readAsDataURL(file);
  });
}

function renderProdutos() {
  const products = sortProducts(getProducts());
  const categories = categoryCatalog();
  const current = editingId ? products.find(p => String(p.id) === String(editingId)) : null;
  productImageData = current?.image_url || '';

  document.getElementById('admin-content').innerHTML = `<h2 class="font-display text-lg">${current ? 'Editar produto' : 'Adicionar produto'}</h2><form id="product-form" class="admin-form-grid mt-4"><label><span class="label">Nome *</span><input class="input" id="prod-name" required value="${App.escapeHTML(current?.name || '')}"></label><label><span class="label">Categoria *</span><select class="select" id="prod-category" required>${categories.map(c => `<option value="${App.escapeHTML(c.id)}" ${String(current?.category_id) === String(c.id) ? 'selected' : ''}>${App.escapeHTML(c.name)}</option>`).join('')}</select></label><label><span class="label">Preço (R$) *</span><input class="input" id="prod-price" type="number" min="0.01" step="0.01" required value="${current ? (Number(current.price_cents || 0) / 100).toFixed(2) : ''}"></label><label><span class="label">Ativo</span><select class="select" id="prod-available"><option value="true" ${current?.available !== false ? 'selected' : ''}>Sim</option><option value="false" ${current?.available === false ? 'selected' : ''}>Não</option></select></label><label class="admin-form-full"><span class="label">Descrição *</span><textarea class="textarea" id="prod-description" rows="2" required>${App.escapeHTML(current?.description || '')}</textarea></label><label class="admin-form-full"><span class="label">Imagem *</span><input class="input" id="prod-image-file" type="file" accept="image/*"></label><div class="admin-image-preview-wrap admin-form-full"><img id="prod-image-preview" class="admin-image-preview ${productImageData ? '' : 'hidden'}" src="${App.escapeHTML(productImageData)}" alt="Preview da imagem"><p id="prod-image-empty" class="muted text-xs ${productImageData ? 'hidden' : ''}">Nenhuma imagem selecionada.</p></div><div class="admin-form-full flex gap-2"><button class="btn btn-gold" type="submit">${current ? 'Salvar alterações' : 'Adicionar produto'}</button>${current ? '<button type="button" id="cancel-edit" class="btn btn-outline">Cancelar edição</button>' : ''}</div></form><h2 class="font-display text-lg mt-8">Produtos cadastrados</h2><div id="products-by-category" class="mt-4"></div>`;

  const fileInput = document.getElementById('prod-image-file');
  if (fileInput) fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return App.toast('Selecione uma imagem válida.');
    try {
      productImageData = await imageToBase64(file);
      const img = document.getElementById('prod-image-preview');
      const empty = document.getElementById('prod-image-empty');
      if (img) { img.src = productImageData; img.classList.remove('hidden'); }
      if (empty) empty.classList.add('hidden');
    } catch {
      App.toast('Erro ao carregar imagem.');
    }
  };

  document.getElementById('product-form').onsubmit = e => {
    e.preventDefault();
    const name = String(document.getElementById('prod-name').value || '').trim();
    const category = String(document.getElementById('prod-category').value || '').trim();
    const priceFloat = Number(document.getElementById('prod-price').value);
    const description = String(document.getElementById('prod-description').value || '').trim();
    const available = document.getElementById('prod-available').value === 'true';
    const image = String(productImageData || current?.image_url || '').trim();

    if (name.length < 2) return App.toast('Nome inválido.');
    if (!category) return App.toast('Categoria obrigatória.');
    if (!Number.isFinite(priceFloat) || priceFloat <= 0) return App.toast('Preço inválido.');
    if (!description) return App.toast('Descrição obrigatória.');
    if (!image) return App.toast('Imagem obrigatória.');

    const duplicated = getProducts().some(p => {
      if (editingId && String(p.id) === String(editingId)) return false;
      return String(p.name || '').trim().toLowerCase() === name.toLowerCase() && String(p.category_id || '') === category;
    });
    if (duplicated) return App.toast('Produto duplicado na mesma categoria.');

    const payload = {
      id: editingId || `local-prod-${Date.now()}`,
      category_id: category,
      name,
      description,
      price_cents: Math.round(priceFloat * 100),
      image_url: image,
      available,
      is_promo: Boolean(current?.is_promo)
    };

    const list = getProducts();
    const next = editingId ? list.map(p => String(p.id) === String(editingId) ? { ...p, ...payload } : p) : [...list, payload];
    if (!saveProducts(next)) return App.toast('Operação bloqueada para evitar perda de produtos.');
    editingId = null;
    App.toast('Produto salvo.');
    renderProdutos();
  };

  const cancel = document.getElementById('cancel-edit');
  if (cancel) cancel.onclick = () => { editingId = null; renderProdutos(); };

  renderProductsGrouped(products, categories);
}

function renderProductsGrouped(products, categories) {
  const container = document.getElementById('products-by-category');
  if (!container) return;
  const nameById = new Map(categories.map(c => [String(c.id), c.name]));
  const order = new Map(categories.map((c, i) => [String(c.id), i]));
  const groups = new Map();
  products.forEach(p => {
    const key = String(p.category_id || 'outros');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  container.innerHTML = [...groups.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999)).map(([cat, list]) => `<section class="admin-category-block"><h3 class="font-display text-sm uppercase tracking muted">${App.escapeHTML(nameById.get(cat) || cat)}</h3><div class="table-wrap mt-2"><table class="table"><thead><tr><th>Nome</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(p => `<tr><td>${App.escapeHTML(p.name)}</td><td>${App.formatBRL(p.price_cents)}</td><td class="muted">${p.available === false ? 'Inativo' : 'Ativo'}${p.is_promo ? ' • Promo' : ''}</td><td><div class="flex gap-2 admin-actions-cell"><button class="chip" data-edit="${App.escapeHTML(p.id)}">Editar</button><button class="chip" data-toggle-available="${App.escapeHTML(p.id)}">${p.available === false ? 'Ativar' : 'Desativar'}</button><button class="chip" data-delete="${App.escapeHTML(p.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div></section>`).join('') || '<p class="muted">Nenhum produto cadastrado.</p>';

  document.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => { editingId = btn.dataset.edit; renderProdutos(); });
  document.querySelectorAll('[data-toggle-available]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.toggleAvailable;
    const saved = saveProducts(getProducts().map(p => String(p.id) === String(id) ? { ...p, available: p.available === false } : p));
    if (!saved) return App.toast('Não foi possível atualizar este produto.');
    App.toast('Status atualizado.');
    renderProdutos();
  });
  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.delete;
    const product = getProducts().find(p => String(p.id) === String(id));
    if (!window.confirm(`Excluir produto "${product?.name || ''}"?`)) return;
    const saved = saveProducts(getProducts().filter(p => String(p.id) !== String(id)));
    if (!saved) return App.toast('Não é permitido remover todos os produtos do cardápio.');
    if (String(editingId) === String(id)) editingId = null;
    App.toast('Produto excluído.');
    renderProdutos();
  });
}

function syncPromoFlagsToProducts() {
  const promos = getPromocoes();
  const activeProducts = new Set(promos.filter(p => App.promocaoAtiva(p, new Date())).map(p => String(p.produtoId)));
  saveProducts(getProducts().map(p => ({ ...p, is_promo: activeProducts.has(String(p.id)) })));
}

function renderPromocoes() {
  const products = sortProducts(getProducts());
  const promos = getPromocoes();
  const current = promoEditingId ? promos.find(p => String(p.id) === String(promoEditingId)) : null;

  document.getElementById('admin-content').innerHTML = `<h2 class="font-display text-lg">${current ? 'Editar promoção' : 'Criar promoção'}</h2><form id="promo-form" class="admin-form-grid mt-4"><label><span class="label">Produto vinculado *</span><select id="promo-product" class="select" required><option value="">Selecione...</option>${products.map(p => `<option value="${App.escapeHTML(p.id)}" ${String(current?.produtoId) === String(p.id) ? 'selected' : ''}>${App.escapeHTML(p.name)} (${App.formatBRL(p.price_cents)})</option>`).join('')}</select></label><label><span class="label">Nome da promoção *</span><input id="promo-name" class="input" required value="${App.escapeHTML(current?.nome || '')}"></label><label><span class="label">Tipo *</span><select id="promo-type" class="select" required>${App.promoTypes.map(type => `<option value="${type}" ${current?.tipo === type ? 'selected' : ''}>${App.escapeHTML(App.promoTypeLabel(type))}</option>`).join('')}</select></label><label><span class="label">Valor promocional *</span><input id="promo-value" class="input" type="number" min="0.01" step="0.01" required value="${Number(current?.valorPromocional || 0) || ''}"></label><label><span class="label">Início</span><input id="promo-start" class="input" type="date" value="${App.escapeHTML(current?.inicio || '')}"></label><label><span class="label">Fim</span><input id="promo-end" class="input" type="date" value="${App.escapeHTML(current?.fim || '')}"></label><label><span class="label">Status</span><select id="promo-status" class="select"><option value="ativo" ${App.normalizePromocaoStatus(current?.status) === 'ativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${App.normalizePromocaoStatus(current?.status) === 'inativo' ? 'selected' : ''}>Inativo</option></select></label><div class="admin-form-full flex gap-2"><button type="submit" class="btn btn-gold">${current ? 'Salvar promoção' : 'Criar promoção'}</button>${current ? '<button type="button" id="cancel-promo-edit" class="btn btn-outline">Cancelar edição</button>' : ''}</div></form><h2 class="font-display text-lg mt-8">Promoções cadastradas</h2><div class="table-wrap mt-4"><table class="table"><thead><tr><th>Promoção</th><th>Produto</th><th>Tipo</th><th>Valor</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead><tbody>${promos.map(promo => { const product = products.find(p => String(p.id) === String(promo.produtoId)); const period = `${promo.inicio || '--'} até ${promo.fim || '--'}`; return `<tr><td>${App.escapeHTML(promo.nome)}</td><td>${App.escapeHTML(product?.name || 'Produto removido')}</td><td>${App.escapeHTML(App.promoTypeLabel(promo.tipo))}</td><td>${promo.tipo === 'percentual' ? `${Number(promo.valorPromocional || 0)}%` : App.formatBRL(Math.round(Number(promo.valorPromocional || 0) * 100))}</td><td class="muted">${App.escapeHTML(period)}</td><td class="muted">${App.normalizePromocaoStatus(promo.status) === 'ativo' ? 'Ativa' : 'Inativa'}</td><td><div class="flex gap-2 admin-actions-cell"><button class="chip" data-edit-promo="${App.escapeHTML(promo.id)}">Editar</button><button class="chip" data-toggle-promo="${App.escapeHTML(promo.id)}">${App.normalizePromocaoStatus(promo.status) === 'ativo' ? 'Inativar' : 'Ativar'}</button><button class="chip" data-delete-promo="${App.escapeHTML(promo.id)}">Excluir</button></div></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Nenhuma promoção cadastrada.</td></tr>'}</tbody></table></div>`;

  document.getElementById('promo-form').onsubmit = e => {
    e.preventDefault();
    const produtoId = String(document.getElementById('promo-product').value || '').trim();
    const nome = String(document.getElementById('promo-name').value || '').trim();
    const tipo = String(document.getElementById('promo-type').value || '').trim();
    const valorPromocional = Number(document.getElementById('promo-value').value);
    const inicio = String(document.getElementById('promo-start').value || '').trim();
    const fim = String(document.getElementById('promo-end').value || '').trim();
    const status = App.normalizePromocaoStatus(document.getElementById('promo-status').value);

    if (!produtoId) return App.toast('Produto é obrigatório.');
    if (!nome) return App.toast('Nome da promoção é obrigatório.');
    if (!App.promoTypes.includes(tipo)) return App.toast('Tipo de promoção inválido.');
    if (!Number.isFinite(valorPromocional) || valorPromocional <= 0) return App.toast('Valor promocional inválido.');
    if (tipo === 'percentual' && valorPromocional > 100) return App.toast('Desconto percentual deve ser até 100%.');
    if (inicio && fim && new Date(fim) < new Date(inicio)) return App.toast('Data final não pode ser menor que a inicial.');

    const duplicatedActive = getPromocoes().some(p => {
      if (promoEditingId && String(p.id) === String(promoEditingId)) return false;
      return String(p.produtoId) === produtoId && App.normalizePromocaoStatus(p.status) === 'ativo' && status === 'ativo';
    });
    if (duplicatedActive) return App.toast('Já existe promoção ativa para esse produto.');

    const payload = { id: promoEditingId || `promo-${Date.now()}`, produtoId, nome, tipo, valorPromocional, inicio, fim, status };
    const list = getPromocoes();
    const next = promoEditingId ? list.map(p => String(p.id) === String(promoEditingId) ? payload : p) : [...list, payload];
    savePromocoes(next);
    syncPromoFlagsToProducts();
    promoEditingId = null;
    App.toast('Promoção salva.');
    renderPromocoes();
  };

  const cancel = document.getElementById('cancel-promo-edit');
  if (cancel) cancel.onclick = () => { promoEditingId = null; renderPromocoes(); };
  document.querySelectorAll('[data-edit-promo]').forEach(btn => btn.onclick = () => { promoEditingId = btn.dataset.editPromo; renderPromocoes(); });
  document.querySelectorAll('[data-toggle-promo]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.togglePromo;
    savePromocoes(getPromocoes().map(p => String(p.id) === String(id) ? { ...p, status: App.normalizePromocaoStatus(p.status) === 'ativo' ? 'inativo' : 'ativo' } : p));
    syncPromoFlagsToProducts();
    App.toast('Status da promoção atualizado.');
    renderPromocoes();
  });
  document.querySelectorAll('[data-delete-promo]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.deletePromo;
    const promo = getPromocoes().find(p => String(p.id) === String(id));
    if (!window.confirm(`Excluir promoção "${promo?.nome || ''}"?`)) return;
    savePromocoes(getPromocoes().filter(p => String(p.id) !== String(id)));
    if (String(promoEditingId) === String(id)) promoEditingId = null;
    syncPromoFlagsToProducts();
    App.toast('Promoção excluída.');
    renderPromocoes();
  });
}

function renderPedidos() {
  const all = getPedidos().slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  const pedidos = pedidoFilter === 'all' ? all : all.filter(p => p.status === pedidoFilter);
  document.getElementById('admin-content').innerHTML = `<h2 class="font-display text-lg">Gerenciamento de pedidos</h2><div class="chips mt-4"><button class="chip ${pedidoFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button><button class="chip ${pedidoFilter === 'recebido' ? 'active' : ''}" data-filter="recebido">Recebido</button><button class="chip ${pedidoFilter === 'preparando' ? 'active' : ''}" data-filter="preparando">Preparando</button><button class="chip ${pedidoFilter === 'pronto' ? 'active' : ''}" data-filter="pronto">Pronto</button><button class="chip ${pedidoFilter === 'entregue' ? 'active' : ''}" data-filter="entregue">Finalizado</button></div><div class="table-wrap mt-4"><table class="table"><thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead><tbody>${pedidos.map(p => `<tr><td>${App.escapeHTML(p.codigo)}</td><td>${App.escapeHTML(p.cliente)}</td><td>${p.tipo === 'delivery' ? 'Delivery' : App.escapeHTML(p.mesa || 'Mesa')}</td><td>${statusLabel(p.status)}</td><td>${App.formatBRL(p.total)}</td><td><div class="flex gap-2 admin-actions-cell"><select class="select" data-status-id="${App.escapeHTML(p.id)}"><option value="recebido" ${p.status === 'recebido' ? 'selected' : ''}>Recebido</option><option value="preparando" ${p.status === 'preparando' ? 'selected' : ''}>Preparando</option><option value="pronto" ${p.status === 'pronto' ? 'selected' : ''}>Pronto</option><option value="entregue" ${p.status === 'entregue' ? 'selected' : ''}>Finalizado</option></select><button class="chip" data-save-status="${App.escapeHTML(p.id)}">Salvar</button><button class="chip" data-detail="${App.escapeHTML(p.id)}">Detalhes</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum pedido encontrado.</td></tr>'}</tbody></table></div><div id="pedido-detail" class="mt-4"></div>`;

  document.querySelectorAll('[data-filter]').forEach(btn => btn.onclick = () => { pedidoFilter = btn.dataset.filter; renderPedidos(); });
  document.querySelectorAll('[data-save-status]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.saveStatus;
    const status = document.querySelector(`[data-status-id="${id}"]`)?.value;
    if (!status) return;
    const ok = App.updatePedidoStatus(id, status);
    App.toast(ok ? 'Status atualizado' : 'Não foi possível atualizar este pedido');
    renderPedidos();
  });
  document.querySelectorAll('[data-detail]').forEach(btn => btn.onclick = () => {
    const p = App.getPedidoById(btn.dataset.detail);
    if (!p) return;
    const itens = Array.isArray(p.itens) ? p.itens : [];
    document.getElementById('pedido-detail').innerHTML = `<div class="card-surface rounded-xl p-4"><h3 class="font-display text-lg">Detalhes ${App.escapeHTML(p.codigo)}</h3><p class="text-sm muted mt-2">Cliente: ${App.escapeHTML(p.cliente)} • ${p.tipo === 'delivery' ? App.escapeHTML(p.endereco || 'Delivery') : App.escapeHTML(p.mesa || 'Mesa')}</p><ul class="mt-3" style="padding-left:1rem">${itens.map(i => `<li>${Number(i.quantidade || 0)}x ${App.escapeHTML(i.nome || '')} - ${App.formatBRL(Number(i.preco || 0))}</li>`).join('')}</ul><p class="mt-3"><span class="price">Total: ${App.formatBRL(p.total)}</span></p></div>`;
  });
}

function reportData() {
  const pedidos = getPedidos();
  const now = new Date();
  const reset = getResetState();
  const resetAt = reset.at ? new Date(reset.at) : null;
  const day = periodMetrics(pedidos, dayStart(now), now, resetAt);
  const week = periodMetrics(pedidos, weekStart(now), now, resetAt);
  const month = periodMetrics(pedidos, monthStart(now), now, resetAt);
  const sold = {};
  pedidos.forEach(p => (p.itens || []).forEach(i => { sold[i.nome || 'Item'] = (sold[i.nome || 'Item'] || 0) + Number(i.quantidade || 0); }));
  const byStatus = pedidos.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }), {});
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]);
  return { generatedAt: now.toISOString(), day, week, month, top, byStatus };
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = text.replace(/\"/g, '\"\"');
  return /[\";\\n]/.test(safe) ? `\"${safe}\"` : safe;
}

function downloadReportCsv() {
  const r = reportData();
  const rows = [
    ['gerado_em', r.generatedAt],
    ['pedidos_dia', r.day.pedidos],
    ['faturamento_dia', r.day.faturamento],
    ['pedidos_semana', r.week.pedidos],
    ['faturamento_semana', r.week.faturamento],
    ['pedidos_mes', r.month.pedidos],
    ['faturamento_mes', r.month.faturamento],
    [''],
    ['status', 'quantidade'],
    ...Object.entries(r.byStatus),
    [''],
    ['produto', 'quantidade'],
    ...r.top
  ];
  const csv = rows.map(row => row.map(csvCell).join(';')).join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-admin-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  App.toast('Relatório CSV gerado.');
}

function renderFaturamento() {
  const r = reportData();
  document.getElementById('admin-content').innerHTML = `<div class="flex items-center justify-between gap-2"><h2 class="font-display text-lg">Relatórios</h2><button id="download-report" class="btn btn-outline">Baixar relatório</button></div><div class="admin-kpi-grid mt-4"><article class="card-surface rounded-xl p-4"><div class="label">Pedidos do dia</div><div class="font-display text-3xl">${r.day.pedidos}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Faturamento do dia</div><div class="font-display text-3xl">${App.formatBRL(r.day.faturamento)}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Pedidos da semana</div><div class="font-display text-3xl">${r.week.pedidos}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Faturamento da semana</div><div class="font-display text-3xl">${App.formatBRL(r.week.faturamento)}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Pedidos do mês</div><div class="font-display text-3xl">${r.month.pedidos}</div></article><article class="card-surface rounded-xl p-4"><div class="label">Faturamento do mês</div><div class="font-display text-3xl">${App.formatBRL(r.month.faturamento)}</div></article></div><div class="card-surface rounded-xl p-4 mt-6"><h3 class="font-display text-lg">Produtos mais vendidos</h3><ul class="mt-3" style="padding-left:1rem">${r.top.map(([name, q]) => `<li>${App.escapeHTML(name)} - <span class="price">${q}</span></li>`).join('') || '<li class="muted">Sem vendas registradas.</li>'}</ul></div><div class="card-surface rounded-xl p-4 mt-4"><h3 class="font-display text-lg">Pedidos por status</h3><ul class="mt-3" style="padding-left:1rem">${Object.entries(r.byStatus).map(([status, qty]) => `<li>${App.escapeHTML(statusLabel(status))}: <span class="price">${qty}</span></li>`).join('') || '<li class="muted">Sem pedidos.</li>'}</ul></div>`;
  const btn = document.getElementById('download-report');
  if (btn) btn.onclick = downloadReportCsv;
}

function renderConfig() {
  const cfg = getConfig();
  document.getElementById('admin-content').innerHTML = `<h2 class="font-display text-lg">Configurações</h2><form id="cfg-form" class="grid-2 mt-4" style="max-width:26rem"><label><span class="label">Quantidade de mesas</span><input class="input" id="mesas" type="number" min="1" max="300" value="${Number(cfg.mesas || 20)}"></label><div class="flex items-center"><button class="btn btn-gold" type="submit">Salvar configurações</button></div></form>`;
  document.getElementById('cfg-form').onsubmit = e => {
    e.preventDefault();
    const mesas = Number(document.getElementById('mesas').value || 20);
    if (!Number.isFinite(mesas) || mesas < 1) return App.toast('Quantidade de mesas inválida');
    saveConfig({ ...cfg, mesas: Math.floor(mesas) });
    App.toast('Configurações salvas');
  };
}
