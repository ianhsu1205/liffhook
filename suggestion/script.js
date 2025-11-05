(() => {
  // 全局變數
  const base_url = (() => {
    // 檢查是否為本地開發環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.origin + '/';
    }
    // 生產環境使用指定的後端地址
    return 'https://35.221.146.143.nip.io/linehook/';
  })();

  const API_URL = base_url + 'api/SuggestionProxy/proxy';
  const LIFF_ID = (new URL(location.href).searchParams.get('liffId') || window.SUGGESTION_LIFF_ID || ''); // 可在部署時以環境注入，或以 ?liffId= 帶入

  const $ = (id) => document.getElementById(id);
  const form = $('form');
  const nameI = $('svr_name');
  const emailI = $('email');
  const telI = $('svr_tel');
  const dateI = $('svr_date');
  const detailI = $('svr_detail');
  const btn = $('btn-submit');
  const btnPreview = $('btn-preview');
  const btnConfirmSubmit = $('btn-confirm-submit');
  const btnClosePreview = $('btn-close-preview');
  const dlgPreview = $('dlg-preview');
  const pvName = $('pv_name');
  const pvEmail = $('pv_email');
  const pvTel = $('pv_tel');
  const pvDate = $('pv_date');
  const pvDetail = $('pv_detail');
  const dlgSuccess = $('dlg-success');
  const btnCloseSuccess = $('btn-close-success');
  const countdownEl = $('countdown');
  const msg = $('msg');

  // 驗證碼相關元素
  const captchaImage = $('captchaImage');
  const captchaInput = $('captcha_answer');
  const captchaToken = $('captcha_token');
  const refreshCaptchaBtn = $('refreshCaptcha');
  const devTools = $('devTools');
  const resetRateLimitBtn = $('resetRateLimitBtn');

  let liffReady = false;
  let userId = '';

  // emoji 過濾
  const isEmoji = (r) => (
    (r >= 0x1f300 && r <= 0x1f5ff) ||
    (r >= 0x1f600 && r <= 0x1f64f) ||
    (r >= 0x1f680 && r <= 0x1f6ff) ||
    (r >= 0x1f900 && r <= 0x1f9ff) ||
    (r >= 0x1fa70 && r <= 0x1faff) ||
    (r >= 0x2600 && r <= 0x27bf) ||
    r === 0x200d || r === 0xfe0f
  );
  const removeEmoji = (str) => {
    if (!str) return str;
    const out = [];
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (isEmoji(cp)) continue;
      out.push(ch);
    }
    return out.join('');
  };

  const showMsg = (text, ok=false) => {
    msg.classList.remove('hidden','ok','err');
    msg.textContent = text;
    msg.classList.add(ok ? 'ok' : 'err');
  };
  const hideMsg = () => { msg.classList.add('hidden'); };
  const markInvalid = (el, invalid=true) => {
    const field = el?.closest('.field');
    if (!field) return;
    field.classList.toggle('invalid', !!invalid);
  };
  const openModal = (el) => { el.classList.remove('hidden'); document.body.classList.add('modal-open'); };
  const closeModal = (el) => { el.classList.add('hidden'); document.body.classList.remove('modal-open'); };
  // 預覽流程：先做基本驗證，再顯示內容
  btnPreview.addEventListener('click', () => {
    hideMsg();
    const name = (nameI.value||'').trim();
    const email = (emailI.value||'').trim();
    const tel = (telI.value||'').trim();
    const detail = (detailI.value||'').trim();

    if (!name){ showMsg('稱呼為必填'); markInvalid(nameI, true); return; }
    markInvalid(nameI, false);
    if (!email){ showMsg('Email 為必填'); markInvalid(emailI, true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('Email 格式不正確'); markInvalid(emailI, true); return; }
    markInvalid(emailI, false);
    if (!detail){ showMsg('意見內容為必填'); markInvalid(detailI, true); return; }
    markInvalid(detailI, false);
    if (!dateI.value){ showMsg('發生時間為必填'); markInvalid(dateI, true); return; }
    markInvalid(dateI, false);

    // 驗證驗證碼
    const captchaAnswer = (captchaInput.value || '').trim();
    if (!captchaAnswer){ showMsg('請輸入驗證碼'); markInvalid(captchaInput, true); return; }
    if (!/^\d{4}$/.test(captchaAnswer)){ showMsg('驗證碼應為4位數字'); markInvalid(captchaInput, true); return; }
    markInvalid(captchaInput, false);

    // 填入預覽值
    pvName.textContent = name;
    pvEmail.textContent = email;
    pvTel.textContent = tel || '-';
    pvDate.textContent = (dateI.value||'').replace('T',' ');
    pvDetail.textContent = detail;

    openModal(dlgPreview);
  });

  btnClosePreview.addEventListener('click', () => closeModal(dlgPreview));

  function setNowIfEmpty(){
    if (!dateI.value) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2,'0');
      const val = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`+
                  `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      dateI.value = val;
    }
  }

  async function initLiff(){
    try{
      if (!LIFF_ID) return; // 若未設定，略過
      await liff.init({ liffId: LIFF_ID });
      liffReady = true;
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      userId = profile?.userId || '';
    }catch{
      // 忽略 LIFF 錯誤，允許純 Web 使用
    }
  }

  // 原送出按鈕：仍保留直接送出，但成功時顯示成功對話框
  btn.addEventListener('click', async () => {
    hideMsg();
    const name = (nameI.value||'').trim();
    const email = (emailI.value||'').trim();
    const detail = (detailI.value||'').trim();
    // 必填驗證：稱呼、Email、意見、發生時間
    if (!name){ showMsg('稱呼為必填'); markInvalid(nameI, true); return; }
    markInvalid(nameI, false);
    if (!email){ showMsg('Email 為必填'); markInvalid(emailI, true); return; }
    // 簡易 Email 格式檢查
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('Email 格式不正確'); markInvalid(emailI, true); return; }
    markInvalid(emailI, false);
    if (!detail){ showMsg('意見內容為必填'); markInvalid(detailI, true); return; }
    markInvalid(detailI, false);
    if (!dateI.value){ showMsg('發生時間為必填'); markInvalid(dateI, true); return; }
    markInvalid(dateI, false);

    // 驗證驗證碼
    const captchaAnswer = (captchaInput.value || '').trim();
    console.log('🔐 驗證碼驗證:', {
      captchaToken: captchaToken.value ? captchaToken.value.substring(0, 8) + '...' : 'empty',
      captchaAnswer: captchaAnswer,
      captchaAnswerLength: captchaAnswer.length
    });
    
    if (!captchaAnswer){ showMsg('請輸入驗證碼'); markInvalid(captchaInput, true); return; }
    if (!/^\d{4}$/.test(captchaAnswer)){ showMsg('驗證碼應為4位數字'); markInvalid(captchaInput, true); return; }
    markInvalid(captchaInput, false);

    const payload = {
      svr_name: name,
      email: email,
      svr_tel: (telI.value||'').trim(),
      svr_date: dateI.value.replace('T',' '), // 轉成 yyyy-MM-dd HH:mm
      svr_detail: detail,
      svr_userip: userId || '',
      captcha_token: captchaToken.value,
      captcha_answer: captchaAnswer
    };
    
    console.log('📤 提交數據:', {
      ...payload,
      captcha_token: payload.captcha_token ? payload.captcha_token.substring(0, 8) + '...' : 'empty'
    });

    btn.disabled = true; btn.classList.add('loading');
    try{
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(text || '提交失敗');
      form.reset();
      loadCaptcha(); // 重新載入驗證碼
      // 顯示成功對話框並啟動倒數
      openModal(dlgSuccess);
      startCountdownAndMaybeClose();
      userId && (payload.svr_userip = userId); // no-op, just keep reference
    }catch(e){
      showMsg(e.message || '送出發生錯誤');
      loadCaptcha(); // 失敗時也重新載入驗證碼
    }finally{
      btn.disabled = false; btn.classList.remove('loading');
    }
  });

  // 預覽對話框中的「確認送出」
  btnConfirmSubmit.addEventListener('click', async () => {
    closeModal(dlgPreview);
    btn.click(); // 沿用同一段提交流程
  });

  // 成功對話框的關閉
  let countdownTimer = null;
  function startCountdownAndMaybeClose(){
    let sec = 10;
    countdownEl.textContent = String(sec);
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      sec -= 1;
      countdownEl.textContent = String(sec);
      if (sec <= 0){
        clearInterval(countdownTimer);
        try{ window.close(); }catch{}
        closeModal(dlgSuccess);
      }
    }, 1000);
  }
  btnCloseSuccess.addEventListener('click', () => {
    clearInterval(countdownTimer);
    try{ window.close(); }catch{}
    closeModal(dlgSuccess);
  });

  // 驗證碼功能
  async function loadCaptcha() {
    console.log('🔄 載入驗證碼...');
    try {
      const captchaUrl = base_url + 'api/SuggestionProxy/captcha';
      console.log('📡 驗證碼 API URL:', captchaUrl);
      
      const response = await fetch(captchaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: Date.now().toString() })
      });

      console.log('📡 驗證碼 API 回應狀態:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ 驗證碼載入成功:', {
          token: data.token ? data.token.substring(0, 8) + '...' : 'empty',
          hasImage: !!data.image_base64
        });
        
        captchaImage.src = `data:image/svg+xml;base64,${data.image_base64}`;
        captchaToken.value = data.token;
        captchaInput.value = '';
      } else {
        console.error('❌ 驗證碼載入失敗，狀態:', response.status);
        showMsg('驗證碼載入失敗');
      }
    } catch (error) {
      console.error('❌ 載入驗證碼失敗:', error);
      showMsg('驗證碼載入失敗');
    }
  }

  // 重置速率限制（開發用）
  async function resetRateLimit() {
    try {
      const resetUrl = base_url + 'api/SuggestionProxy/reset-rate-limit';
      const response = await fetch(resetUrl, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        showMsg(`✅ ${data.message}`, true);
      } else {
        throw new Error('重置失敗');
      }
    } catch (error) {
      console.error('重置速率限制失敗:', error);
      showMsg('重置速率限制失敗');
    }
  }

  // 初始化開發者工具
  function initDevTools() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      devTools.classList.add('show');
      resetRateLimitBtn.addEventListener('click', resetRateLimit);
    }
  }

  // 驗證碼事件監聽
  refreshCaptchaBtn.addEventListener('click', loadCaptcha);

  // 即時過濾 emoji（包括驗證碼輸入）
  [nameI, emailI, telI, detailI, captchaInput].forEach(el => {
    el.addEventListener('input', () => {
      const cur = el.value;
      const cleaned = removeEmoji(cur);
      if (cur !== cleaned) el.value = cleaned;
    });
  });

  // 驗證碼輸入限制（只允許數字）
  captchaInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  // 初始化
  setNowIfEmpty();
  initLiff();
  loadCaptcha(); // 載入驗證碼
  initDevTools(); // 初始化開發者工具
})();
