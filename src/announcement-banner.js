(function () {
	var banner = document.getElementById('site-announcement');
	if (!banner) return;

	var v = banner.getAttribute('data-announcement-version');
	if (v == null || v === '') v = '1';

	var slot = banner.getAttribute('data-announcement-id');
	if (slot == null || slot === '') slot = 'default';

	var key = 'docutron.announcement.dismissedVersion.' + slot;
	var btn = banner.querySelector('.announcement-dismiss');

	try {
		if (localStorage.getItem(key) === String(v)) {
			banner.hidden = true;
		}
	} catch (e) {}

	if (!btn) return;
	btn.addEventListener('click', function () {
		banner.hidden = true;
		try {
			localStorage.setItem(key, String(v));
		} catch (e) {}
	});
})();
