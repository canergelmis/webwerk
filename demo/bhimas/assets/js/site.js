// Bhimas: one motion idea per screen. The CSS holds the moves; this only triggers them.
const root = document.documentElement;
const anim = root.classList.contains('anim');
const reduced = root.classList.contains('reduced');

// add .in once a section enters (stills paste up, tickets slide in)
function onEnter(el, threshold) {
  if (!el) return;
  if (anim && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); }
    }, { threshold });
    io.observe(el);
  } else {
    el.classList.add('in');
  }
}
onEnter(document.querySelector('.stills'), 0.3);
onEnter(document.querySelector('.tickets'), 0.25);
onEnter(document.querySelector('.hall'), 0.15);

// the gada banner drifts while it is pinned: the painting moves slower than the page
const gada = document.querySelector('.gada');
const move = document.querySelector('.gada__move');
if (gada && move && !reduced) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = gada.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    const p = Math.min(1, Math.max(0, -r.top / span));
    move.style.setProperty('--p', p.toFixed(4));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

// the dish line: hide a separator that ends up at the end of a wrapped line
const list = document.querySelector('.board__list');
if (list) {
  const seps = [...list.querySelectorAll('i')];
  const tidy = () => {
    for (const i of seps) i.classList.remove('eol');
    for (const i of seps) {
      const next = i.nextElementSibling;
      if (next && next.offsetTop > i.offsetTop + 4) i.classList.add('eol');
    }
  };
  tidy();
  addEventListener('resize', tidy);
  document.fonts && document.fonts.ready.then(tidy);
}

// Home: the gada lifts once and settles. Two layers over the unchanged banner, removed afterwards.
(function () {
  if (!document.documentElement.classList.contains('anim') || !document.body.classList.contains('pg-home')) return;
  var push = document.querySelector('.hero__push');
  if (!push) return;
  var k = window.matchMedia('(min-width: 820px)').matches ? 'd' : 'm';
  var started = performance.now();
  function make(name, cls) {
    var i = new Image();
    i.alt = '';
    i.className = 'lift ' + cls;
    i.src = 'assets/img/' + name + '-' + k + '.webp';
    return i;
  }
  var patch = make('gada-patch', 'lift--patch');
  var gada = make('gada-lift', 'lift--gada');
  Promise.all([patch.decode(), gada.decode()]).then(function () {
    if (performance.now() - started > 1800) return;
    var rays = push.querySelector('.rays');
    push.insertBefore(patch, rays);
    push.insertBefore(gada, rays);
    gada.addEventListener('animationend', function () { patch.remove(); gada.remove(); });
  }).catch(function () {});
})();

