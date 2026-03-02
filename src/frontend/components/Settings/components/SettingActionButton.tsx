interface SettingActionButtonProps {
  label: string;
  onClick: () => void;
}

export function SettingActionButton({ label, onClick }: SettingActionButtonProps) {
  return (
    <div className="flex justify-end mb-2">
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors`}
    >
      {label}
    </button>
    </div>
  );
}