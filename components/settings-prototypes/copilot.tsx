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
import { Section, Row, MonoValue, BetaBadge } from './shared'

const tabs = [
  { id: 'general', label: 'General', icon: Database },
  { id: 'cloud', label: 'Cloud Backup', icon: Cloud },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'about', label: 'About', icon: Info },
]

export default function CopilotPrototype() {
  const [active, setActive] = useState('general')
  const [autoBackup, setAutoBackup] = useState(true)
  const [moveData, setMoveData] = useState(true)
  const [path, setPath] = useState('/Users/you/BladeVault/data')

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-[var(--bladevault-surface-hover)] hover:text-foreground'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === 'cloud' ? <BetaBadge /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {active === 'general' && (
          <>
            <Section title="Local Vault">
              <Row label="Current folder">
                <MonoValue>{path}</MonoValue>
              </Row>
              <Row label="Move folder">
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
                description="Copy everything into the new location."
              >
                <Checkbox
                  checked={moveData}
                  onCheckedChange={(c) => setMoveData(c === true)}
                  aria-label="Move existing data"
                />
              </Row>
            </Section>

            <div className="rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> When
              running in Docker, the host mount path is shown in read-only mode.
            </div>
          </>
        )}

        {active === 'cloud' && (
          <>
            <Section title="Cloud Backup" description="Beta">
              <Row label="Session status">
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
                description="Upload after every change."
              >
                <Checkbox
                  checked={autoBackup}
                  onCheckedChange={(c) => setAutoBackup(c === true)}
                  aria-label="Enable auto backup"
                />
              </Row>
            </Section>

            <Section title="Actions">
              <Row label="Manual backup">
                <Button
                  size="sm"
                  className="h-8 rounded-lg border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)] hover:bg-[var(--bladevault-title)] hover:text-[var(--bladevault-olive)]"
                >
                  Backup Now
                </Button>
              </Row>
              <Row label="Restore from cloud">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] hover:bg-[var(--bladevault-surface-hover)]"
                >
                  Restore
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
            <Row label="Theme" description="Matches your system by default.">
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
          <Section title="About BladeVault">
            <Row label="Version" description="0.2.18" />
            <Row label="License" description="MIT" />
          </Section>
        )}
      </div>
    </div>
  )
}
