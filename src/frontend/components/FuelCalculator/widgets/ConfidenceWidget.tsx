
interface ConfidenceWidgetProps {
  fuelData: any;
  confidence: 'high' | 'medium' | 'low';
}

export const ConfidenceWidget = ({ fuelData, confidence }: ConfidenceWidgetProps) => {
  if (fuelData && confidence === 'high') return null;

  return (
    <div className="mt-1 px-1 py-0.5 bg-orange-500/10 border-l-2 border-orange-500 text-[9px] text-orange-400 text-center rounded w-full">
      {!fuelData 
        ? 'Waiting for data...'
        : confidence === 'low'
           ? 'Low confidence - need more laps'
           : 'Medium confidence'}
    </div>
  );
};
