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
  richColors?: boolean;
  expand?: boolean;
  closeButton?: boolean;
  duration?: number;
  visibleToasts?: number;
}

export function Toaster({
  position = 'bottom-right',
  richColors = true,
  closeButton = false,
  duration = 3000,
  visibleToasts = 1,
  ...props
}: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={position}
      richColors={richColors}
      closeButton={closeButton}
      duration={duration}
      visibleToasts={visibleToasts}
      toastOptions={{
        className: 'rounded-xl border shadow-lg font-sans text-xs',
      }}
      {...props}
    />
  );
}
