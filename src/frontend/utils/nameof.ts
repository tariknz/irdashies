/**
 * Provides static typing of the name of a property. Similar to C# nameof()
 * @param name The property on type T to get the name of.
 */
export const nameof = <T>(name: keyof T) => name;
