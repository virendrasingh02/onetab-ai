import { useTheme } from '@org/design-system';
import { Toaster as SonnerToaster, toast } from 'sonner';

export { toast };

export interface ToasterProps {
  position?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center';
  size?: 'comfy' | 'compact';
  richColors?: boolean;
  expand?: boolean;
  closeButton?: boolean;
  duration?: number | null;
  visibleToasts?: number;
}

export function Toaster({
  position = 'bottom-right',
  size = 'comfy',
  richColors = true,
  closeButton = false,
  duration = 5000,
  visibleToasts = 3,
  ...props
}: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const effectiveDuration =
    duration === null || duration === undefined ? Infinity : duration;

  return (
    <SonnerToaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={position}
      richColors={richColors}
      closeButton={closeButton}
      duration={effectiveDuration}
      visibleToasts={visibleToasts}
      toastOptions={{
        className:
          size === 'compact'
            ? 'rounded-lg border shadow-md font-sans text-[11px] py-2 px-3.5 notif-size-compact'
            : 'rounded-xl border shadow-lg font-sans text-xs py-3.5 px-4 notif-size-comfy',
      }}
      {...props}
    />
  );
}

