import { useSessionStore, useDriverCarIdx } from '@irdashies/context';

/**
 * `CarPath` for the car the player is in, or undefined when session data has
 * not arrived yet or the player has no entry in it (spectating a session joined
 * midway, for instance).
 *
 * Read from session info rather than carried on the car-systems snapshot. The
 * processor discovers the adjustment *set* from telemetry because iRacing only
 * publishes it from inside the car, but which car that is was already in
 * session info all along — and threading it through the channel would mean
 * resetting the processor on a car change, which is the blink that
 * `CarSystemsProcessor.init` deliberately avoids.
 *
 * The lookup happens inside the selector so the subscription compares a string.
 * Selecting `session` and digging afterwards would re-render the widget on
 * every session update — iRacing republishes those every second or two — for a
 * value that changes when the driver changes car and at no other time.
 */
export const usePlayerCarPath = (): string | undefined => {
  const driverCarIdx = useDriverCarIdx();

  return useSessionStore(
    (state) =>
      state.session?.DriverInfo?.Drivers?.find(
        (driver) => driver.CarIdx === driverCarIdx
      )?.CarPath
  );
};
