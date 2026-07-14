import Link from 'next/link'

const prototypes = [
  {
    id: 'lm-studio',
    label: 'LM Studio style',
    description:
      'Vertical sidebar categories with tight label/control rows. Very compact and scannable.',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot app style',
    description:
      'Top icon tab bar with grouped cards and plenty of whitespace, like macOS preferences.',
  },
  {
    id: 'openwebui',
    label: 'OpenWebUI style',
    description:
      'Searchable left sidebar plus dense grouped sections. Most information-dense.',
  },
]

export default function SettingsPrototypesIndex() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-lg font-semibold text-foreground">
        Settings layout prototypes
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Click a prototype to preview it in the browser. These are standalone
        pages using mocked data so we can compare the feel before changing the
        real settings modal.
      </p>

      <div className="space-y-3">
        {prototypes.map((p) => (
          <Link
            key={p.id}
            href={`/settings-prototype/${p.id}`}
            className="block rounded-xl border border-[var(--bladevault-line)] bg-card p-4 transition-colors hover:bg-[var(--bladevault-surface-soft)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {p.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.description}
                </div>
              </div>
              <span className="text-sm text-[var(--bladevault-olive)] dark:text-[var(--bladevault-gold)]">
                Preview →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 px-3 py-2 text-xs text-muted-foreground">
        Note: the real settings modal will keep all existing functionality
        (live API calls, auth flow, data folder moves, etc.). These prototypes
        only change layout and density.
      </div>
    </div>
  )
}
