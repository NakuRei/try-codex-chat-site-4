/* ほしぞら通信 — no build step, no network requests, no external dependencies. */
(() => {
  'use strict';
  const STORAGE = 'hoshizora-tsushin-v1';
  const pieces = [
    { id: 'diary', letter: 'ほ', name: 'きまぐれ日記', note: '日記の行間に、青い光が残っていた。' },
    { id: 'bbs', letter: 'し', name: '掲示板 / BBS', note: 'だれかの足跡が、次のだれかへの道しるべ。' },
    { id: 'links', letter: 'の', name: 'リンクの部屋', note: 'リンクが切れても、言葉まで消えるわけじゃない。' },
    { id: 'works', letter: 'う', name: '工事中の部屋', note: 'できあがらない場所にも、ちゃんと入り口があった。' },
    { id: 'stars', letter: 'み', name: '夜の展望台', note: '遠くの光が、こちらに合図を返してくれた。' }
  ];
  const hints = {
    diary: ['8月31日の日記は、ちょうど5行。読みはじめの場所を変えてみよう。', '各行の「最初の1文字」を、上から下に読んでみよう。', '「あ・お・い・ほ・し」。日記の下にある青い星を押すと、かけらが見つかる。'],
    bbs: ['管理人は、キリ番を踏んだお客さんを待っている。トップページのカウンターを見よう。', 'カウンターの「002001」は、2001人目という意味。BBSのキリ番欄に報告しよう。', 'キリ番欄に「2001」または「002001」を入れて書き込む。名前とひとことは自由で大丈夫。'],
    links: ['リンクの部屋には、ひとつだけリンク切れのバナーがある。開いてみよう。', '404ページの余白をドラッグして選択してみよう。スマートフォンなら「文字を照らす」でも読める。', '隠れていた言葉は「よりみち」。404ページの入力欄に入れて、たしかめよう。'],
    works: ['ランプは、押した場所と上下左右が一緒に切り替わる。全部消すと、工事が終わる。', '迷ったら「配置を戻す」。最初に光っている3つのランプが手掛かり。', '初期配置に戻してから、左上 → 中央 → 右下の3か所を、それぞれ1回押そう。'],
    stars: ['「星の合図を見る」を押すと、4つの星が順に光る。音がOFFでも遊べる。', '光った星の順番を覚えて、同じ順に押してみよう。何回見直しても大丈夫。', '合図を見たあと、3番 → 1番 → 4番 → 2番の順に押そう。']
  };
  const names = { home: 'トップページ', about: '管理人について', diary: 'きまぐれ日記', bbs: '掲示板 / BBS', links: 'リンクの部屋', lost: '404 Not Found', works: '工事中の部屋', stars: '夜の展望台', secret: 'ひみつのページ', memo: '探索メモ' };
  const files = { home: 'index.html', about: 'profile.html', diary: 'diary.html', bbs: 'bbs.cgi', links: 'links.html', lost: 'lost/404.html', works: 'under_construction.html', stars: 'observatory.html', secret: 'secret.html', memo: 'memo.txt' };
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const normalize = (value) => String(value).normalize('NFKC').replace(/\s+/g, '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const defaultState = () => ({ found: {}, posts: [], hints: {}, complete: false, quiet: false });
  let storageAvailable = true;
  let state = defaultState();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (raw && typeof raw === 'object') {
      pieces.forEach(p => {
        if (raw.found?.[p.id] === true) state.found[p.id] = true;
        if (Number.isInteger(raw.hints?.[p.id])) state.hints[p.id] = Math.max(0, Math.min(3, raw.hints[p.id]));
      });
      if (Array.isArray(raw.posts)) state.posts = raw.posts.filter(p => p && typeof p.name === 'string' && typeof p.message === 'string').slice(0, 12).map(p => ({ name: p.name.slice(0, 24), message: p.message.slice(0, 240) }));
      state.complete = raw.complete === true && pieces.every(p => state.found[p.id]);
      state.quiet = raw.quiet === true;
    }
  } catch { storageAvailable = false; }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    $('#save-note').textContent = storageAvailable ? '進み具合はこのブラウザーに自動保存。' : '保存を利用できません。このタブの間だけ記録します。';
  }
  const count = () => pieces.filter(p => state.found[p.id]).length;
  const reduced = () => state.quiet || matchMedia('(prefers-reduced-motion: reduce)').matches;
  function applyMotion() {
    document.body.classList.toggle('motion-off', reduced());
    $('#motion').textContent = `✧ 演出 : ${reduced() ? 'OFF' : 'ON'}`;
    $('#motion').setAttribute('aria-pressed', String(reduced()));
  }
  function slots() {
    return pieces.map(p => `<span class="fragment-slot ${state.found[p.id] ? 'found' : ''}" aria-label="${p.name}：${state.found[p.id] ? p.letter : '未発見'}">${state.found[p.id] ? p.letter : '?'}</span>`).join('');
  }
  function updateMemo() {
    $('#fragments').innerHTML = slots();
    $('#progress').textContent = state.complete ? '★ あの夜の続きに、たどりついた。' : `${count()} / 5 かけらを見つけました。`;
  }
  const heading = (title, filename) => `<div class="page-heading"><h2>${title}</h2><span class="file-name">${filename}</span></div>`;
  const panel = (title, body, extra = '') => `<section class="panel ${extra}"><h3 class="panel-title">${title}</h3><div class="panel-body">${body}</div></section>`;
  const solved = (id) => state.found[id] ? `<div class="notice">★ この場所のかけらは発見済みです。 <a href="#memo">探索メモへ</a></div>` : '';
  const footHint = () => '<div class="hint-row"><span>行き詰まったら、ひと休み。</span><button data-action="hint">この場所のヒント [?]</button></div>';
  const pages = {
    home() {
      return `${heading('ようこそ、ほしぞら通信へ。', 'index.html')}
      <div class="counter-area"><p>あなたは <span class="counter" aria-label="2001"><span>0</span><span>0</span><span>2</span><span>0</span><span>0</span><span>1</span></span> 人目のお客様です。</p><p class="counter-caption">★ キリ番 <strong>2001</strong> を踏んだ方は <a href="#bbs">BBS</a> にご報告ください ★</p></div>
      <div class="home-grid"><div>
        <section class="panel letter"><h3 class="panel-title">✉ 管理人からのおしらせ <b class="new">New!</b></h3><div class="stamp" aria-hidden="true">AIR MAIL<br>2001.8.31</div><div class="panel-body"><p>こんばんは。管理人のそらです。</p><p>夏休みも、もうおしまい。<br>このホームページも、しばらくお休みします。</p><p>その前に、ひとつだけ。<br>このサイトのどこかに、<strong>5つのかけら</strong>を隠しました。<br>ぜんぶ見つけたら、<a href="#secret">ひみつのページ</a>へ来てください。</p><p>だれも来ないかもしれないけど、<br>小さなタイムカプセルを、置いておきます。</p><p class="signature">2001年8月31日　そら</p><a class="entry-link" href="#diary">→ まずは、最後の日記を読んでみる</a></div></section>
        ${panel('▤ 更新履歴', '<div class="news"><p><time>2001.08.31</time><span>最後の日記を更新。<a href="#secret">ひみつのページ</a>を追加しました。</span></p><p><time>2001.08.24</time><span><a href="#stars">展望台</a>に、星のオルゴールを置きました。</span></p><p><time>2001.08.12</time><span>リンク切れを発見。でも、そのままにしておきます。</span></p><p><time>2001.07.07</time><span>2周年！ 来てくれたみなさん、ありがとう。</span></p></div>')}
        <p class="guestbook-callout">はじめましての方も、いつもの方も。<br><a href="#bbs">足跡を残していってね。</a>　読み逃げも、もちろん歓迎です。(^^)</p>
      </div><aside class="home-right">
        ${panel('☾ いま、この場所は', '<div class="moon-icon" aria-hidden="true">☾</div><div class="clock">23:58</div><p class="clock-label">2001 / 08 / 31</p><p>夏休み最後の夜。<br>時計は、あの日のまま。</p>')}
        ${panel('◇ きょうのおみくじ', '<p>クリックひとつで<br>ちょっといいこと。</p><button data-action="fortune">おみくじを引く</button><p id="fortune-result" class="fortune-result" aria-live="polite">なにが出るかな？</p>')}
        ${panel('⚒ まだまだ工事中', '<p>完成する日は未定です。<br>それもまた、個人サイト。</p><a href="#works">ちょっと、のぞく →</a><div class="construction-mini"></div>')}
      </aside></div><div class="site-banner" aria-hidden="true">ほしぞら通信<small>HOSHIZORA TSUSHIN</small></div><p class="foot-notice">↑ 当サイトのバナーです。200 × 40 pixels ↑</p>`;
    },
    about() {
      return `${heading('管理人について', 'profile.html')}${panel('◇ そらのプロフィール', '<table class="profile-table"><tr><th>ハンドル名</th><td>そら</td></tr><tr><th>すきなもの</th><td>夜の散歩 / 星 / ソーダアイス / インターネット</td></tr><tr><th>とくぎ</th><td>「工事中」のページを増やすこと。</td></tr><tr><th>出没時間</th><td>家族が寝静まってから、こっそり。</td></tr><tr><th>ひとこと</th><td>どこにもつながっていないようで、<br>どこかのだれかには、つながっている。</td></tr></table>')}
      ${panel('このホームページのこと', '<p>1999年の七夕、はじめてホームページを作りました。<br>最初は文字を青くするだけで、なんだかすごいことをした気がして。</p><p>掲示板に「来ました！」ってひとこと書いてもらえた日は、<br>顔も知らない人のことを、一日中うれしく思っていました。</p><p>大きなサイトにはならなかったけど、<br>ここは、わたしの小さな居場所です。</p><p class="signature">そら</p>')}
      <details><summary>このゲームについて・保存と音の設定</summary><div class="notice"><p>このサイトと人物、日付、カウンター、投稿はフィクションです。2001年の個人ホームページを探索し、5つのかけらを集めるゲームです。</p><p>実際のアクセス数は計測しません。BBSの書き込みと進行状況はこのブラウザーのlocalStorageにだけ保存し、サーバーやほかの人には送信しません。保存を利用できなくても、このタブを閉じるまでは遊べます。</p><p>音は初期状態でOFFです。「MIDI」は懐かしい音の演出で、実際にはWeb Audioで合成しています。外部通信やアカウント登録はありません。演出をOFFにすると、流れる文字も停止します。</p><button data-action="help">遊び方をひらく</button></div></details>`;
    },
    diary() {
      return `${heading('きまぐれ日記', 'diary.html')}${solved('diary')}<article class="diary-paper"><div class="diary-date">2001.08.31 (FRI)　天気：晴れ　気分：ちょっとさみしい</div><h3>夏休みの、さいごのページ。</h3><div class="poem"><p>あっという間に、夏休みも最後の日。</p><p>おとなになったら、この夜を忘れるのかな。</p><p>いま見えている景色を、少しだけ残しておく。</p><p>ほかの誰かが、いつかここを見つけたら。</p><p>しばらく、一緒に星を見てくれますように。</p></div><p class="diary-aside">追伸：文章は、横に読むだけじゃないんだって。</p><div class="star-row"><button class="star-red" data-action="diary-star" data-color="red" aria-label="赤い星">★</button><button class="star-yellow" data-action="diary-star" data-color="yellow" aria-label="黄色い星">★</button><button class="star-blue" data-action="diary-star" data-color="blue" aria-label="青い星">★</button><button class="star-green" data-action="diary-star" data-color="green" aria-label="緑の星">★</button></div><p class="center small dim">素材屋さんでもらった、つもりの星たち。</p><div class="old-entry"><div class="diary-date">2001.08.24 (FRI)</div><p>展望台の星が、順番に光るようになりました。<br>向こうからの合図を、同じ順番で返してみてね。<br>スピーカーがなくても大丈夫。目でも聞けるオルゴールです。</p></div><div class="old-entry"><div class="diary-date">2001.07.07 (SAT)</div><p>ホームページが2歳になりました。<br>いつか大人になって、ここを見返したら、<br>今のわたしに、なんて声をかけるんだろう。</p></div></article>${footHint()}`;
    },
    bbs() {
      const userPosts = state.posts.map((p, i) => `<article class="bbs-post"><h3>No.${2002 + state.posts.length - i}　${escapeHTML(p.name)}さんの足跡</h3><div class="post-meta">${escapeHTML(p.name)} / このブラウザーだけの書き込み</div><p>${escapeHTML(p.message).replace(/\n/g, '<br>')}</p></article>`).join('');
      return `${heading('ほしぞら掲示板', 'bbs.cgi')}${solved('bbs')}<p class="small">初カキコ大歓迎！ 荒らしはだめですよ。仲良く使ってね。(^^)</p><article class="bbs-post owner"><h3>No.2000　キリ番のプレゼント、あります。</h3><div class="post-meta">そら＠管理人 / 2001.08.31 23:58</div><p>次のキリ番は <strong>2001</strong> です！<br>踏んだ方は、下の「キリ番」欄で番号を報告してください。<br>ささやかなプレゼントを用意しています。カウンターはトップにあるよ。</p></article><article class="bbs-post"><h3>No.1999　夏休み終わっちゃうね</h3><div class="post-meta">みずいろ / 2001.08.31 23:41</div><p>宿題おわってないのに巡回してます（汗）<br>ここのBGMすき。更新、のんびり待ってるね！</p></article>${userPosts}
      ${panel('✎ 足跡を残す', '<form id="bbs-form"><div class="form-grid"><label class="field"><span>お名前 / HN</span><input name="name" maxlength="24" placeholder="通りすがり" autocomplete="off"></label><label class="field"><span>キリ番（踏んだ方だけ）</span><input name="number" inputmode="numeric" maxlength="6" placeholder="例：1234" autocomplete="off"></label></div><label class="field"><span>ひとこと</span><textarea name="message" maxlength="240" rows="3" placeholder="はじめまして！"></textarea></label><div class="form-footer"><small>※ 書き込みはこの端末だけに保存されます。<br>実際の投稿・外部への送信は行いません。</small><button type="submit">書き込む</button></div></form>')}${footHint()}`;
    },
    links() {
      return `${heading('リンクの部屋', 'links.html')}${solved('links')}<p class="small">ネットの海で見つけた、お気に入りの場所。<br>バナーをクリックすると、ちょっと寄り道できます。</p>${panel('★ おともだちのホームページ', '<div class="link-list"><div class="link-item"><button class="web-banner cat-banner" data-action="cat">ねこのひるね<small>NEKO NO HIRUNE</small></button><p>ねこ好きさんの休憩所。<br>管理人のねこは、だいたい寝ています。</p></div><div class="link-item"><button class="web-banner midi-banner" data-action="music-room">♫ おとの小箱<small>ORIGINAL SOUND ROOM</small></button><p>小さな音を集めたお部屋。<br>音量は、ひかえめにどうぞ。</p></div><div class="link-item"><a class="web-banner lost-banner" href="#lost">NOT FOUND<small>どこかにあったページ</small></a><p>昔、とても好きだった場所。<br><em>※ リンク切れ。でも、消せませんでした。</em></p></div></div>')}${panel('∞ ほしぞらウェブリング', '<p class="center small">ひとつ前も、次のサイトも、いまはここにつながっています。</p><div class="center">［ <button class="text-button" data-action="ring">← 前のサイト</button> | <a href="#home">リングの中心</a> | <button class="text-button" data-action="ring">次のサイト →</button> ］</div>')}<p class="foot-notice">このリンク集の行き先は、すべてゲーム内の小さな部屋です。</p>${footHint()}`;
    },
    lost() {
      return `${heading('ページが見つかりません', 'lost/404.html')}${solved('links')}<div class="error-page"><div class="error-number">404</div><h3>File Not Found</h3><p class="small">お探しのページは、なくなってしまったようです。<br>けれど、何も残っていないとは限りません。</p><div id="secret-ink" class="secret-ink">ここまで来てくれて、ありがとう。<br>道に迷ったのではなく、「よりみち」をしているだけ。<br>覚えておく言葉は、よりみち。</div><button data-action="reveal">☼ 文字を照らす</button><p class="small dim" style="margin-top:10px">余白をドラッグして選択しても、何か見えるかも。<br>タッチ操作では、上のボタンを使ってね。</p><form id="lost-form" class="compact-form"><label class="field"><span>残されていた言葉は？</span><input name="answer" maxlength="24" autocomplete="off" required></label><button type="submit">たしかめる</button></form></div>${footHint()}`;
    },
    works() {
      const board = state.found.works ? Array(9).fill(false) : lamps;
      return `${heading('工事中の部屋', 'under_construction.html')}${solved('works')}<div class="hazard"></div><section class="works-panel"><h3 class="construction-sign">UNDER CONSTRUCTION</h3><p>ただいま、絶賛工事中です。<br><span class="small">……と言いながら、もうずいぶん経ちました。</span></p><div class="notice"><strong>夜間工事の点検パネル</strong><br>押したランプと、その上下左右が切り替わります。<br>全部のランプを消したら、奥へ進めるようです。</div><div class="lights-grid" role="group" aria-label="9個の点検ランプ">${board.map((on, i) => `<button class="lamp ${on ? 'on' : ''}" data-action="lamp" data-index="${i}" aria-label="${Math.floor(i / 3) + 1}行${i % 3 + 1}列のランプ" aria-pressed="${on}" ${state.found.works ? 'disabled' : ''}>${on ? 'ON' : 'OFF'}</button>`).join('')}</div><div class="works-controls"><span id="lamp-moves">${lampMoves} 回操作</span><button data-action="reset-lamps" ${state.found.works ? 'disabled' : ''}>配置を戻す</button></div><p class="small dim" style="margin:15px 0 0">※ 本当に工事は始まりません。安心して押してね。</p></section><div class="hazard"></div>${footHint()}`;
    },
    stars() {
      return `${heading('夜の展望台', 'observatory.html')}${solved('stars')}<p>画面のむこうで、星が何かを伝えようとしています。</p><p class="small dim">「合図を見る」を押して、光る順番を覚えてください。<br>同じ順番で星を押すと、お返事ができます。音はなくても大丈夫。</p><div class="constellation" role="group" aria-label="星のオルゴール">${[1, 2, 3, 4].map((n, i) => `<button class="sky-star" data-action="sky-star" data-index="${i}" aria-label="${n}番の星" disabled>✦<span>STAR ${n}</span></button>`).join('')}</div><p id="star-message" class="star-message" role="status">望遠鏡をのぞいて、合図を待とう。</p><div class="center"><button id="play-stars" data-action="play-stars">▷ 星の合図を見る</button></div><p class="center small dim" style="margin-top:16px">何度見直しても、まちがえても、大丈夫。</p>${footHint()}`;
    },
    secret() {
      if (state.complete) return ending();
      return `${heading('ひみつのページ', 'secret.html')}<div class="lock-panel"><div class="lock-icon" aria-hidden="true">⚿</div><h3>この先、未来のあなたへ。</h3><p>小さなタイムカプセルには、鍵がかかっています。<br>日記、BBS、リンク、工事中、展望台。<br>5つの場所から、かけらを持ってきてください。</p><div class="fragment-strip">${slots()}</div><p>かけらは、<strong>メニューに並んでいる順番</strong>に。<br>それが、このページの合言葉です。</p><form id="secret-form" class="compact-form"><label class="field"><span>合言葉（ひらがな5文字）</span><input name="answer" maxlength="24" autocomplete="off" required placeholder="ここに合言葉を入力"></label><button type="submit">鍵をあける</button></form><p class="small" id="lock-status">${count() === 5 ? '5つそろいました。あとは、言葉をつなぐだけ。' : `いま、${count()} / 5 個のかけらが集まっています。`}</p></div><p class="center small" style="margin-top:17px"><a href="#memo">→ 集めたかけらを見返す</a></p>`;
    },
    memo() {
      return `${heading('探索メモ', 'memo.txt')}<div class="notice">見つけたかけらを、このメモに残しておきます。<br>まだ見つかっていない場所にも、いつでも戻れます。</div>${panel('▣ 5つのかけら', `<ul class="memo-list">${pieces.map(p => `<li><span class="fragment-slot ${state.found[p.id] ? 'found' : ''}">${state.found[p.id] ? p.letter : '?'}</span><div><strong><a href="#${p.id}">${p.name}</a></strong><p>${state.found[p.id] ? p.note : 'まだ、何かが隠れているようです。'}</p></div></li>`).join('')}</ul>`)}<p class="center"><a href="#secret">→ ひみつのページへ行く</a></p><div class="danger-zone"><p>${storageAvailable ? '進行状況と足跡は、このブラウザーに保存されています。' : '保存機能を利用できないため、このタブを閉じると記録が消えます。'}</p><button data-action="reset-confirm">記録を消して、最初から遊ぶ</button></div>`;
    }
  };
  function ending() {
    return `${heading('タイムカプセル', 'secret/open.html')}<article class="ending"><p class="ending-date">FROM 2001.08.31　/　TO SOMEONE IN THE FUTURE</p><h3>見つけてくれたんだね。</h3><p>こんにちは。そらです。<br>そちらは、何年ですか。</p><p>未来のインターネットは、どんな場所ですか。<br>もっと速くて、もっと便利で、<br>ここみたいな小さな場所は、見つけにくいのかもしれないね。</p><p>でも、あなたは来てくれた。<br>日記を読んで、足跡を残して、<br>行き止まりでも立ち止まって、星に返事をしてくれた。</p><p>なんでもない夏休みの夜を、<br>未来のだれかが、もう一度ひらいてくれた。<br>それだけで、このホームページを作ってよかったと思います。</p><p>画面のむこうのあなたが、元気でいますように。<br>きょう、ひとつでも、いいことがありますように。</p><p>それじゃあ、また明日。<br>インターネットの、どこかで。</p><p class="signature">2001年の、そらより</p><div class="clear-badge">★ TIME CAPSULE FOUND ★<br>ほしぞら通信・未来のお客様 第2001号</div><p><button data-action="souvenir">記念のことばを受け取る</button></p><a href="#home">［ ホームページに戻る ］</a></article>`;
  }
  let route = 'home';
  const trail = [];
  let lamps = [true, false, false, false, true, false, false, false, true];
  let lampMoves = 0;
  const sequence = [2, 0, 3, 1];
  let starTimers = [];
  let starReady = false;
  let starIndex = 0;
  let starPlaying = false;
  function stopStars() {
    starTimers.forEach(clearTimeout); starTimers = [];
    starReady = false; starIndex = 0; starPlaying = false;
  }
  function render(focus = false) {
    stopStars();
    const hash = location.hash.slice(1);
    const next = Object.hasOwn(pages, hash) ? hash : 'home';
    if (next !== route) { trail.push(route); route = next; }
    $('#content').innerHTML = pages[route]();
    $('#address').value = `hoshizora.local/~sora/${files[route]}`;
    document.title = `${names[route]} ─ ほしぞら通信 ★`;
    document.querySelectorAll('[data-page]').forEach(a => {
      const active = a.dataset.page === route || (route === 'lost' && a.dataset.page === 'links');
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    updateMemo();
    $('#status').textContent = `✓ ${names[route]} を読み込みました。`;
    if (focus) {
      $('#content').focus({ preventScroll: true });
      if (matchMedia('(max-width: 620px)').matches) $('#content').scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    }
  }
  const dialog = $('#dialog');
  function showDialog(title, html) {
    $('#dialog-title').textContent = title;
    $('#dialog-body').innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
  }
  function award(id) {
    if (state.found[id]) { toast('このかけらは、もう探索メモにしまってあります。'); return; }
    const piece = pieces.find(p => p.id === id);
    state.found[id] = true;
    save(); render(false);
    showDialog('★ 小さなかけらを見つけました', `<div class="found-letter">${piece.letter}</div><p class="center">${piece.note}</p><p class="center small">探索メモに記録しました。あと ${5 - count()} 個。</p>${count() === 5 ? '<p class="center"><a href="#secret">→ 5つそろった。ひみつのページへ</a></p>' : '<p class="center small">ほかのページにも、何か残っているかもしれません。</p>'}`);
    tone(659, .4);
  }
  function showHints(id, advance = false) {
    if (!hints[id]) id = pieces.find(p => !state.found[p.id])?.id || 'diary';
    const n = Math.min(3, Math.max(1, (state.hints[id] || 0) + (advance ? 1 : 0)));
    state.hints[id] = n; save();
    const p = pieces.find(p => p.id === id);
    showDialog(`ヒント：${p.name}`, `<p>少しずつ、手掛かりをお伝えします。<br>3つ目には、具体的な解き方が書いてあります。</p>${hints[id].slice(0, n).map((h, i) => `<div class="hint-detail"><strong>ヒント ${i + 1}</strong><br>${h}</div>`).join('')}<div class="dialog-actions"><a href="#${id}" class="classic-button">この場所へ</a><button data-action="next-hint" data-id="${id}" ${n === 3 ? 'disabled' : ''}>${n === 3 ? 'ヒントはここまで' : 'もう少しヒントを見る'}</button></div>`);
  }
  function playStars() {
    if (starPlaying) return;
    stopStars(); starPlaying = true;
    const btns = [...document.querySelectorAll('.sky-star')];
    const start = $('#play-stars');
    start.disabled = true; btns.forEach(b => { b.disabled = true; b.classList.remove('lit'); });
    const later = (fn, ms) => { starTimers.push(setTimeout(fn, ms)); };
    if (reduced()) {
      $('#star-message').textContent = '星の合図：3 → 1 → 4 → 2。この順番で押してね。';
      starPlaying = false; starReady = true; start.disabled = false; btns.forEach(b => b.disabled = false);
      return;
    }
    $('#star-message').textContent = '星をよく見ていてね。';
    sequence.forEach((index, step) => {
      later(() => { btns[index].classList.add('lit'); $('#star-message').textContent = `合図 ${step + 1} / 4：${index + 1}番の星`; tone([523, 587, 659, 784][index], .3); }, 400 + step * 850);
      later(() => btns[index].classList.remove('lit'), 900 + step * 850);
    });
    later(() => { starPlaying = false; starReady = true; start.disabled = false; btns.forEach(b => b.disabled = false); $('#star-message').textContent = '同じ順番で星を押してください。（0 / 4）'; }, 3800);
  }
  let audioContext, master, audioOn = false, soundBusy = false, musicTimer, noteIndex = 0;
  function tone(frequency, seconds = .45) {
    if (!audioOn || !audioContext || audioContext.state !== 'running') return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.4, now + .015);
    gain.gain.exponentialRampToValueAtTime(.001, now + seconds);
    oscillator.connect(gain); gain.connect(master);
    oscillator.start(now); oscillator.stop(now + seconds + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function music() {
    if (!audioOn) return;
    const notes = [64, 67, 71, 74, 71, 67, 62, 67, 60, 64, 69, 72, 69, 64, 62, 59];
    tone(440 * 2 ** ((notes[noteIndex++ % notes.length] - 69) / 12), .65);
    musicTimer = setTimeout(music, 520);
  }
  function mute() {
    audioOn = false; clearTimeout(musicTimer);
    if (audioContext && master) master.gain.setTargetAtTime(0, audioContext.currentTime, .015);
    $('#sound').textContent = '♫ MIDI : OFF'; $('#sound').setAttribute('aria-pressed', 'false');
  }
  async function toggleSound() {
    if (soundBusy) return;
    if (audioOn) { mute(); return; }
    soundBusy = true;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      if (!audioContext) { audioContext = new Audio(); master = audioContext.createGain(); master.gain.value = 0; master.connect(audioContext.destination); }
      await audioContext.resume();
      if (document.hidden) return;
      audioOn = true; master.gain.setTargetAtTime(.04, audioContext.currentTime, .02);
      $('#sound').textContent = '♫ MIDI : ON'; $('#sound').setAttribute('aria-pressed', 'true');
      music();
    } catch { toast('このブラウザーでは音を再生できません。音なしで、すべて遊べます。'); }
    finally { soundBusy = false; }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('.skip')) { event.preventDefault(); $('#content').focus(); $('#content').scrollIntoView(); return; }
    const link = event.target.closest('a[href^="#"]');
    if (link && dialog.contains(link)) dialog.close();
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    switch (action) {
      case 'close-dialog': dialog.close(); break;
      case 'back': {
        const prev = trail.pop();
        if (prev) { route = prev; location.hash = prev; } else toast('ここが、この小さなインターネットの入り口です。');
        break;
      }
      case 'leave': showDialog('まだ、接続中です。', '<p>せっかく来てくれたんだもの。<br>もう少し、寄り道していきませんか。</p><p class="small dim">この×はゲーム内の飾りです。実際のタブは閉じません。</p>'); break;
      case 'help': showDialog('ほしぞら通信の歩き方', '<p>2001年で更新が止まった、小さな個人ホームページです。メニューを巡って <strong>5つのかけら</strong> を集め、ひみつのページを開いてください。</p><p>日記の読み方を変えたり、キリ番を報告したり、リンク切れの先をのぞいたり。ちょっと変なところには、何か隠れています。</p><p>制限時間もゲームオーバーもありません。右上の「ヒント」は3段階。スマートフォンでも最後まで遊べます。</p><p class="small dim">登場人物・日付・カウンターはフィクションです。書き込みはこの端末にのみ保存され、送信されません。音は自分でONにしたときだけ流れます。</p>'); break;
      case 'hint': showHints(route === 'lost' ? 'links' : route); break;
      case 'next-hint': showHints(target.dataset.id, true); break;
      case 'sound': void toggleSound(); break;
      case 'motion': state.quiet = !state.quiet; save(); applyMotion(); if (route === 'stars') render(false); if (matchMedia('(prefers-reduced-motion: reduce)').matches) toast('端末の「視差効果を減らす」設定を優先しています。'); break;
      case 'fortune': {
        const fortunes = ['大吉 ★ なくしたと思っていたものが、見つかる予感。', '中吉 ◇ ちょっとした寄り道に、いいことがありそう。', '小吉 ☆ お茶をいれて、ひと休み。夜はまだ長い。', '星吉 ✦ だれかの「また明日」が、あなたを待っています。'];
        $('#fortune-result').textContent = fortunes[Math.floor(Math.random() * fortunes.length)]; break;
      }
      case 'diary-star': if (target.dataset.color === 'blue') award('diary'); else toast('きれいな星。でも、日記が教えているのは別の色みたい。'); break;
      case 'reveal': $('#secret-ink').classList.toggle('revealed'); target.textContent = $('#secret-ink').classList.contains('revealed') ? '☼ 明かりを消す' : '☼ 文字を照らす'; break;
      case 'cat': showDialog('ねこのひるね', '<p class="pixel-cat center"> /\\_/\\<br>( -.- ) z Z<br> &gt; ^ &lt;</p><p class="center">管理人は、ただいまお昼寝中です。<br>用事がなくても、いていい場所。</p><div class="center"><button data-action="pet-cat">そっと、なでる</button></div>'); break;
      case 'pet-cat': showDialog('ねこのひるね', '<p class="pixel-cat center"> /\\_/\\<br>( ^.^ )<br> &gt; ^ &lt;</p><p class="center">ごろごろ、ごろごろ。<br>……もうちょっとだけ、休んでいこう。</p>'); tone(392, .2); break;
      case 'music-room': showDialog('おとの小箱', '<p>小さなオルゴールを、ひとつ置いておきます。<br>夜中なので、ボリュームはひかえめに。</p><p class="small dim">オリジナルの短いメロディーをブラウザー内で合成します。ファイルの取得や外部への接続はありません。</p><button data-action="sound">♫ BGM の ON / OFF を切り替える</button>'); break;
      case 'ring': toast('ぐるっとまわって、戻ってきました。小さなウェブリングです。'); break;
      case 'mail': showDialog('そら宛のメール', '<p>宛先：2001年の、そら</p><p>このメールアドレスは、もう使われていません。<br>でも、<a href="#bbs">掲示板</a>に足跡を残すことはできます。</p><p class="small dim">実際のメール送信は行いません。</p>'); break;
      case 'lamp': {
        if (state.found.works) break;
        const index = Number(target.dataset.index), row = Math.floor(index / 3), col = index % 3;
        [index, ...(row > 0 ? [index - 3] : []), ...(row < 2 ? [index + 3] : []), ...(col > 0 ? [index - 1] : []), ...(col < 2 ? [index + 1] : [])].forEach(i => lamps[i] = !lamps[i]);
        lampMoves++;
        if (lamps.every(on => !on)) award('works');
        else {
          document.querySelectorAll('.lamp').forEach((b, i) => { b.classList.toggle('on', lamps[i]); b.setAttribute('aria-pressed', String(lamps[i])); b.textContent = lamps[i] ? 'ON' : 'OFF'; });
          $('#lamp-moves').textContent = `${lampMoves} 回操作`;
        }
        break;
      }
      case 'reset-lamps': lamps = [true, false, false, false, true, false, false, false, true]; lampMoves = 0; render(false); toast('ランプを最初の配置に戻しました。'); break;
      case 'play-stars': playStars(); break;
      case 'sky-star': {
        if (!starReady || starPlaying) break;
        const index = Number(target.dataset.index);
        tone([523, 587, 659, 784][index], .25);
        if (index !== sequence[starIndex]) { starIndex = 0; $('#star-message').textContent = 'ちょっと違うみたい。もう一度、最初の星からどうぞ。'; break; }
        starIndex++;
        if (starIndex === sequence.length) { starReady = false; award('stars'); }
        else $('#star-message').textContent = `届いているみたい。次の星は？（${starIndex} / 4）`;
        break;
      }
      case 'souvenir': showDialog('キリ番 2001 記念', '<p class="center">★ 未来から来たお客様へ ★</p><p class="center">「あのころの自分が作ったものを、<br>いまのだれかが、好きでいてくれる。」</p><p class="center">それって、ちょっとすてきだと思いませんか。</p><p class="center small dim">ほしぞら通信　2001.08.31<br>ご訪問、ありがとうございました。</p>'); break;
      case 'reset-confirm': showDialog('記録を消しますか？', '<p>集めたかけら、ヒントの閲覧状況、BBSへの書き込みを、このブラウザーから削除します。元には戻せません。</p><div class="dialog-actions"><button data-action="reset">消して最初から遊ぶ</button><button data-action="close-dialog">やめる</button></div>'); break;
      case 'reset': state = defaultState(); lamps = [true, false, false, false, true, false, false, false, true]; lampMoves = 0; trail.length = 0; route = 'home'; mute(); save(); applyMotion(); dialog.close(); if (location.hash === '#home' || !location.hash) render(false); else location.hash = 'home'; toast('新しい足跡で、もう一度。'); break;
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!['bbs-form', 'lost-form', 'secret-form'].includes(form.id)) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.id === 'bbs-form') {
      const number = normalize(data.get('number') || '');
      if (number && !/^\d{1,6}$/.test(number)) { toast('キリ番は、6桁までの数字で教えてください。'); return; }
      const name = String(data.get('name') || '').trim().slice(0, 24) || '通りすがり';
      const message = String(data.get('message') || '').trim().slice(0, 240) || (number ? `キリ番 ${number} を踏みました！` : '足跡を残していきます。');
      state.posts.unshift({ name, message }); state.posts = state.posts.slice(0, 12); save();
      if (number && Number(number) === 2001 && !state.found.bbs) award('bbs');
      else { render(false); toast(number && Number(number) !== 2001 ? '足跡を残しました。プレゼントのキリ番は、トップのカウンターを見てみてね。' : '足跡を残しました。来てくれて、ありがとう！'); }
    } else if (form.id === 'lost-form') {
      if (['よりみち', '寄り道'].includes(normalize(data.get('answer')))) award('links');
      else toast('残された余白に、もう少し目をこらしてみよう。');
    } else {
      if (count() !== 5) { toast('まだかけらが足りません。5つの場所を、もう一度探してみよう。'); return; }
      if (['ほしのうみ', '星の海'].includes(normalize(data.get('answer')))) { state.complete = true; save(); render(true); tone(784, .9); }
      else toast('かけらを、メニューの上から順に読んでみよう。');
    }
  });
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); render(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { mute(); if (route === 'stars') render(false); }
  });
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', () => { applyMotion(); if (route === 'stars') render(false); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  document.addEventListener('pointerover', event => {
    const a = event.target.closest('a[href^="#"]');
    if (a) { const key = a.getAttribute('href').slice(1); if (files[key]) $('#status').textContent = `→ hoshizora.local/~sora/${files[key]}`; }
  });
  applyMotion(); render(); save();
})();
