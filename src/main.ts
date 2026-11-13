import './styles/base.css';
import './styles/home.css';
import { initNav } from './nav';
import { initScene } from './scene/scene';

/** Scales the masthead (your name + issue number) so it always spans the page width. */
function fitMasthead(): void {
  const row = document.querySelector<HTMLElement>('.masthead-row');
  const word = row?.querySelector<HTMLElement>('.masthead span');
  const issue = row?.querySelector<HTMLElement>('.issue');
  if (!row || !word || !issue) return;

  row.style.setProperty('--mast', '100px');
  const natural = word.getBoundingClientRect().width + issue.getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const size = (100 * (row.clientWidth - gap)) / natural;
  row.style.setProperty('--mast', `${Math.max(48, Math.min(460, size))}px`);
}

let queued = false;
const refit = (): void => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; fitMasthead(); });
};

fitMasthead();
void document.fonts.ready.then(fitMasthead);
window.addEventListener('resize', refit);

initNav();

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement) || !initScene(canvas, document.getElementById('hint'))) {
  document.documentElement.classList.add('no-gl');
}
