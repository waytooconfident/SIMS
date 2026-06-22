import { TrendingUp, DollarSign, ShoppingCart, Percent } from 'lucide-react'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function StatCard({ icon, label, value, sub, accent = 'indigo' }: StatCardProps) {
  const accentMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50 text-green-600',
    blue:   'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600'
  }
  return (
    <div className="card px-5 py-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${accentMap[accent] ?? accentMap['indigo']}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

interface StatsCardsProps {
  totalEarnings: number   // 總收益 = Σ(淨利潤 × 銷售量)
  totalCost: number       // 總成本 (NTD)
  totalSales: number
  avgMargin: number       // 淨利潤 ÷ 成本 (%)
}

export function StatsCards({ totalEarnings, totalCost, totalSales, avgMargin }: StatsCardsProps) {
  const fmt = (n: number) =>
    n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        icon={<DollarSign size={20} />}
        label="總收益 (淨利潤×銷售量)"
        value={`NT$ ${fmt(totalEarnings)}`}
        sub={totalEarnings >= 0 ? '盈利' : '虧損'}
        accent={totalEarnings >= 0 ? 'green' : 'orange'}
      />
      <StatCard
        icon={<TrendingUp size={20} />}
        label="總成本 (NTD)"
        value={`NT$ ${fmt(totalCost)}`}
        accent="indigo"
      />
      <StatCard
        icon={<ShoppingCart size={20} />}
        label="總銷售量"
        value={`${fmt(totalSales)} 件`}
        accent="blue"
      />
      <StatCard
        icon={<Percent size={20} />}
        label="淨利率 (利潤÷成本)"
        value={`${avgMargin.toFixed(1)}%`}
        accent={avgMargin >= 0 ? 'green' : 'orange'}
      />
    </div>
  )
}
