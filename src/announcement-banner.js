// Bump data-announcement-version on #site-announcement in each HTML page when the message changes so the bar shows again.
(function () {
	var banner = document.getElementById('site-announcement');
	if (!banner) return;

	var v = banner.getAttribute('data-announcement-version');
	if (v == null || v === '') v = '1';

	var key = 'docutron.announcement.dismissedVersion';
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
