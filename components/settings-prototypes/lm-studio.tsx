'use client'

import { useState } from 'react'
import {
  Cloud,
  Database,
  FolderOpen,
  Info,
  Palette,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Section,
  Row,
  MonoValue,
  PrototypeNote,
  BetaBadge,
} from './shared'

const categories = [
  { id: 'general', label: 'General', icon: Database },
  { id: 'cloud', label: 'Cloud Backup', icon: Cloud, badge: true },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'about', label: 'About', icon: Info },
]

export default function LmStudioPrototype() {
  const [active, setActive] = useState('general')
  const [autoBackup, setAutoBackup] = useState(true)
  const [moveData, setMoveData] = useState(true)
  const [path, setPath] = useState('/Users/you/BladeVault/data')

  return (
    <div className="flex h-[calc(100dvh-2rem)] max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--bladevault-line)] bg-card shadow-sm">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-52 flex-col border-r border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35 p-2">
          <div className="px-2 pt-1 pb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Settings
            </div>
          </div>
          <nav className="space-y-0.5">
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

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {active === 'general' && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Section title="Local Vault" description="Where your collection lives on this device.">
                <Row
                  label="Current data folder"
                  description="The active vault used by BladeVault right now."
                >
                  <MonoValue>{path}</MonoValue>
                </Row>

                <Row
                  label="Move vault folder"
                  description="Change where images and the database are stored."
                >
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
                  description="Copy your current vault into the new folder."
                >
                  <Checkbox
                    checked={moveData}
                    onCheckedChange={(c) => setMoveData(c === true)}
                    aria-label="Move existing data"
                  />
                </Row>

                <Row label="Launch folder" description="Path saved in settings for the next launch.">
                  <MonoValue>/Users/you/BladeVault/data</MonoValue>
                </Row>
              </Section>

              <PrototypeNote>
                <strong className="text-foreground">BLADEVAULT_DATA_DIR</strong>{' '}
                is not set, so the folder above is used.
              </PrototypeNote>
            </div>
          )}

          {active === 'cloud' && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Section title="Cloud Backup Service" description="Encrypted backups and cross-device sync.">
                <Row label="Session" description="Signed in as alex@example.com">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--bladevault-local)] dark:text-[var(--bladevault-gold)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Connected
                  </span>
                </Row>

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
                  description="Upload changes automatically after edits."
                >
                  <Checkbox
                    checked={autoBackup}
                    onCheckedChange={(c) => setAutoBackup(c === true)}
                    aria-label="Enable auto backup"
                  />
                </Row>
              </Section>

              <Section title="Sync Actions">
                <Row label="Backup now" description="Upload local vault to the cloud.">
                  <Button
                    size="sm"
                    className="h-8 rounded-lg border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)] hover:bg-[var(--bladevault-title)] hover:text-[var(--bladevault-olive)]"
                  >
                    Backup Local → Cloud
                  </Button>
                </Row>
                <Row label="Restore" description="Replace local vault with the latest cloud backup.">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                  >
                    Restore Cloud → Local
                  </Button>
                </Row>
              </Section>

              <Section title="Account">
                <Row label="Sign out" description="Remove this device’s cloud session.">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                  >
                    Sign Out
                  </Button>
                </Row>
              </Section>
            </div>
          )}

          {active === 'appearance' && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Section title="Theme">
                <Row label="Appearance" description="Choose how BladeVault looks on this device.">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 rounded-lg">
                      Light
                    </Button>
                    <Button size="sm" className="h-8 rounded-lg border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)]">
                      Dark
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg">
                      System
                    </Button>
                  </div>
                </Row>
              </Section>
            </div>
          )}

          {active === 'about' && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Section title="BladeVault">
                <Row label="Version" description="0.2.18" />
                <Row label="Build" description="desktop-compatible" />
                <Row label="License" description="MIT">
                  <Button variant="link" size="sm" className="h-8 px-0">
                    View license
                  </Button>
                </Row>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
