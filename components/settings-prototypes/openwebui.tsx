'use client'

import { useState } from 'react'
import {
  Cloud,
  Database,
  FolderOpen,
  Info,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Section, Row, MonoValue, BetaBadge } from './shared'

const categories = [
  { id: 'general', label: 'General', icon: Database },
  { id: 'cloud', label: 'Cloud Backup', icon: Cloud, badge: true },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'about', label: 'About', icon: Info },
]

export default function OpenWebUIPrototype() {
  const [active, setActive] = useState('general')
  const [autoBackup, setAutoBackup] = useState(true)
  const [moveData, setMoveData] = useState(true)
  const [path, setPath] = useState('/Users/you/BladeVault/data')

  return (
    <div className="flex h-[calc(100dvh-2rem)] max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--bladevault-line)] bg-card shadow-sm">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-60 flex-col border-r border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35">
          <div className="border-b border-[var(--bladevault-line)] p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search settings..."
                className="h-8 rounded-lg border-[var(--bladevault-line)] bg-card pl-8 text-xs shadow-none"
              />
            </div>
          </div>
          <nav className="space-y-0.5 p-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  active === cat.id
                    ? 'bg-card font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-[var(--bladevault-surface-hover)] hover:text-foreground'
                }`}
              >
                <cat.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{cat.label}</span>
                {cat.badge ? <BetaBadge /> : null}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[var(--bladevault-line)] bg-card px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              {categories.find((c) => c.id === active)?.label}
            </h2>
          </div>

          <div className="p-5">
            <div className="mx-auto max-w-3xl space-y-3">
              {active === 'general' && (
                <>
                  <Section title="Local Vault">
                    <Row label="Current folder">
                      <MonoValue>{path}</MonoValue>
                    </Row>
                    <Row label="Change folder">
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Input
                          value={path}
                          onChange={(e) => setPath(e.target.value)}
                          className="h-8 min-w-[12rem] rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] font-mono text-xs shadow-none"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          Choose
                        </Button>
                      </div>
                    </Row>
                    <Row
                      label="Move existing data"
                      description="Migrate current data to the new folder."
                    >
                      <Checkbox
                        checked={moveData}
                        onCheckedChange={(c) => setMoveData(c === true)}
                        aria-label="Move existing data"
                      />
                    </Row>
                    <Row label="Launch folder">
                      <MonoValue>/Users/you/BladeVault/data</MonoValue>
                    </Row>
                  </Section>

                  <Section title="Environment">
                    <Row label="BLADEVAULT_DATA_DIR" description="Not set — using configured folder." />
                    <Row label="Containerized" description="No" />
                  </Section>
                </>
              )}

              {active === 'cloud' && (
                <>
                  <Section title="Cloud Backup" description="Beta">
                    <Row label="Session">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--bladevault-local)] dark:text-[var(--bladevault-gold)]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Connected
                      </span>
                    </Row>
                    <Row label="Account" description="alex@example.com" />
                    <Row label="Last sync" description="Jul 12, 2026, 9:41 AM">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </Button>
                    </Row>
                    <Row
                      label="Auto backup"
                      description="Upload after local changes."
                    >
                      <Checkbox
                        checked={autoBackup}
                        onCheckedChange={(c) => setAutoBackup(c === true)}
                        aria-label="Enable auto backup"
                      />
                    </Row>
                  </Section>

                  <Section title="Actions">
                    <Row label="Backup now">
                      <Button
                        size="sm"
                        className="h-8 rounded-lg border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)] hover:bg-[var(--bladevault-title)] hover:text-[var(--bladevault-olive)]"
                      >
                        Backup Local → Cloud
                      </Button>
                    </Row>
                    <Row label="Restore from cloud">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                      >
                        Restore Cloud → Local
                      </Button>
                    </Row>
                    <Row label="Account">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                      >
                        Sign Out
                      </Button>
                    </Row>
                  </Section>
                </>
              )}

              {active === 'appearance' && (
                <Section title="Appearance">
                  <Row label="Theme">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 rounded-lg">
                        Light
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 rounded-lg border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)]"
                      >
                        Dark
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg">
                        System
                      </Button>
                    </div>
                  </Row>
                </Section>
              )}

              {active === 'about' && (
                <Section title="About">
                  <Row label="Version" description="0.2.18" />
                  <Row label="License" description="MIT" />
                </Section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
