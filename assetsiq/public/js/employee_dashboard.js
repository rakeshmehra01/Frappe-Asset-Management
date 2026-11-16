/* My Workspace: personal data only; native APIs enforce record permissions. */
frappe.assetsiq_employee_dashboard = function (root) {
    const dashboard = root.querySelector('.aiq-employee');
    if (!dashboard || dashboard.dataset.employeeReady === '1') return;
    dashboard.dataset.employeeReady = '1';

    const user = frappe.session.user;
    const activeStates = ['Assignment Requested', 'Assigned', 'Maintenance Requested', 'Under Maintenance'];
    const modes = [
        ['all', 'All my equipment', null], ['pending', 'Awaiting acceptance', 'Assignment Requested'],
        ['assigned', 'Assigned', 'Assigned'], ['requested', 'Maintenance requests', 'Maintenance Requested'],
        ['maintenance', 'Under maintenance', 'Under Maintenance'],
    ];
    const region = name => dashboard.querySelector(`[data-region="${name}"]`);
    const escape = value => frappe.utils.escape_html(String(value ?? ''));
    const format = value => Number(value || 0).toLocaleString();
    const search = dashboard.querySelector('input[type="search"]');
    const refreshButton = dashboard.querySelector('[data-action="refresh"]');
    const state = {mode: 'all', start: 0, size: 5, total: 0, queueSeq: 0, summarySeq: 0};
    let timer;
    let lastRoute = JSON.stringify(frappe.get_route());

    function personalFilters(status) {
        return {assigned_to: user, asset_status: status || ['in', activeStates]};
    }
    function api(args) {
        return frappe.xcall('frappe.client.get_list', {doctype: 'Asset', ...args});
    }
    function list(status) {
        frappe.route_options = personalFilters(status);
        frappe.set_route('List', 'Asset', 'List');
    }
    function badge(status) {
        const tone = {'Assigned': 'blue', 'Assignment Requested': 'amber',
            'Maintenance Requested': 'violet', 'Under Maintenance': 'violet'}[status] || 'slate';
        return `<span class="ops-status ops-status-${tone}">${escape(status)}</span>`;
    }
    function renderFilters() {
        region('tabs').innerHTML = modes.map(([key, label]) => `<button type="button" class="aiq-button" data-action="filter" data-filter="${key}" aria-pressed="${key === state.mode}">${escape(label)}</button>`).join('');
    }
    function selectMode(key) {
        if (!modes.some(mode => mode[0] === key)) return;
        state.mode = key;
        state.start = 0;
        region('tabs').querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.filter === key));
        });
        loadQueue();
    }
    function renderRows(rows, total) {
        state.total = total;
        const panel = region('queue');
        if (!rows.length) {
            panel.textContent = search.value.trim() ? 'No matching equipment. Try another search or status.'
                : state.mode === 'pending' ? 'No assignments are waiting for your acceptance.'
                : state.mode === 'all' ? 'No equipment or assignment requests have been assigned to your account yet.'
                : 'No equipment in this status.';
        } else {
            panel.innerHTML = `<div class="ops-table-scroll" tabindex="0" role="region" aria-label="Your equipment table"><table class="table table-hover ops-table"><caption class="ops-visually-hidden">Your equipment in the selected status</caption><thead><tr><th scope="col">Asset</th><th scope="col">Category</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>${rows.map(row => `<tr>
                <td><span class="ops-table-cell" title="${escape(row.asset_name || row.name)}">${escape(row.asset_name || row.name)}</span><small>${escape(row.name)}</small></td>
                <td><span class="ops-table-cell" title="${escape(row.asset_category)}">${escape(row.asset_category || '—')}</span></td>
                <td><span class="ops-table-cell" title="${escape(row.location_label || row.asset_location)}">${escape(row.location_label || row.asset_location || '—')}</span></td>
                <td>${badge(row.asset_status)}</td><td><button type="button" class="aiq-button" data-action="review" data-asset="${escape(row.name)}" aria-label="Review ${escape(row.asset_name || row.name)}">${row.asset_status === 'Assignment Requested' ? 'Review request' : 'Open'}</button></td>
            </tr>`).join('')}</tbody></table></div>`;
        }
        const from = total ? state.start + 1 : 0;
        const to = Math.min(state.start + rows.length, total);
        region('pagination').innerHTML = `<span role="status">${format(from)}–${format(to)} of ${format(total)} matches</span><div class="ops-pagination-actions"><button type="button" class="aiq-button" data-action="previous" aria-label="Previous page"${state.start === 0 ? ' disabled' : ''}>←</button><button type="button" class="aiq-button" data-action="next" aria-label="Next page"${to >= total ? ' disabled' : ''}>→</button></div>`;
    }
    async function loadQueue() {
        clearTimeout(timer);
        const seq = ++state.queueSeq;
        const text = search.value.trim().slice(0, 160);
        const status = modes.find(mode => mode[0] === state.mode)[2];
        const filters = personalFilters(status);
        const orFilters = text ? ['name', 'asset_name', 'serial_number'].map(field => [field, 'like', `%${text}%`]) : [];
        dashboard.querySelector('[data-action="clear-search"]').hidden = !text;
        region('queue').setAttribute('aria-busy', 'true');
        region('queue').textContent = 'Loading your equipment…';
        region('pagination').textContent = '';
        try {
            const [rows, count] = await Promise.all([
                api({fields: ['name', 'asset_name', 'asset_category', 'asset_status', 'assigned_to', 'asset_location', 'asset_location.location_name as location_label'],
                    filters, or_filters: orFilters, order_by: 'modified desc, name desc', limit_start: state.start, limit_page_length: state.size}),
                api({fields: [{COUNT: '*', as: 'total'}], filters, or_filters: orFilters, order_by: '', limit_page_length: 1}),
            ]);
            if (seq !== state.queueSeq || !root.host.isConnected) return;
            const total = Number(count[0]?.total || 0);
            if (state.start && state.start >= total) {
                state.start = total ? Math.floor((total - 1) / state.size) * state.size : 0;
                return loadQueue();
            }
            renderRows(rows, total);
        } catch (error) {
            if (seq !== state.queueSeq || !root.host.isConnected) return;
            region('queue').textContent = 'Could not load your equipment. Select Refresh to try again.';
        } finally {
            if (seq === state.queueSeq) region('queue').setAttribute('aria-busy', 'false');
        }
    }
    async function loadSummary() {
        const seq = ++state.summarySeq;
        const filters = personalFilters();
        refreshButton.disabled = true;
        region('message').hidden = true;
        try {
            const [groups, categories, recent] = await Promise.all([
                api({fields: ['asset_status', {COUNT: '*', as: 'total'}], filters, group_by: 'asset_status', order_by: '', limit_page_length: 0}),
                api({fields: ['asset_category', {COUNT: '*', as: 'total'}], filters, group_by: 'asset_category', order_by: 'total desc, asset_category asc', limit_page_length: 0}),
                api({fields: ['name', 'asset_name', 'asset_status', 'modified'], filters, order_by: 'modified desc, name desc', limit_page_length: 3}),
            ]);
            if (seq !== state.summarySeq || !root.host.isConnected) return;
            const counts = Object.create(null);
            groups.forEach(row => counts[row.asset_status] = Number(row.total || 0));
            const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
            const values = {total, assigned: counts.Assigned || 0, pending: counts['Assignment Requested'] || 0,
                requested: counts['Maintenance Requested'] || 0, maintenance: counts['Under Maintenance'] || 0};
            dashboard.querySelectorAll('[data-kpi]').forEach(element => element.textContent = format(values[element.dataset.kpi]));
            region('kpis').setAttribute('aria-busy', 'false');
            region('mix').innerHTML = categories.length ? `<ul class="ops-category-bars">${categories.slice(0, 5).map(row => {
                const share = total ? Math.max(0, Math.min(100, 100 * Number(row.total) / total)) : 0;
                return `<li><span class="ops-table-cell" title="${escape(row.asset_category)}">${escape(row.asset_category || 'Uncategorised')}</span><span class="ops-category-track" aria-hidden="true"><span style="width:${share.toFixed(2)}%"></span></span><strong>${format(row.total)}</strong></li>`;
            }).join('')}</ul>${categories.length > 5 ? '<p class="ops-detail-note">Showing your five largest categories.</p>' : ''}` : '<p>You have no equipment or requests to summarise yet.</p>';
            region('mix').setAttribute('aria-busy', 'false');
            region('recent').innerHTML = recent.length ? `<ul class="ops-personal-updates">${recent.map(row => {
                const time = frappe.datetime?.comment_when?.(row.modified);
                const label = time ? String(time).replace(/<[^>]*>/g, '') : String(row.modified || '');
                return `<li><button type="button" data-action="review" data-asset="${escape(row.name)}"><span class="ops-update-title"><strong>${escape(row.asset_name || row.name)}</strong><small>${escape(row.name)}</small></span>${badge(row.asset_status)}<time title="${escape(row.modified)}">${escape(label)}</time></button></li>`;
            }).join('')}</ul>` : '<p>No equipment updates yet.</p>';
            region('recent').setAttribute('aria-busy', 'false');
            region('updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        } catch (error) {
            if (seq !== state.summarySeq || !root.host.isConnected) return;
            region('message').textContent = 'Could not refresh your summary. Select Refresh to try again; any previously loaded figures may be out of date.';
            region('message').hidden = false;
            ['kpis', 'mix', 'recent'].forEach(name => region(name).setAttribute('aria-busy', 'false'));
            if (!dashboard.querySelector('[data-kpi="total"]').textContent.match(/\d/)) {
                region('mix').textContent = 'Category summary unavailable.';
                region('recent').textContent = 'Recent updates unavailable.';
                region('updated').textContent = 'Summary unavailable';
            }
        } finally {
            if (seq === state.summarySeq) refreshButton.disabled = false;
        }
    }
    function refresh() { return Promise.all([loadSummary(), loadQueue()]); }
    dashboard.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button || button.disabled) return;
        switch (button.dataset.action) {
            case 'refresh': refresh(); break;
            case 'my-assets': list(); break;
            case 'maintenance-list': list(['in', ['Maintenance Requested', 'Under Maintenance']]); break;
            case 'filter': selectMode(button.dataset.filter); break;
            case 'clear-search': search.value = ''; state.start = 0; loadQueue(); search.focus(); break;
            case 'review': frappe.set_route('Form', 'Asset', button.dataset.asset); break;
            case 'previous': state.start = Math.max(0, state.start - state.size); loadQueue(); break;
            case 'next': if (state.start + state.size < state.total) {state.start += state.size; loadQueue();} break;
        }
    });
    dashboard.querySelector('.ops-search').addEventListener('submit', event => {event.preventDefault(); state.start = 0; loadQueue();});
    ['keydown', 'keypress', 'keyup'].forEach(type => search.addEventListener(type, event => event.stopPropagation()));
    search.addEventListener('input', () => {
        clearTimeout(timer);
        ++state.queueSeq;
        state.start = 0;
        region('queue').textContent = 'Searching your equipment…';
        region('queue').setAttribute('aria-busy', 'true');
        region('pagination').textContent = '';
        dashboard.querySelector('[data-action="clear-search"]').hidden = !search.value;
        timer = setTimeout(loadQueue, 300);
    });
    $(document).off('page-change.assetsiq-employee-dashboard').on('page-change.assetsiq-employee-dashboard', () => {
        const route = frappe.get_route();
        const signature = JSON.stringify(route);
        if (signature === lastRoute) return;
        lastRoute = signature;
        if (root.host.isConnected && route[0] === 'Workspaces'
            && ['assetsiq — my workspace', frappe.router.slug('AssetsIQ — My Workspace'), 'my workspace', 'my-workspace'].includes(String(route[1] || '').toLowerCase())) refresh();
    });
    renderFilters();
    const ready = refresh();
    root.assetsiqEmployeeDashboard = {state, refresh, loadQueue, ready};
    return ready;
};
