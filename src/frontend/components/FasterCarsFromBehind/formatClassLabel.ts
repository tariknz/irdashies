const CLASS_LABELS: Record<string, string> = {
  HYPERCAR: 'HYPR',
  LMGT3: 'LGT3',
  LMGTE: 'LGTE',
  SUPERCARS: 'SUPR',
};

/** A compact display label; retain the session's full name for the tooltip. */
export const formatClassLabel = (name?: string | null): string => {
  const words =
    name
      ?.normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .match(/[A-Z0-9]+/g)
      ?.filter((word) => word !== 'CLASS' && !/^(19|20)\d{2}$/.test(word)) ??
    [];

  if (words.length === 0) return '—';

  const code = CLASS_LABELS[words.join('')];
  if (code) return code;

  // Preserve meaningful class codes inside names such as "BMW M4 GT4".
  const classCode = words.find((word) =>
    /^(GTP|GT[1-4]|GTE|LMP[1-3]|TCR|MX5)$/.test(word)
  );
  if (classCode) return classCode;

  // Model codes distinguish "Dallara IL15" from "Dallara P217".
  const model = words.findLast((word) => /\d/.test(word));
  if (model) return model.slice(0, 4);

  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join('')
      .slice(0, 4);
  }

  const word = words[0];
  if (word.length <= 4) return word;
  return (word[0] + word.slice(1).replace(/[AEIOU]/g, '')).slice(0, 4);
};
