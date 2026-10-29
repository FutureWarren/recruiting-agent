// Local design previews must never emit analytics, email or account writes.
// This guard is loaded only by the two /preview/ pages, never by the live site.
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || input, location.href);
    const method = (options.method || request?.method || 'GET').toUpperCase();
    if (url.origin !== location.origin && !['GET', 'HEAD'].includes(method)) {
      return Promise.resolve(new Response(JSON.stringify({ error:'This is a design preview. No email was sent.' }), { status:403, headers:{'Content-Type':'application/json'} }));
    }
    return originalFetch(input, options);
  };
})();
