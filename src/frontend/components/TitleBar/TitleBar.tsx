import { useEffect, useState } from 'react';
import {
  MinusIcon,
  CornersOutIcon,
  CornersInIcon,
  XIcon,
} from '@phosphor-icons/react';
import logoSvg from '../../assets/icons/logo.svg';

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

export const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.windowControlsBridge.isMaximized().then(setIsMaximized);
    const unsubscribe =
      window.windowControlsBridge.onMaximizeChange(setIsMaximized);
    return unsubscribe;
  }, []);

  return (
    <div
      className="flex items-center justify-between h-9 bg-slate-800 select-none shrink-0  rounded-md overflow-hidden"
      style={dragStyle}
    >
      <div className="flex items-center gap-2 px-4">
        <img src={logoSvg} alt="" className="h-4 w-4" />
        <span className="text-white text-s font-semibold tracking-wide">
          iRDashies
        </span>
      </div>

      <div className="flex items-center h-full" style={noDragStyle}>
        <TitleBarButton
          onClick={() => window.windowControlsBridge.minimize()}
          label="Minimize"
        >
          <MinusIcon size={12} />
        </TitleBarButton>

        <TitleBarButton
          onClick={() => window.windowControlsBridge.maximize()}
          label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <CornersInIcon size={11} />
          ) : (
            <CornersOutIcon size={11} />
          )}
        </TitleBarButton>

        <TitleBarButton
          onClick={() => window.windowControlsBridge.close()}
          label="Close"
          hoverClass="hover:bg-red-600"
        >
          <XIcon size={12} />
        </TitleBarButton>
      </div>
    </div>
  );
};

TitleBar.displayName = 'TitleBar';

function TitleBarButton({
  onClick,
  label,
  children,
  hoverClass = 'hover:bg-slate-700',
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  hoverClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex items-center justify-center w-11 h-9 text-gray-400 hover:text-white transition-colors duration-100 ${hoverClass}`}
    >
      {children}
    </button>
  );
}
