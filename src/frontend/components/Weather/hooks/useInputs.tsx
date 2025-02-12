import { useTelemetryValue } from '@irdashies/context';

export const useInputs = () => {
    const humidity = useTelemetryValue('RelativeHumidity');
    const weatherType = useTelemetryValue('WeatherType');
    const trackAirTemp = useTelemetryValue('AirTemp');
    const trackSurfaceTemp = useTelemetryValue('PlayerTrackSurface');
    const windVelocity = useTelemetryValue('WindVel');
    const windDirection = useTelemetryValue('WindDir');

    return { humidity, weatherType, trackAirTemp, trackSurfaceTemp, windVelocity, windDirection };
};
