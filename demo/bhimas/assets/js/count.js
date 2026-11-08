/* Cookieless visit count (GoatCounter, no cookies, no personal data), the same on every demo page.
   Not loaded inside the preview frame or with ?embed=1, so our own look at /apercu/ never lands in
   the venue's numbers. */
(function () {
  if (window.top !== window.self || /[?&]embed=1/.test(location.search)) return;
  var g = document.createElement('script');
  g.async = true; g.src = '//gc.zgo.at/count.js';
  g.setAttribute('data-goatcounter', 'https://webwerklu.goatcounter.com/count');
  document.body.appendChild(g);
})();
