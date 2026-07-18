import Image from 'next/image'
import Link from 'next/link'
import { memo, useCallback, useState } from 'react'
import { ImageIcon, Scale } from 'lucide-react'
import { getImageUrl, Knife } from '@/lib/data'
import { cn } from '@/lib/utils'
import { BookmarkIcon } from '@/components/bookmark-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useKnives } from '@/components/providers/knives-provider'
import {
  activeKnifeActionStyle,
  activeKnifeFloatingClassName,
} from '@/lib/knife-action-styles'

export const KnifeCard = memo(function KnifeCard({
  knife,
  eager = false,
}: {
  knife: Knife
  eager?: boolean
}) {
  const {
    updateKnife,
    compareIds,
    addToCompare,
    removeFromCompare,
    pinnedItemsFirst,
    showFeedback,
  } = useKnives()
  const pinned = knife.pinned
  const inCompare = compareIds.includes(knife.id)
  const [isTogglingPin, setIsTogglingPin] = useState(false)
  const [isTogglingCompare, setIsTogglingCompare] = useState(false)

  const handlePinClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        setIsTogglingPin(true)
        await updateKnife(knife.id, { pinned: !pinned })
        showFeedback(
          pinned
            ? 'Unpinned'
            : pinnedItemsFirst
              ? 'Pinned — moved to top'
              : 'Pinned',
        )
      } catch (error) {
        showFeedback(
          error instanceof Error ? error.message : 'Could not update pin.',
          'error',
        )
      } finally {
        setIsTogglingPin(false)
      }
    },
    [updateKnife, knife.id, pinned, pinnedItemsFirst, showFeedback],
  )

  const handleCompareClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        setIsTogglingCompare(true)
        if (inCompare) {
          await removeFromCompare(knife.id)
          showFeedback('Removed from compare')
        } else {
          await addToCompare(knife.id)
          showFeedback('Added to compare')
        }
      } catch (error) {
        showFeedback(
          error instanceof Error
            ? error.message
            : 'Could not update comparison.',
          'error',
        )
      } finally {
        setIsTogglingCompare(false)
      }
    },
    [addToCompare, removeFromCompare, knife.id, inCompare, showFeedback],
  )

  return (
    <Link
      href={`/collection/${knife.id}`}
      className="group/card block focus:outline-none"
    >
      <Card className="overflow-hidden p-0 transition-shadow hover:shadow-sm">
        <div className="relative aspect-[4/3] w-full bg-white">
          {knife.images.length > 0 ? (
            <Image
              src={getImageUrl(knife.images[0])}
              alt={knife.name}
              fill
              loading={eager ? 'eager' : 'lazy'}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/50">
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCompareClick}
            disabled={isTogglingCompare}
            className={cn(
              'absolute left-2 top-2 z-10 rounded-full border bg-white/90 text-[var(--bladevault-olive)] backdrop-blur-sm transition-colors hover:bg-white hover:text-[var(--bladevault-olive)] dark:border-input dark:bg-input/90 dark:text-[var(--bladevault-gold)] dark:hover:bg-input dark:hover:text-[var(--bladevault-gold)]',
              inCompare && activeKnifeFloatingClassName,
            )}
            style={inCompare ? activeKnifeActionStyle : undefined}
            aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
            title={inCompare ? 'Remove from compare' : 'Add to compare'}
          >
            <Scale className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handlePinClick}
            disabled={isTogglingPin}
            className={cn(
              'absolute right-2 top-2 z-10 rounded-full border bg-white/90 text-[var(--bladevault-olive)] backdrop-blur-sm transition-colors hover:bg-white hover:text-[var(--bladevault-olive)] dark:border-input dark:bg-input/90 dark:text-[var(--bladevault-gold)] dark:hover:bg-input dark:hover:text-[var(--bladevault-gold)]',
              pinned && activeKnifeFloatingClassName,
            )}
            style={pinned ? activeKnifeActionStyle : undefined}
            aria-label={pinned ? 'Unpin knife' : 'Pin knife'}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            <BookmarkIcon active={pinned} />
          </Button>
        </div>
        <CardContent className="pt-0">
          <div className="mb-2">
            <Badge
              variant="secondary"
              className="text-[10px] font-medium uppercase tracking-wide"
            >
              {knife.brand}
            </Badge>
          </div>
          <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {knife.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {knife.bladeStyle} · {knife.handleMaterial}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
})
