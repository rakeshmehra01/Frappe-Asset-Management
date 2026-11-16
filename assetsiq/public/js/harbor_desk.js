// AssetsIQ branding is a scoped enhancement of native Desk navigation.
// It never changes routes, document names, menu permissions, or click handlers.
(() => {
	const workspace_labels = new Map([
		["AssetsIQ — IT Operations", "IT Operations"],
		["AssetsIQ — My Workspace", "My Workspace"],
	]);
	let pending = false;
	let observer;

	function is_assetsiq_route() {
		const route = frappe.get_route();
		if (route[0] === "assetsiq-home") return true;
		// Boot metadata discovers current and future screens from this app's modules.
		const screens = frappe.boot?.assetsiq_routes || {};
		const name = route[1] || "";
		if (["Form", "List", "Tree"].includes(route[0])) {
			return (screens.doctypes || []).includes(name);
		}
		if (route[0] === "query-report") return (screens.reports || []).includes(name);
		if (route[0] === "Workspaces") {
			return (screens.workspaces || []).some(workspace =>
				[workspace.toLowerCase(), frappe.router.slug(workspace)].includes(name.toLowerCase())
			);
		}
		// Native custom Desk Pages route by their page name in the first segment.
		return (screens.pages || []).includes(route[0]);
	}

	function set_label(element, text) {
		if (!element) return;
		if (!element.dataset.aiqOriginalLabel) element.dataset.aiqOriginalLabel = element.textContent;
		if (element.textContent !== text) element.textContent = text;
	}

	function update_branding() {
		pending = false;
		observe_sidebar();
		const active = is_assetsiq_route();
		document.body.classList.toggle("aiq-assetsiq-shell", active);
		const sidebar = document.querySelector(".body-sidebar");
		if (!sidebar) return;
		if (!active) {
			sidebar.querySelectorAll("[data-aiq-original-label]").forEach(element => {
				const original = element.dataset.aiqOriginalLabel;
				if (element.textContent !== original) element.textContent = original;
				delete element.dataset.aiqOriginalLabel;
			});
			return;
		}

		const header = sidebar.querySelector(".sidebar-header");
		const icon = header?.querySelector(".sidebar-item-icon");
		if (icon && !icon.querySelector(".aiq-brand-logo")) {
			const logo = document.createElement("img");
			logo.src = "/assets/assetsiq/images/assetsiq-mark.svg?v=violet-1";
			logo.alt = ""; // The adjacent AssetsIQ text provides the accessible name.
			logo.width = 40;
			logo.height = 40;
			logo.className = "aiq-brand-logo";
			icon.append(logo);
		}
		set_label(header?.querySelector(".header-title"), "AssetsIQ");
		set_label(header?.querySelector(".header-subtitle"), __("Asset management"));
		sidebar.querySelectorAll(".sidebar-item-container .sidebar-item-label").forEach(element => {
			const original = (element.dataset.aiqOriginalLabel || element.textContent).trim();
			if (workspace_labels.has(original)) set_label(element, __(workspace_labels.get(original)));
		});
	}

	function schedule_branding() {
		if (pending) return;
		pending = true;
		requestAnimationFrame(update_branding);
	}

	function observe_sidebar() {
		const host = document.querySelector(".body-sidebar-container");
		if (!host || observer) return;
		observer = new MutationObserver(schedule_branding);
		observer.observe(host, { childList: true, subtree: true });
	}

	$(document).on("page-change.assetsiq-harbor", schedule_branding);
	$(document).on("app_ready.assetsiq-harbor", schedule_branding);
	frappe.router.on("change", schedule_branding);
	frappe.after_ajax(() => {
		// Sidebar sections can finish rendering after the route event. Observe
		// child changes only, rather than polling or overriding Frappe methods.
		observe_sidebar();
		schedule_branding();
	});
})();
