(() => {
  const routeInput = document.getElementById('routeName');
  const dataList = document.getElementById('routeOptions');
  const btnSearch = document.getElementById('btn-search');
  const btnOpenMap = document.getElementById('btn-open-map');
  const result = document.getElementById('result');
  const routeTitle = document.getElementById('routeTitle');
  const routeSub = document.getElementById('routeSub');
  const routeList = document.getElementById('routeList');
  const routeEmpty = document.getElementById('routeEmpty');

  const apiBase = 'https://35.221.146.143.nip.io/linehook/TdxRouteInfo';
  const operator = '大都會客運';

  // 載入候選路線名（GroupBy RouteNameZh）
  async function loadNames(keyword = '') {
    const url = new URL(apiBase + '/names');
    url.searchParams.set('operatorNameZh', operator);
    if (keyword) url.searchParams.set('keyword', keyword);
    const resp = await fetch(url);
    if (!resp.ok) return;
    const json = await resp.json();
    // 支援 data 為陣列，或 data.items 為陣列
    const names = Array.isArray(json?.data)
      ? json.data
      : (json?.data?.items || []);
    dataList.innerHTML = '';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      dataList.appendChild(opt);
    });
  }

  // 查詢詳細
  async function queryDetail(name, operatorName = operator) {
    const url = new URL(location.origin + apiBase + '/detail');
    if (operatorName !== undefined && operatorName !== null) {
      url.searchParams.set('operatorNameZh', operatorName);
    }
    url.searchParams.set('name', name);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('查詢失敗');
    return await resp.json();
  }

  function renderDetail(payload, operatorLabelOverride) {
    const d = payload?.data || {};
    // 支援 Items/items
    const items = Array.isArray(d)
      ? d
      : (d.Items || d.items || []);
    // 支援大小寫差異的欄位
    routeTitle.textContent = d.RouteNameZh || d.routeNameZh || '—';
    const op = operatorLabelOverride || d.Operator || d.operator || operator;
    routeSub.textContent = `${op} · 共 ${items.length} 筆變化`;

  // 路線圖連結：優先使用第一筆的 RouteMapImageUrl；不預覽，只提供開新分頁
    const first = items[0];
    const firstMap = first?.RouteMapImageUrl || first?.routeMapImageUrl;
  btnOpenMap.dataset.href = firstMap || '';
  btnOpenMap.disabled = !firstMap;

    // 卡片列表
    routeList.innerHTML = '';
    items.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'route-card';
  // 不顯示方向資訊
      const city = (r.City || r.city || '').toString();
      const cityZh = city === 'Taipei' ? '台北市' : city === 'NewTaipei' ? '新北市' : city === 'InterCity' ? '國道公路' : (city || '');
      // 時間格式化：0510 -> 05:10
      const fmt = (t) => {
        if (!t || typeof t !== 'string') return '—';
        const s = t.trim();
        if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2)}`;
        return s;
      };

      const dep = r.DepartureStopNameZh || r.departureStopNameZh || '—';
      const des = r.DestinationStopNameZh || r.destinationStopNameZh || '—';

      const s0F = fmt(r.SubRoute0FirstBusTime ?? r.subRoute0FirstBusTime);
      const s0L = fmt(r.SubRoute0LastBusTime ?? r.subRoute0LastBusTime);
      const s0HF = fmt(r.SubRoute0HolidayFirstBusTime ?? r.subRoute0HolidayFirstBusTime);
      const s0HL = fmt(r.SubRoute0HolidayLastBusTime ?? r.subRoute0HolidayLastBusTime);

      const s1F = fmt(r.SubRoute1FirstBusTime ?? r.subRoute1FirstBusTime);
      const s1L = fmt(r.SubRoute1LastBusTime ?? r.subRoute1LastBusTime);
      const s1HF = fmt(r.SubRoute1HolidayFirstBusTime ?? r.subRoute1HolidayFirstBusTime);
      const s1HL = fmt(r.SubRoute1HolidayLastBusTime ?? r.subRoute1HolidayLastBusTime);

      const ticket = r.TicketPriceDescriptionZh || r.ticketPriceDescriptionZh || '—';

      // 單列整合摘要：起迄 | 去: 首/末（假日 首/末）| 返: 首/末（假日 首/末）
      const metaLineStartEnd = `起迄：${dep} → ${des}`;
      const metaLineGo = `去：首 ${s0F} / 末 ${s0L}（假日 ${s0HF} / ${s0HL}）`;
      const metaLineBack = `返：首 ${s1F} / 末 ${s1L}（假日 ${s1HF} / ${s1HL}）`;

      card.innerHTML = `
        <h3>${r.RouteNameZh || r.routeNameZh} <span class="badge">${cityZh}</span></h3>
        <div class="meta">
          <div class="meta-line">${metaLineStartEnd}</div>
          <div class="meta-sep" aria-hidden="true"></div>
          <div class="meta-line">${metaLineGo}</div>
          <div class="meta-sep" aria-hidden="true"></div>
          <div class="meta-line">${metaLineBack}</div>
          <div class="meta-line muted">收費方式：${ticket}</div>
        </div>
      `;
      routeList.appendChild(card);
    });
    // 空狀態
    if (!items || items.length === 0) {
      routeEmpty.classList.remove('hidden');
      btnOpenMap.disabled = true;
    } else {
      routeEmpty.classList.add('hidden');
    }

    result.classList.remove('hidden');
  }

  // 事件
  routeInput.addEventListener('input', (e) => {
    const kw = e.target.value.trim();
    // 輕量 debounce
    clearTimeout(routeInput._t);
    routeInput._t = setTimeout(() => loadNames(kw), 200);
  });

  btnSearch.addEventListener('click', async () => {
    const name = routeInput.value.trim();
    if (!name) return;
    try {
      // 查詢前重置
  btnOpenMap.disabled = true;
  btnOpenMap.dataset.href = '';
      routeList.innerHTML = '';
      routeEmpty.classList.add('hidden');
      let data = await queryDetail(name, operator);
      // 若以大都會客運查無資料，自動放寬為不限營運商再查一次
      const items = (data?.data?.Items || data?.data?.items || []);
      if (!items || items.length === 0) {
        data = await queryDetail(name, '');
        renderDetail(data, '不限營運商');
      } else {
        renderDetail(data);
      }
    } catch {}
  });

  // 開啟路線圖（新分頁）
  btnOpenMap.addEventListener('click', () => {
    const href = btnOpenMap.dataset.href;
    if (!href) return;
    window.open(href, '_blank', 'noopener');
  });

  // 初始載入
  loadNames();
})();


