/** Fixed top-right nav: smooth-scroll to sections and highlight the current one. */
export function initNav(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav a'));
  // add an id here (and a link in index.html) to give the nav another section
  const sections = ['work', 'about'];

  function go(id: string, smooth: boolean): void {
    const el = document.getElementById(id);
    if (!el) return;
    const y = id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY - 40;
    window.scrollTo({ top: y, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(a.dataset.t ?? 'top', true);
    });
  });

  function spy(): void {
    let current = 'top';
    const line = window.innerHeight * 0.4;
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= line) current = id;
    }
    links.forEach((a) => a.classList.toggle('on', a.dataset.t === current));
  }

  window.addEventListener('scroll', spy, { passive: true });
  spy();

  // landing on /#work from a project page
  const hash = location.hash.replace('#', '');
  if (hash && hash !== 'top') setTimeout(() => go(hash, false), 60);
}
