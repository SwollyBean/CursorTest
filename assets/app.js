(function () {
	'use strict';

	const dom = {
		form: document.getElementById('itemForm'),
		name: document.getElementById('name'),
		quantity: document.getElementById('quantity'),
		price: document.getElementById('price'),
		discountPct: document.getElementById('discountPct'),
		size: document.getElementById('size'),
		unit: document.getElementById('unit'),
		addBtn: document.getElementById('addBtn'),
		resetBtn: document.getElementById('resetBtn'),
		body: document.getElementById('itemsBody'),
		taxRate: document.getElementById('taxRate'),
		clearAllBtn: document.getElementById('clearAllBtn'),
		shareBtn: document.getElementById('shareBtn'),
		importBtn: document.getElementById('importBtn'),
		printBtn: document.getElementById('printBtn'),
		summaryItems: document.getElementById('summaryItems'),
		summarySubtotal: document.getElementById('summarySubtotal'),
		summaryTax: document.getElementById('summaryTax'),
		summaryTotal: document.getElementById('summaryTotal'),
	};

	const storageKey = 'grocery-calculator:v1';
	let state = {
		items: [],
		taxRatePct: 0,
	};
	let editingIndex = null;

	function toNumber(value, fallback) {
		const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
		return Number.isFinite(n) ? n : (fallback ?? 0);
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount || 0);
	}

	function round2(value) {
		return Math.round((value + Number.EPSILON) * 100) / 100;
	}

	function save() {
		try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
	}

	function load() {
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (parsed && Array.isArray(parsed.items)) {
				state.items = parsed.items.map(sanitizeItem);
			}
			if (typeof parsed.taxRatePct === 'number') {
				state.taxRatePct = parsed.taxRatePct;
			}
		} catch {}
	}

	function sanitizeItem(item) {
		return {
			name: String(item.name || '').slice(0, 120),
			quantity: toNumber(item.quantity, 0),
			price: toNumber(item.price, 0),
			discountPct: Math.min(100, Math.max(0, toNumber(item.discountPct, 0))),
			size: Math.max(0, toNumber(item.size, 0)),
			unit: String(item.unit || '').slice(0, 16),
		};
	}

	function computeLine(item) {
		const quantity = toNumber(item.quantity, 0);
		const priceEach = toNumber(item.price, 0);
		const discountPct = Math.min(100, Math.max(0, toNumber(item.discountPct, 0)));
		const gross = quantity * priceEach;
		const discount = gross * (discountPct / 100);
		const net = gross - discount;
		const unitPrice = item.size > 0 ? (priceEach / item.size) : null;
		return { gross, discount, net, unitPrice };
	}

	function recalc() {
		let subtotal = 0;
		for (const item of state.items) {
			subtotal += computeLine(item).net;
		}
		subtotal = round2(subtotal);
		const tax = round2(subtotal * (toNumber(state.taxRatePct, 0) / 100));
		const total = round2(subtotal + tax);

		dom.summaryItems.textContent = String(state.items.length);
		dom.summarySubtotal.textContent = formatCurrency(subtotal);
		dom.summaryTax.textContent = formatCurrency(tax);
		dom.summaryTotal.textContent = formatCurrency(total);
	}

	function render() {
		dom.body.innerHTML = '';
		for (const [index, item] of state.items.entries()) {
			const { net, unitPrice } = computeLine(item);
			const tr = document.createElement('tr');
			tr.innerHTML = [
				`<td>${escapeHtml(item.name)}</td>`,
				`<td class="num">${toFixed(item.quantity)}</td>`,
				`<td class="num">${formatCurrency(item.price)}</td>`,
				`<td class="num">${toFixed(item.discountPct)}%</td>`,
				`<td class="num">${unitPrice != null ? `${formatCurrency(unitPrice)}${item.unit ? `/${escapeHtml(item.unit)}` : ''}` : '<span class="tag">—</span>'}</td>`,
				`<td class="num">${formatCurrency(net)}</td>`,
				`<td class="actions">`
					+ `<button data-action="edit" data-index="${index}">Edit</button>`
					+ `<button data-action="delete" data-index="${index}" style="border-color:#3a2230;color:#ff9aa9;">Delete</button>`
				+ `</td>`
			].join('');
			dom.body.appendChild(tr);
		}
		recalc();
		save();
	}

	function toFixed(n) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 }); }

	function escapeHtml(s) { return String(s).replace(/[&<>\"]/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]); }); }

	function onSubmit(e) {
		e.preventDefault();
		const item = sanitizeItem({
			name: dom.name.value,
			quantity: dom.quantity.value,
			price: dom.price.value,
			discountPct: dom.discountPct.value,
			size: dom.size.value,
			unit: dom.unit.value,
		});
		if (!item.name) return;
		if (editingIndex != null) {
			state.items[editingIndex] = item;
			editingIndex = null;
			dom.addBtn.textContent = 'Add Item';
		} else {
			state.items.push(item);
		}
		clearFormExceptName();
		render();
		focusName();
	}

	function clearFormExceptName() {
		dom.quantity.value = '1';
		dom.price.value = '0';
		dom.discountPct.value = '0';
		dom.size.value = '';
		dom.unit.value = '';
	}

	function onBodyClick(e) {
		const btn = e.target.closest('button');
		if (!btn) return;
		const index = toNumber(btn.getAttribute('data-index'), null);
		const action = btn.getAttribute('data-action');
		if (index == null || !action) return;
		if (action === 'delete') {
			state.items.splice(index, 1);
			render();
		} else if (action === 'edit') {
			const item = state.items[index];
			editingIndex = index;
			dom.name.value = item.name;
			dom.quantity.value = String(item.quantity);
			dom.price.value = String(item.price);
			dom.discountPct.value = String(item.discountPct);
			dom.size.value = item.size ? String(item.size) : '';
			dom.unit.value = item.unit;
			dom.addBtn.textContent = 'Update Item';
			window.scrollTo({ top: 0, behavior: 'smooth' });
			dom.name.focus();
		}
	}

	function focusName() { dom.name.focus(); dom.name.select && dom.name.select(); }

	function bind() {
		dom.form.addEventListener('submit', onSubmit);
		dom.resetBtn.addEventListener('click', () => { dom.form.reset(); clearFormExceptName(); focusName(); });
		dom.body.addEventListener('click', onBodyClick);
		dom.taxRate.addEventListener('input', () => { state.taxRatePct = toNumber(dom.taxRate.value, 0); render(); });
		dom.clearAllBtn.addEventListener('click', onClearAll);
		dom.shareBtn.addEventListener('click', onShare);
		dom.importBtn.addEventListener('click', onImport);
		dom.printBtn.addEventListener('click', () => window.print());
	}

	function onClearAll() {
		if (!confirm('Clear all items?')) return;
		state.items = [];
		render();
	}

	function onShare() {
		const data = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
		const url = `${location.origin}${location.pathname}?data=${data}`;
		navigator.clipboard.writeText(url).then(() => {
			alert('Shareable link copied to clipboard');
		}).catch(() => {
			prompt('Copy this URL', url);
		});
	}

	function onImport() {
		const input = prompt('Paste data or URL');
		if (!input) return;
		try {
			let json;
			const url = new URL(input, location.href);
			const qp = url.searchParams.get('data');
			if (qp) {
				json = decodeURIComponent(escape(atob(decodeURIComponent(qp))));
			} else {
				json = input;
			}
			const parsed = JSON.parse(json);
			if (!parsed || !Array.isArray(parsed.items)) throw new Error('Invalid');
			state.items = parsed.items.map(sanitizeItem);
			state.taxRatePct = toNumber(parsed.taxRatePct, 0);
			dom.taxRate.value = String(state.taxRatePct);
			render();
			alert('Imported successfully');
		} catch {
			alert('Could not import data');
		}
	}

	function tryImportFromQuery() {
		try {
			const qp = new URL(location.href).searchParams.get('data');
			if (!qp) return false;
			const json = decodeURIComponent(escape(atob(decodeURIComponent(qp))));
			const parsed = JSON.parse(json);
			if (!parsed || !Array.isArray(parsed.items)) return false;
			state.items = parsed.items.map(sanitizeItem);
			state.taxRatePct = toNumber(parsed.taxRatePct, 0);
			dom.taxRate.value = String(state.taxRatePct);
			return true;
		} catch { return false; }
	}

	function init() {
		load();
		bind();
		if (!tryImportFromQuery()) {
			dom.taxRate.value = String(state.taxRatePct || 0);
		}
		render();
		focusName();
	}

	document.addEventListener('DOMContentLoaded', init);
})();
