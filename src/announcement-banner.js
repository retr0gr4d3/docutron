(function () {
	var banner = document.getElementById('site-announcement');
	if (!banner) return;

	var v = banner.getAttribute('data-announcement-version');
	if (v == null || v === '') v = '1';

	var id = banner.getAttribute('data-announcement-id');
	if (id == null || id === '') id = 'default';

	var key = 'docutron.announcement.dismissedVersion.' + id;
	var btn = banner.querySelector('.announcement-dismiss');

	try {
		if (localStorage.getItem(key) === String(v)) {
			banner.hidden = true;
		}
	} catch {}

	if (!btn) return;
	btn.addEventListener('click', function () {
		banner.hidden = true;
		try {
			localStorage.setItem(key, String(v));
		} catch {}
	});
})();
