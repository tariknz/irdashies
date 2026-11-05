export interface Pattern {
  match: RegExp;
  replace: (match: RegExpMatchArray) => string;
}

export interface Translator {
  /** Raw text in, translation (outer whitespace preserved) or undefined out. */
  translateText(text: string): string | undefined;
}

export const TRANSLATED_ATTRIBUTES = [
  'title',
  'placeholder',
  'aria-label',
  'alt',
] as const;

const HAS_LATIN = /[A-Za-z]/;
const SKIP_SELECTOR =
  'input,textarea,code,pre,kbd,script,style,[translate="no"]';
// Elements whose own attributes (placeholder, title) are still translated.
const ATTRIBUTE_SKIP_SELECTOR = 'code,pre,kbd,script,style,[translate="no"]';

export const normalizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

export const createTranslator = (
  dict: ReadonlyMap<string, string>,
  patterns: readonly Pattern[]
): Translator => ({
  translateText(text) {
    if (!HAS_LATIN.test(text)) return undefined;
    const key = normalizeText(text);
    let translated = dict.get(key);
    if (translated === undefined) {
      for (const { match, replace } of patterns) {
        const result = key.match(match);
        if (result) {
          translated = replace(result);
          break;
        }
      }
    }
    if (translated === undefined) return undefined;
    const lead = text.match(/^\s*/)?.[0] ?? '';
    const trail = text.match(/\s*$/)?.[0] ?? '';
    return lead + translated + trail;
  },
});

export const startDomTranslation = (
  root: Node,
  translator: Translator,
  options: { onMissing?: (text: string) => void } = {}
): (() => void) => {
  const reported = new Set<string>();
  // Last value written by us per node/attribute, so our own output (which may
  // contain Latin, e.g. "iRating") is never re-processed or reported.
  const writtenText = new WeakMap<Node, string>();
  const writtenAttrs = new WeakMap<Element, Map<string, string>>();

  const resolve = (value: string): string | undefined => {
    if (!HAS_LATIN.test(value)) return undefined;
    const translated = translator.translateText(value);
    if (translated === undefined) {
      const key = normalizeText(value);
      if (options.onMissing && !reported.has(key)) {
        reported.add(key);
        options.onMissing(key);
      }
    }
    return translated;
  };

  const translateTextNode = (node: Text) => {
    const value = node.data;
    if (writtenText.get(node) === value) return;
    const parent = node.parentElement;
    if (parent?.closest(SKIP_SELECTOR)) return;
    const translated = resolve(value);
    if (translated !== undefined && translated !== value) {
      writtenText.set(node, translated);
      node.data = translated;
    }
  };

  const translateAttribute = (el: Element, name: string) => {
    const value = el.getAttribute(name);
    if (value === null || writtenAttrs.get(el)?.get(name) === value) return;
    if (el.closest(ATTRIBUTE_SKIP_SELECTOR)) return;
    const translated = resolve(value);
    if (translated !== undefined && translated !== value) {
      let attrs = writtenAttrs.get(el);
      if (!attrs) {
        attrs = new Map();
        writtenAttrs.set(el, attrs);
      }
      attrs.set(name, translated);
      el.setAttribute(name, translated);
    }
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
      return;
    }
    if (
      node.nodeType !== Node.ELEMENT_NODE &&
      node.nodeType !== Node.DOCUMENT_NODE &&
      node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) {
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.matches(ATTRIBUTE_SKIP_SELECTOR)) return;
      for (const name of TRANSLATED_ATTRIBUTES) translateAttribute(el, name);
      if (el.matches(SKIP_SELECTOR)) return;
    }
    node.childNodes.forEach(walk);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        if (record.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(record.target as Text);
        }
      } else if (record.type === 'attributes') {
        if (record.attributeName && record.target.nodeType === 1) {
          translateAttribute(record.target as Element, record.attributeName);
        }
      } else {
        record.addedNodes.forEach(walk);
      }
    }
  });

  walk(root);
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRIBUTES],
  });

  return () => observer.disconnect();
};
