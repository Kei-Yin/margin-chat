// Reproduce a host UI consuming bubble-phase events. Capture/selectionchange must still work.
for (const article of document.querySelectorAll('article')) {
  for (const type of ['mouseup','pointerup']) article.addEventListener(type,e=>e.stopPropagation());
}
