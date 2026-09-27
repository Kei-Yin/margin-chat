(() => {
  function locate(text, anchor) {
    if (!anchor.quote) return null;
    const hits = [];
    for (let p = text.indexOf(anchor.quote); p >= 0; p = text.indexOf(anchor.quote, p + 1)) {
      const before = text.slice(Math.max(0, p - anchor.prefix.length), p);
      const after = text.slice(p + anchor.quote.length, p + anchor.quote.length + anchor.suffix.length);
      const score = (anchor.prefix && before === anchor.prefix ? 1 : 0) + (anchor.suffix && after === anchor.suffix ? 1 : 0);
      hits.push({start: p, end: p + anchor.quote.length, score});
    }
    hits.sort((a,b) => b.score - a.score);
    if (!hits.length || (hits.length > 1 && hits[0].score === hits[1].score)) return null;
    return hits[0];
  }
  function makeAnchor(text, start, end) {
    return {quote: text.slice(start,end), prefix: text.slice(Math.max(0,start-48),start), suffix: text.slice(end,end+48)};
  }
  function responseText(data) {
    return (data.output || []).filter(x => x.type === 'message').flatMap(x => x.content || [])
      .filter(x => x.type === 'output_text').map(x => x.text).join('\n');
  }
  globalThis.MarginCore = {locate, makeAnchor, responseText};
})();
