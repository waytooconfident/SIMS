import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/useAuthStore'
import { useDataVersion } from './stores/useDataVersion'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { InventoryView } from './views/InventoryView'
import { AnalyticsView } from './views/AnalyticsView'
import { SettingsView } from './views/SettingsView'
import { SalesRecordsView } from './views/SalesRecordsView'
import { PopoutView } from './views/PopoutView'
import { OrderWindowView } from './views/OrderWindowView'
import { LoginView } from './views/LoginView'

export type ActiveView = 'sales' | 'inventory' | 'analytics' | 'settings'

export default function App() {
  const [view, setView] = useState<ActiveView>('inventory')
  const { user, ready, bootstrap } = useAuthStore()
  const bumpDataVersion = useDataVersion((s) => s.bump)
  const isPopout = window.location.hash.startsWith('#popout')
  const isOrder = window.location.hash.startsWith('#order')

  // Pop-out / order windows piggyback on the already-logged-in main process — no gate.
  useEffect(() => { if (!isPopout && !isOrder) bootstrap() }, [isPopout, isOrder, bootstrap])

  // An order created in any window (incl. the independent order window) bumps the
  // shared data version so the inventory & sales views here refetch.
  useEffect(() => window.api.window.onOrdersChanged(() => bumpDataVersion()), [bumpDataVersion])

  if (isPopout) return <PopoutView />
  if (isOrder) return <OrderWindowView />
  if (!ready) return <div className="h-screen flex items-center justify-center bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400">載入中…</div>
  if (!user) return <LoginView />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView={view} onNavigate={setView} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar activeView={view} />

        <main className="flex-1 overflow-y-auto p-6">
          {view === 'sales'      && <SalesRecordsView />}
          {view === 'inventory'  && <InventoryView onNavigate={setView} />}
          {view === 'analytics'  && <AnalyticsView />}
          {view === 'settings'   && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
