// waiting-list：わんコメの参加型管理（待機リスト）を一覧表示するテンプレート
// わんコメの参加型管理の設定（OBS用テンプレート・行／列・空のときの表記）は使わない。全部ここで決める
//
// 設定は config.js か URLパラメータで変える（URLが優先。どちらもなければ既定値）
//   text={name}   1人分の表示。{name} {index} {count} {totalCount} {time} {comment} が使える
//                 {index} があるときは番号の欄を出さない。プレイ中の人は {index} をまわりの記号ごと消す
//   layout=row    row（縦に並べる） / column（横に並べる）
//   empty=参加者募集中！ 待っている人が0人のときに出す文字（空なら何も出さない）
//   size=24       文字の大きさ(px)
//   color=ffffff  文字の色（#なしの16進）
//   play=ffd23e   プレイ中の人の色
//   playlabel=PLAY プレイ中の人の番号の代わりに出す文字
//   bg=0          背景の黒の濃さ(0〜100)。0は背景なしで、文字の黒い縁取りだけ
//   font=udev     udev（同梱のUDEV Gothic） / bizud（BIZ UDゴシック） / sans（游ゴシックなど）
//   icon=1        0でアイコンを出さない
//   max=8         出す人数。超えた分は「ほか n人」
//   demo=1        ダミーで確認（all で全員一度に出す、empty で0人のとき、playing でプレイ中の人だけ）
const params = new URLSearchParams()
for (const [k, v] of Object.entries(window.WAITING_LIST_CONFIG || {})) params.set(k, String(v))
for (const [k, v] of new URLSearchParams(location.search)) params.set(k, v)

function num(name, def, min, max) {
  const v = Number(params.get(name))
  if (!params.has(name) || params.get(name) === '' || Number.isNaN(v)) return def
  return Math.min(max, Math.max(min, v))
}
function pick(name, def, choices) {
  const v = params.get(name)
  return choices.includes(v) ? v : def
}
function color(name, def) {
  const v = params.get(name) || ''
  return /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? '#' + v : def
}

const SIZE = num('size', 24, 10, 80)
const TEXT_COLOR = color('color', '#ffffff')
const PLAY_COLOR = color('play', '#ffd23e')
const PLAY_LABEL = params.has('playlabel') ? params.get('playlabel') : 'PLAY'
const BG = num('bg', 0, 0, 100)
const FONT = pick('font', 'udev', ['udev', 'bizud', 'sans'])
const SHOW_ICON = params.get('icon') !== '0'
const MAX = Math.round(num('max', 8, 1, 50))
const TEXT = params.get('text') || '{name}'
const LAYOUT = pick('layout', 'row', ['row', 'column'])
const EMPTY_TEXT = params.has('empty') ? params.get('empty') : '参加者募集中！'

const FONTS = {
  udev: '"Waiting List UDEV", "BIZ UDGothic", "BIZ UDゴシック", monospace',
  bizud: '"BIZ UDGothic", "BIZ UDゴシック", monospace',
  sans: '"Noto Sans JP", "Yu Gothic UI", "Yu Gothic", "Hiragino Sans", sans-serif',
}

const root = document.documentElement
root.style.setProperty('--size', SIZE + 'px')
root.style.setProperty('--text', TEXT_COLOR)
root.style.setProperty('--play', PLAY_COLOR)
root.style.setProperty('--bg-alpha', BG / 100)
root.style.setProperty('--font', FONTS[FONT])
// 番号の欄の幅：2桁の番号（1.9文字分）か、PLAYの文字（行の文字の0.65倍。全角は1、半角は0.6文字分）の広いほう
const labelUnits = [...PLAY_LABEL].reduce((n, c) => n + (/[\u0000-ÿ｡-ﾟ]/.test(c) ? 0.6 : 1), 0)
root.style.setProperty('--no-width', Math.ceil(Math.max(SIZE * 1.9, SIZE * 0.65 * labelUnits + 4)) + 'px')
if (BG > 0) root.classList.add('has-bg')
if (LAYOUT === 'column') root.classList.add('layout-column')

// waitingListイベントの形はドキュメントにないので、配列そのもの・{orders:[...]}・{data:[...]} のどれでも受ける
function toList(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.orders)) return payload.orders
  if (payload && Array.isArray(payload.data)) return payload.data
  return []
}

const pad = (n) => String(n).padStart(2, '0')
function formatTime(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
// コメントはHTML（絵文字の画像など）で来るので文字だけにする
function plainText(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.textContent || '').replace(/\r|\n/g, '')
}

