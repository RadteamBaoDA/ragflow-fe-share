
// This worker handles sending history data to the external API

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, config } = e.data;

  if (!type || !payload) {
    console.error('External History Worker: Missing type or payload');
    return;
  }

  const { baseURL, apiKey } = config || {};

  // Use provided baseURL or default to relative path if not provided (though in worker fetch needs absolute usually if on different origin, but same origin is fine)
  // Actually, for relative paths to work in worker, we rely on the origin of the page.
  // But let's assume baseURL is passed or we construct it.

  let endpoint = '';

  if (type === 'chat') {
    endpoint = '/api/external/history/chat';
  } else if (type === 'search') {
    endpoint = '/api/external/history/search';
  } else {
    console.error('External History Worker: Unknown type', type);
    return;
  }

  const url = baseURL ? `${baseURL.replace(/\/$/, '')}${endpoint}` : endpoint;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        // Just log, don't fail hard as this is background
        console.warn(`External History Worker: Failed to send ${type} history. Status: ${response.status}`);
        const text = await response.text();
        console.warn('Response:', text);
    } else {
         // Success
        // const data = await response.json();
        // console.log('External History Worker: Success', data);
    }

  } catch (error) {
    console.error(`External History Worker: Network error sending ${type} history`, error);
  }
};
