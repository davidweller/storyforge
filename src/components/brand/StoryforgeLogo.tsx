import Image from 'next/image';
import { cn } from '@/lib/utils';

interface StoryforgeLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}

export function StoryforgeLogo({
  size = 28,
  showWordmark = true,
  className,
  wordmarkClassName,
}: StoryforgeLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/storyforge-logo.png"
        alt=""
        width={size}
        height={size}
        className="rounded-lg shrink-0"
        priority
      />
      {showWordmark ? (
        <span
          className={cn(
            'font-semibold text-foreground font-sans tracking-tight',
            wordmarkClassName,
          )}
        >
          StoryForge
        </span>
      ) : null}
    </span>
  );
}
