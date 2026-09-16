/* Small page-local extras. Navigation and reading do not depend on JavaScript. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const KEY = 'hoshizora-tsushin-v1'; // Keep records from the original edition.
  const ids = ['diary', 'bbs', 'links', 'works', 'stars'];
  const fresh = () => ({ found: {}, posts: [], hints: {}, complete: false, quiet: false });
  let state = fresh();
  let storageAvailable = true;
  const normalize = (value) => String(value).normalize('NFKC').replace(/\s+/g, '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  try {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (error) { if (!(error instanceof SyntaxError)) storageAvailable = false; }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      ids.forEach((id) => {
        if (raw.found?.[id] === true) state.found[id] = true;
        if (Number.isInteger(raw.hints?.[id])) state.hints[id] = Math.min(3, Math.max(0, raw.hints[id]));
      });
      if (Array.isArray(raw.posts)) state.posts = raw.posts
        .filter((post) => post && typeof post.name === 'string' && typeof post.message === 'string')
        .slice(0, 12).map((post) => ({ name: post.name.slice(0, 24), message: post.message.slice(0, 240) }));
      state.complete = raw.complete === true;
      state.quiet = raw.quiet === true;
    }
  } catch { storageAvailable = false; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
  }
  function showFound(id) {
    const note = document.querySelector(`[data-found="${id}"]`);
    if (note) note.hidden = false;
  }
  function remember(id) {
    state.found[id] = true;
    save();
    showFound(id);
  }
  ids.forEach((id) => { if (state.found[id]) showFound(id); });
  all('[data-needs-js]').forEach((control) => { control.disabled = false; });
  const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('motion-off', state.quiet);

  // Old bookmarks remain useful; there is no client-side page renderer/router.
  if (document.body.dataset.page === 'home') {
    const legacy = { about: 'profile.html', diary: 'diary.html', bbs: 'bbs.html', links: 'links.html', lost: 'lost/404.html', works: 'under_construction.html', stars: 'observatory.html', secret: 'secret.html', memo: 'help.html' };
    const old = location.hash.slice(1);
    if (Object.hasOwn(legacy, old)) { location.replace(legacy[old]); return; }
  }

  const motion = $('#motion-toggle');
  function updateMotionLabel() {
    if (!motion) return;
    const stopped = state.quiet || prefersReduced();
    motion.textContent = stopped ? '流れる文字は停止中' : '流れる文字を止める';
    if (state.quiet && !prefersReduced()) motion.textContent = '流れる文字を動かす';
    motion.setAttribute('aria-pressed', String(stopped));
    motion.disabled = prefersReduced();
  }
  updateMotionLabel();
  motion?.addEventListener('click', () => {
    state.quiet = !state.quiet; save();
    document.body.classList.toggle('motion-off', state.quiet);
    updateMotionLabel();
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', updateMotionLabel);

  $('#fortune')?.addEventListener('click', () => {
    const messages = ['大吉 ★ なくしたと思っていたものが、見つかる予感。', '中吉 ◇ ちょっとした寄り道に、いいことがありそう。', '小吉 ☆ お茶をいれて、ひと休み。夜はまだ長い。', '星吉 ✦ だれかの「また明日」が、あなたを待っています。'];
    $('#fortune-result').textContent = messages[Math.floor(Math.random() * messages.length)];
  });
  all('[data-diary-star]').forEach((star) => star.addEventListener('click', () => {
    if (star.dataset.diaryStar === 'blue') {
      remember('diary'); $('#diary-result').textContent = '青い星の裏に、何かあります。';
    } else $('#diary-result').textContent = 'きれいな星。日記が教えているのは、どの色だろう。';
  }));

  function renderPosts() {
    const target = $('#local-posts');
    if (!target) return;
    target.replaceChildren();
    state.posts.forEach((post) => {
      const article = document.createElement('article'); article.className = 'post';
      const heading = document.createElement('h2'); heading.textContent = `${post.name}さんの足跡`;
      const meta = document.createElement('p'); meta.className = 'post-meta'; meta.textContent = 'このブラウザーだけの書き込み';
      const text = document.createElement('p'); text.textContent = post.message;
      article.append(heading, meta, text); target.append(article);
    });
  }
  renderPosts();
  $('#bbs-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const number = normalize(values.get('number') || '');
    const name = String(values.get('name') || '').trim().slice(0, 24) || '通りすがり';
    const message = String(values.get('message') || '').trim().slice(0, 240) || '遊びにきました。';
    state.posts.unshift({ name, message }); state.posts = state.posts.slice(0, 12);
    if (/^0*2001$/.test(number)) remember('bbs'); else save();
    renderPosts();
    const note = storageAvailable ? '足跡を残しました。ありがとう！' : 'このページに足跡を残しました。保存できないため、ページを移動すると消えます。';
    $('#bbs-result').textContent = note + (number && !/^0*2001$/.test(number) ? ' キリ番は、トップのカウンターをもう一度見てね。' : '');
    form.reset();
  });
  $('#reveal-ink')?.addEventListener('click', (event) => {
    const active = $('#secret-ink').classList.toggle('revealed');
    event.currentTarget.setAttribute('aria-pressed', String(active));
    event.currentTarget.textContent = active ? '文字をもとに戻す' : '余白の文字を照らす';
  });
  $('#lost-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (normalize(new FormData(event.currentTarget).get('answer')) === 'よりみち') {
      remember('links'); $('#lost-result').textContent = '消えたと思っていた言葉に、たどりつきました。';
    } else $('#lost-result').textContent = 'その言葉ではないみたい。余白を、もう一度。';
  });

  let lamps = [true, false, false, false, true, false, false, false, true];
  const lampButtons = all('[data-lamp]');
  function paintLamps() {
    lampButtons.forEach((lamp, i) => {
      lamp.classList.toggle('on', lamps[i]); lamp.setAttribute('aria-pressed', String(lamps[i]));
      lamp.textContent = lamps[i] ? 'ON' : 'OFF';
    });
  }
  lampButtons.forEach((lamp) => lamp.addEventListener('click', () => {
    const index = Number(lamp.dataset.lamp), row = Math.floor(index / 3), col = index % 3;
    [index, ...(row > 0 ? [index - 3] : []), ...(row < 2 ? [index + 3] : []), ...(col > 0 ? [index - 1] : []), ...(col < 2 ? [index + 1] : [])].forEach((i) => { lamps[i] = !lamps[i]; });
    paintLamps();
    if (lamps.every((on) => !on)) { remember('works'); $('#lamp-result').textContent = '消灯しました。……壁が、ぼんやり光っています。'; }
    else $('#lamp-result').textContent = 'まだ、明かりが点いています。';
  }));
  $('#reset-lamps')?.addEventListener('click', () => {
    lamps = [true, false, false, false, true, false, false, false, true]; paintLamps();
    $('#lamp-result').textContent = '最初の配線に戻しました。';
  });

  let timers = [], starReady = false, starIndex = 0, starBusy = false;
  const starButtons = all('[data-star]'), sequence = [2, 0, 3, 1];
  function stopStars() {
    timers.forEach(clearTimeout); timers = [];
    starReady = false; starIndex = 0; starBusy = false;
    starButtons.forEach((star) => { star.classList.remove('lit'); star.disabled = true; });
    if ($('#play-stars')) $('#play-stars').disabled = false;
  }
  function readyStars() {
    starBusy = false; starReady = true; starIndex = 0;
    starButtons.forEach((star) => { star.disabled = false; });
    $('#play-stars').disabled = false;
  }
  $('#play-stars')?.addEventListener('click', () => {
    if (starBusy) return;
    stopStars(); starBusy = true; $('#play-stars').disabled = true;
    if ($('#still-stars').checked || state.quiet || prefersReduced()) {
      $('#star-result').textContent = '星の合図：3 → 1 → 4 → 2。この順番で返してみて。'; readyStars(); return;
    }
    $('#star-result').textContent = '星をよく見ていてね。';
    sequence.forEach((index, step) => {
      timers.push(setTimeout(() => {
        starButtons[index].classList.add('lit'); $('#star-result').textContent = `${index + 1}番の星が光っています。`;
      }, 350 + step * 850));
      timers.push(setTimeout(() => { starButtons[index].classList.remove('lit'); }, 900 + step * 850));
    });
    timers.push(setTimeout(() => { readyStars(); $('#star-result').textContent = '同じ順番で、返事をしてみて。'; }, 3800));
  });
  starButtons.forEach((star) => star.addEventListener('click', () => {
    if (!starReady || starBusy) return;
    if (Number(star.dataset.star) !== sequence[starIndex]) {
      starIndex = 0; $('#star-result').textContent = 'ちがったみたい。最初の星から、もう一度。'; return;
    }
    starIndex++;
    if (starIndex === sequence.length) {
      stopStars(); remember('stars'); $('#star-result').textContent = '遠くの星から、お返事が届きました。';
    } else $('#star-result').textContent = '次の星は、どれだったかな。';
  }));
  $('#still-stars')?.addEventListener('change', () => { stopStars(); $('#star-result').textContent = 'もう一度、合図を見てみよう。'; });

  function openLetter(focus = false) {
    if (!$('#letter')) return;
    $('#secret-lock').hidden = true; $('#letter').hidden = false;
    if (focus) $('#letter').focus();
  }
  if (state.complete) openLetter();
  $('#secret-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (normalize(new FormData(event.currentTarget).get('answer')) === 'ほしのうみ') {
      // Knowledge of the word is enough; storage is never required to finish.
      state.complete = true; save(); openLetter(true);
    } else $('#secret-result').textContent = '合言葉が、少し違うみたい。文字の順番を見直してみて。';
  });

  let pets = 0;
  $('#pet-cat')?.addEventListener('click', () => {
    pets++;
    const faces = [' /\\_/\\\n( ^.^ )\n > ^ <', ' /\\_/\\\n( o.o ) !\n > ^ <', ' /\\_/\\\n( -.- ) z Z\n > ^ <'];
    const words = ['ごろごろ、ごろごろ。……もうちょっとだけ。', '起きました。でも、動く気はなさそうです。', 'また寝てしまいました。おやすみなさい。'];
    $('#cat-face').textContent = faces[(pets - 1) % faces.length]; $('#cat-result').textContent = words[(pets - 1) % words.length];
  });

  let audioContext, master, audioOn = false, soundBusy = false, musicTimer, noteIndex = 0, audioEpoch = 0;
  function note(frequency) {
    if (!audioOn || audioContext?.state !== 'running') return;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.35, now + .015);
    gain.gain.exponentialRampToValueAtTime(.001, now + .65);
    oscillator.connect(gain); gain.connect(master); oscillator.start(now); oscillator.stop(now + .7);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function music() {
    if (!audioOn) return;
    const melody = [64, 67, 71, 74, 71, 67, 62, 67, 60, 64, 69, 72, 69, 64, 62, 59];
    note(440 * 2 ** ((melody[noteIndex++ % melody.length] - 69) / 12)); musicTimer = setTimeout(music, 520);
  }
  function mute() {
    audioEpoch++; audioOn = false; clearTimeout(musicTimer);
    if (audioContext && master) master.gain.setTargetAtTime(0, audioContext.currentTime, .015);
    if ($('#music-play')) { $('#music-play').disabled = false; $('#music-stop').disabled = true; $('#music-result').textContent = '音を止めました。'; }
  }
  $('#music-play')?.addEventListener('click', async () => {
    if (audioOn || soundBusy) return;
    soundBusy = true; const epoch = ++audioEpoch;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      if (!audioContext) { audioContext = new Audio(); master = audioContext.createGain(); master.gain.value = 0; master.connect(audioContext.destination); }
      await audioContext.resume();
      if (document.hidden || epoch !== audioEpoch) return;
      audioOn = true; master.gain.setTargetAtTime(.04, audioContext.currentTime, .02);
      $('#music-play').disabled = true; $('#music-stop').disabled = false;
      $('#music-result').textContent = '♪ 星あかりのオルゴール　再生中'; music();
    } catch { $('#music-result').textContent = 'このブラウザーでは音を再生できません。'; }
    finally { soundBusy = false; }
  });
  $('#music-stop')?.addEventListener('click', mute);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { mute(); stopStars(); } });
  window.addEventListener('pagehide', () => { mute(); stopStars(); });

  $('#reset-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!$('#reset-check').checked) return;
    try { localStorage.removeItem(KEY); state = fresh(); $('#reset-result').textContent = 'このサイトの記録を削除しました。'; }
    catch { state = fresh(); $('#reset-result').textContent = 'このページの記録を消しました。ブラウザーの保存領域は操作できませんでした。'; }
    event.currentTarget.reset();
  });
})();
