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
  //const apiBase = 'http://localhost:5000/api/TdxRouteInfo';
  // 多業者查詢示範：可自行增減或用 UI 動態產生
  const operators = ['大都會客運', '三重客運','臺北客運','首都客運','大南客運','欣欣客運'];
  const buildOperatorNames = () => operators.filter(Boolean).join(',');

  // 防止一聚焦就跳出 datalist：先暫時移除 list 屬性，輸入後再恢復
  const originalListId = routeInput.getAttribute('list') || 'routeOptions';
  routeInput.dataset.listBackup = originalListId;
  // 關閉瀏覽器自動完成/拼字修正，避免非預期的建議
  routeInput.setAttribute('autocomplete', 'off');
  routeInput.setAttribute('autocapitalize', 'off');
  routeInput.setAttribute('spellcheck', 'false');
  routeInput.addEventListener('focus', () => {
    // 清空候選並移除 list，避免一聚焦就彈出
    dataList.innerHTML = '';
    routeInput.removeAttribute('list');
  });

  // 載入候選路線名（GroupBy RouteNameZh）
  async function loadNames(keyword = '') {
    const kw = (keyword || '').trim();
    // 無輸入時不要顯示任何候選，避免一點進輸入框就彈出選單
    if (!kw) {
      dataList.innerHTML = '';
      return;
    }
  const url = new URL(apiBase + '/names');
  const opsParam = buildOperatorNames();
  if (opsParam) url.searchParams.set('operatorNames', opsParam);
    url.searchParams.set('keyword', kw);
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
  async function queryDetail(name, operatorList = operators) {
    const url = new URL(apiBase + '/detail');
    if (Array.isArray(operatorList) && operatorList.length > 0) {
      url.searchParams.set('operatorNames', operatorList.join(','));
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
      : (d.items || []);
    // 支援大小寫差異的欄位
    routeTitle.textContent =d.routeNameZh || '';
      // 依實際回傳的每筆路線項目中的 operatorNameZh 動態彙總顯示（優先）
      const opArrRaw = d.Operators || d.operators || null; // 後端回傳的 operators 陣列（可能為 null）
      const operatorsInResult = Array.from(new Set(
        (items || [])
          .map(r => r.operatorNameZh || r.operatornamezh || '')
          .filter(Boolean)
      ));
      const opLabel = operatorLabelOverride
        || (operatorsInResult.length > 0 ? operatorsInResult.join(',')
            : (Array.isArray(opArrRaw) && opArrRaw.length > 0 ? opArrRaw.join(',') : '全部業者'));


  // 路線圖連結：優先使用第一筆的 RouteMapImageUrl；不預覽，只提供開新分頁
    const first = items[0];
    const firstMap = first?.routeMapImageUrl;
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
      // 後端已移除 SubRoute* 時間欄位；若不存在則不顯示去返時間
      const s0F_raw = r.SubRoute0FirstBusTime ?? r.subRoute0FirstBusTime;
      const s0L_raw = r.SubRoute0LastBusTime ?? r.subRoute0LastBusTime;
      const s0HF_raw = r.SubRoute0HolidayFirstBusTime ?? r.subRoute0HolidayFirstBusTime;
      const s0HL_raw = r.SubRoute0HolidayLastBusTime ?? r.subRoute0HolidayLastBusTime;
      const s1F_raw = r.SubRoute1FirstBusTime ?? r.subRoute1FirstBusTime;
      const s1L_raw = r.SubRoute1LastBusTime ?? r.subRoute1LastBusTime;
      const s1HF_raw = r.SubRoute1HolidayFirstBusTime ?? r.subRoute1HolidayFirstBusTime;
      const s1HL_raw = r.SubRoute1HolidayLastBusTime ?? r.subRoute1HolidayLastBusTime;
      const hasTime = [s0F_raw, s0L_raw, s0HF_raw, s0HL_raw, s1F_raw, s1L_raw, s1HF_raw, s1HL_raw].some(v => !!v);
      const s0F = fmt(s0F_raw), s0L = fmt(s0L_raw), s0HF = fmt(s0HF_raw), s0HL = fmt(s0HL_raw);
      const s1F = fmt(s1F_raw), s1L = fmt(s1L_raw), s1HF = fmt(s1HF_raw), s1HL = fmt(s1HL_raw);

      const ticket = r.TicketPriceDescriptionZh || r.ticketPriceDescriptionZh || '—';

      // 單列整合摘要：起迄 | 去: 首/末（假日 首/末）| 返: 首/末（假日 首/末）
      const metaLineStartEnd = `起迄：${dep} → ${des}`;
      const metaLineGo = `去：首 ${s0F} / 末 ${s0L}（假日 ${s0HF} / ${s0HL}）`;
      const metaLineBack = `返：首 ${s1F} / 末 ${s1L}（假日 ${s1HF} / ${s1HL}）`;

      card.innerHTML = `
        <h3>${r.RouteNameZh || r.routeNameZh} <span class="badge">${cityZh}</span></h3>
        <div class="meta">
          <div class="meta-line">${metaLineStartEnd}</div>
          ${hasTime ? `<div class="meta-sep" aria-hidden="true"></div>` : ''}
          ${hasTime ? `<div class="meta-line">${metaLineGo}</div>` : ''}
          ${hasTime ? `<div class="meta-sep" aria-hidden="true"></div>` : ''}
          ${hasTime ? `<div class="meta-line">${metaLineBack}</div>` : ''}
          <div class="meta-line muted">收費方式：${ticket}</div>
        </div>
      `;
      routeList.appendChild(card);

      // 追加 PrimaryInfos 卡片（依序接在該路線之後）
      const infos = r.PrimaryInfos || r.primaryInfos || [];
      if (Array.isArray(infos) && infos.length > 0) {
        infos.forEach((p) => {
          const itemName = p.ItemName || p.itemName || '';
          const contextName = p.ContextName || p.contextName || '';
          if (!itemName && !contextName) return;
          const infoCard = document.createElement('div');
          infoCard.className = 'route-card info-card';
          infoCard.innerHTML = `
            <h4>${itemName}</h4>
            <div class="meta">
              <div class="meta-line">${contextName || '—'}</div>
            </div>
          `;
          routeList.appendChild(infoCard);
        });
      }
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
    // 當使用者開始輸入內容時，恢復 list 讓 datalist 正常運作
    if (kw && !routeInput.getAttribute('list')) {
      const listId = routeInput.dataset.listBackup;
      if (listId) routeInput.setAttribute('list', listId);
    }
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
      let data = await queryDetail(name, operators);
      // 若以指定多業者查無資料，自動放寬為不限營運商再查一次（不帶 operatorNames）
      const items = (data?.data?.Items || data?.data?.items || []);
      if (!items || items.length === 0) {
        data = await queryDetail(name, []);
        renderDetail(data, '查無符合名稱(指定業者)');
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

  // 初始不載入任何候選，避免一聚焦就出現下拉
})();
