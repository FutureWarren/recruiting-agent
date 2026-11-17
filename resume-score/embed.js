'use strict';
/* Same-origin parent is allowed to resize this embedded Resume Evaluation.
 * No resume contents, report, score, token, email or analytics are posted out.
 */
(() => {
  if (!document.documentElement.classList.contains('resume-embedded')) return;
  if (window.parent === window) return;
  const main = document.getElementById('page-content');
  if (!main) return;
  let queued = false;
  const measure = () => {
    queued = false;
    const height = Math.ceil(Math.max(main.getBoundingClientRect().height,main.scrollHeight)) + 6;
    if (height > 0) window.parent.postMessage({type:'orbit:resume-embed-height',height},location.origin);
  };
  const queue = () => { if (!queued) { queued = true;requestAnimationFrame(measure); } };
  const resize = new ResizeObserver(queue);
  resize.observe(main);
  const changes = new MutationObserver(queue);
  changes.observe(main,{subtree:true,childList:true,attributes:true,characterData:true,
    attributeFilter:['hidden','class','style','aria-expanded']});
  window.addEventListener('load',queue);
  window.addEventListener('resize',queue);
  document.fonts?.ready?.then(queue).catch(()=>{});
  queue();
})();