// プレイ中の人は番号がないので、{index} をまわりの記号ごと消す（「{index}. {name}」→「{name}」、「No.{index} {name}」「({index}) {name}」も同じ）
const INDEX_WITH_MARKS = /(?:No\.?|#|＃)?[(（[【]?\{index\}[)）\]】]?[\s.．:：、。\-－]*/gi
// わんコメ本体と同じ置き換え。index が空（プレイ中の人）なら {index} を消す
function render(template, o, index) {
  if (!index) template = template.replace(INDEX_WITH_MARKS, '')
  const values = {
    index,
    count: String(o.count ?? '-'),
    totalCount: String(o.totalCount || '-'),
    time: formatTime(o.timestamp),
    name: o.username || o.displayName || o.name || '***',
    comment: plainText(o.comment),
  }
  return template.replace(/\{(index|count|totalCount|time|name|comment)\}/g, (_, k) => values[k])
}

function demoOrders() {
  const icon = (c) =>
    'data:image/svg+xml,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="${c}"/></svg>`)
  const names = ['もちもち大福', 'Nightfarer_42', 'ゆるふわ鉄眼', 'たぬき', 'とても長い名前のリスナーさんの表示確認用', 'ほたて', 'クリムゾン', 'ねむい', 'さいごの一人', 'あふれた人']
  const colors = ['#7a8ca8', '#8c7aa8', '#a87a8c', '#7aa88c', '#a89a7a', '#7aa8a8']
  return names.map((n, i) => ({
    id: 'd' + i,
    username: n,
    profileImage: icon(colors[i % colors.length]),
    comment: '参加希望',
    count: 1,
    totalCount: i % 3 + 1,
    playing: i < 2,
    completed: false,
    timestamp: Date.now() - (10 - i) * 60000,
  }))
}

const HAS_SDK = typeof OneSDK !== 'undefined'
const DEMO = params.has('demo')
if (!HAS_SDK && !DEMO) {
  document.body.removeAttribute('hidden')
  document.body.innerHTML =
    '<div class="setup-error">waiting-list：参加型管理のデータを受け取れません。<br>' +
    'waiting-list フォルダを %APPDATA%\\onecomme\\templates\\custom\\ に入れて、<br>' +
    'URL http://localhost:11180/templates/custom/waiting-list/ で開いてください。</div>'
  throw new Error('waiting-list: OneSDK not found')
}

const app = Vue.createApp({
  setup() {
    document.body.removeAttribute('hidden')
  },
  data() {
    return { orders: [], showIcon: SHOW_ICON }
  },
  computed: {
    template() {
      return TEXT
    },
    // テンプレートに {index} があれば番号はそちらで出すので、番号の欄は出さない
    showNo() {
      return !this.template.includes('{index}')
    },
    active() {
      return this.orders.filter((o) => !o.completed)
    },
    waiting() {
      return this.active.filter((o) => !o.playing)
    },
    // プレイ中を上に、そのあと待ちを並んだ順に。待ちだけに1から番号を振る
    all() {
      const playing = this.active.filter((o) => o.playing).map((o) => ({ o, no: PLAY_LABEL }))
      const waiting = this.waiting.map((o, i) => ({ o, no: String(i + 1) }))
      return [...playing, ...waiting].map(({ o, no }, i) => ({
        key: o.id || o.commentId || o.username || i,
        text: render(this.template, o, o.playing ? '' : no),
        profileImage: o.profileImage,
        playing: !!o.playing,
        no,
      }))
    },
    rows() {
      return this.all.slice(0, MAX)
    },
    hidden() {
      return this.all.length - this.rows.length
    },
    moreText() {
      return `ほか ${this.hidden}人`
    },
    emptyText() {
      return EMPTY_TEXT
    },
    // 待っている人が0人なら（プレイ中の人がいても）0人のときの文字を出す
    emptyShown() {
      return this.waiting.length === 0 && this.emptyText !== ''
    },
    shown() {
      return this.rows.length > 0 || this.emptyShown
    },
  },
  mounted() {
    if (DEMO) {
      const list = demoOrders()
      const mode = params.get('demo')
      if (mode === 'all') { this.orders = list; return }
      if (mode === 'empty') { this.orders = []; return }
      if (mode === 'playing') { this.orders = list.slice(0, 2); return }
      // 0人から1人ずつ増やして、出る動きと空のときの表記を見られるようにする
      let n = -1
      const step = () => { n = (n + 1) % (list.length + 1); this.orders = list.slice(2, 2 + n) }
      step()
      setInterval(step, 1500)
      return
    }
    const applyOrders = (payload) => { this.orders = toList(payload) }
    OneSDK.setup({ permissions: OneSDK.usePermission([OneSDK.PERM.ORDER]) })
    OneSDK.subscribe({ action: 'waitingList', callback: applyOrders })
    OneSDK.connect()
    // 開いた時点の一覧（イベントは変化したときしか来ない）
    OneSDK.getOrders().then(applyOrders).catch((e) => console.error('getOrders', e))
  },
})

if (HAS_SDK && !DEMO) {
  OneSDK.ready().then(() => app.mount('#app'))
} else {
  app.mount('#app')
}
