import SiteHeader from '@/components/SiteHeader'

type Yaku = { name: string; menzen?: boolean; kuisagari?: boolean; note?: string }
type Section = { title: string; items: Yaku[]; note?: string }

const SECTIONS: Section[] = [
  {
    title: '1翻',
    items: [
      { name: '門前清自摸和', menzen: true },
      { name: '立直', menzen: true },
      {
        name: '一発',
        menzen: true,
        note: '一発役は立直に付属し、単独のアガリ役ではない。一発の権利を有する時、槍槓でアガった場合、槍槓時は槓が不成立なので一発と槍槓は複合するが、同じ理由により槓ドラはのらない。',
      },
      { name: '役牌' },
      {
        name: '平和',
        menzen: true,
        note: 'ツモアガリの場合は、ツモ符を付けず、20符《連底》計算とし、門前清自摸和と複合する。',
      },
      { name: '断公九' },
      { name: '一盃口', menzen: true },
      { name: '海底摸月' },
      { name: '河底撈魚' },
      { name: '槍槓' },
      { name: '嶺上開花' },
    ],
  },
  {
    title: '2飜',
    items: [
      { name: 'ダブル立直', menzen: true },
      { name: '連風牌' },
      { name: '対々和' },
      { name: '三暗刻' },
      { name: '三色同刻' },
      { name: '三槓子' },
      { name: '小三元' },
      { name: '混老頭' },
      { name: '三色同順', kuisagari: true },
      { name: '一気通貫', kuisagari: true },
      { name: '全帯公九', kuisagari: true },
      { name: '七対子', menzen: true, note: '25符とし散家1,600 荘家2,400' },
    ],
  },
  {
    title: '3飜',
    items: [
      { name: '二盃口', menzen: true },
      { name: '混一色', kuisagari: true },
      { name: '純全帯公九', kuisagari: true },
    ],
  },
  {
    title: '満貫',
    items: [{ name: '流し満貫' }],
  },
  {
    title: '6飜',
    items: [{ name: '清一色', kuisagari: true }],
  },
  {
    title: '8飜',
    items: [
      {
        name: '人和',
        note: '他の役と複合する。槍槓でアガった場合、槍槓時は槓が不成立なので人和と槍槓は複合するが、同じ理由により槓ドラはのらない。',
      },
    ],
  },
  {
    title: '役満',
    note: '＊純粋な役満の複合は認められる。',
    items: [
      { name: '天和', menzen: true },
      { name: '地和', menzen: true },
      { name: '国士無双', menzen: true },
      { name: '四暗刻', menzen: true },
      { name: '大三元' },
      { name: '緑一色', note: '緑發が入っていなくてもよい' },
      { name: '字一色' },
      { name: '小四喜' },
      { name: '清老頭' },
      { name: '四槓子', note: '雀頭が必要' },
      { name: '九蓮宝燈', menzen: true },
    ],
  },
  {
    title: 'ダブル役満',
    items: [
      { name: '四暗刻単騎' },
      { name: '国士無双十三面待ち', note: 'フリテンはシングル、ロン不可' },
      { name: '純正九蓮宝燈', note: 'フリテンはシングル、ロン不可' },
      { name: '大四喜' },
    ],
  },
]

const NOT_ADOPTED = ['オープン立直', '十三不塔', 'その他のローカル役']

function YakuBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded border border-line px-1.5 text-[10px] text-foreground-soft">
      {label}
    </span>
  )
}

function YakuList({ items }: { items: Yaku[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((y) => (
        <li key={y.name} className="rounded-lg border border-line bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{y.name}</span>
            {y.menzen && <YakuBadge label="◎ 門前" />}
            {y.kuisagari && <YakuBadge label="※ 食い下がり" />}
          </div>
          {y.note && <p className="mt-1 text-xs leading-relaxed text-foreground-soft">{y.note}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function RulesPage() {
  return (
    <>
      <SiteHeader active="rules" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="mb-1 font-display text-2xl font-bold">アガリ役</h1>
        <p className="mb-8 text-sm text-foreground-soft">
          このグループで採用しているアガリ役の一覧。◎は門前役、※は一組でも副露すると一翻下がる役。
        </p>

        <div className="space-y-10">
          {SECTIONS.map((s) => {
            const isYakuman = s.title === '役満' || s.title === 'ダブル役満'
            return (
              <section key={s.title}>
                <h2
                  className={`mb-3 font-display text-lg font-bold ${isYakuman ? 'text-gold' : ''}`}
                >
                  {s.title}
                </h2>
                {s.note && <p className="mb-3 text-xs text-foreground-soft">{s.note}</p>}
                <YakuList items={s.items} />
              </section>
            )
          })}

          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-accent">採用しない役</h2>
            <ul className="flex flex-wrap gap-2">
              {NOT_ADOPTED.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-foreground-soft"
                >
                  {name}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  )
}
