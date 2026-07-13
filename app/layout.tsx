import type { Metadata } from 'next'
import './globals.css'
import { SidebarShell } from '@/components/sidebar-shell'
import { KnivesProvider } from '@/components/providers/knives-provider'
import { DEFAULT_SETTINGS, getSettings } from '@/lib/settings'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Geist, Geist_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'BladeVault | Knife Collection',
  description: 'Manage your local knife collection.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
}

function getInitialTheme() {
  try {
    return getSettings().theme
  } catch {
    return DEFAULT_SETTINGS.theme
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = getInitialTheme()

  return (
    <html
      lang="en"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        theme === 'dark' && 'dark',
      )}
      suppressHydrationWarning
    >
      <body
        className="bg-background text-foreground font-sans h-screen w-full flex overflow-hidden"
      >
        <KnivesProvider>
          <TooltipProvider>
            <SidebarShell />
            <main className="flex-1 flex flex-col overflow-y-auto">
              {children}
            </main>
          </TooltipProvider>
        </KnivesProvider>
      </body>
    </html>
  )
}
