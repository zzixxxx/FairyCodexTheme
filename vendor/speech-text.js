/* Fairy-DSH speech normalization and sentence splitting. Copyright 2026 Chengzhibense. Apache-2.0. Adapted for Codex. */
(()=>{
const MAX_SENTENCE_LENGTH=40;
const safeText=value=>String(value||" ").replace(/\s+/g," ").trim();
const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const ROMAN_CHARS = new Map([
  ['Ⅰ', '一'], ['Ⅱ', '二'], ['Ⅲ', '三'], ['Ⅳ', '四'], ['Ⅴ', '五'], ['Ⅵ', '六'],
  ['Ⅶ', '七'], ['Ⅷ', '八'], ['Ⅸ', '九'], ['Ⅹ', '十'], ['Ⅺ', '十一'], ['Ⅻ', '十二'],
  ['ⅰ', '一'], ['ⅱ', '二'], ['ⅲ', '三'], ['ⅳ', '四'], ['ⅴ', '五'], ['ⅵ', '六'],
  ['ⅶ', '七'], ['ⅷ', '八'], ['ⅸ', '九'], ['ⅹ', '十'],
]);

function romanToNumber(value) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    const current = ROMAN_VALUES[value[index]];
    const next = ROMAN_VALUES[value[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total;
}

function numberToChinese(value) {
  if (!Number.isInteger(value) || value < 0 || value > 3999) return String(value);
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千'];
  const chars = String(value).split('').map(Number);
  let output = '';
  for (let index = 0; index < chars.length; index += 1) {
    const digit = chars[index];
    const unitIndex = chars.length - index - 1;
    if (digit === 0) {
      if (output && !output.endsWith('零') && chars.slice(index + 1).some(Boolean)) output += '零';
      continue;
    }
    if (!(digit === 1 && unitIndex === 1 && output === '')) output += digits[digit];
    output += units[unitIndex];
  }
  return output || '零';
}

function numberForSpeech(value) {
  const text = String(value).replace(/,/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return text;
  const [integer, fraction] = text.split('.');
  const integerText = numberToChinese(Number(integer));
  return fraction ? `${integerText}点${[...fraction].map((digit) => ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][Number(digit)]).join('')}` : integerText;
}

function decimalForSpeech(sign, integer, fraction) {
  return `${sign ? '负' : ''}${numberForSpeech(`${integer || '0'}.${fraction}`)}`;
}

function timeForSpeech(hour, minute, second) {
  const parts = [`${numberForSpeech(hour)}点`];
  if (minute !== undefined) parts.push(`${numberForSpeech(minute)}分`);
  if (second !== undefined) parts.push(`${numberForSpeech(second)}秒`);
  return parts.join('');
}

const ACRONYM_WORDS = {
  AI: '人工智能', API: '接口', CPU: '中央处理器', GPU: '图形处理器', RAM: '运行内存', ROM: '只读存储器',
  USB: '优仕比', URL: '链接', URI: '链接地址', HTTP: '超文本传输协议', HTTPS: '安全超文本传输协议',
  JSON: '杰森', XML: '扩展标记语言', SQL: '数据库查询语言', UI: '用户界面', UX: '用户体验',
  SDK: '开发工具包', IDE: '开发环境', FAQ: '常见问题', CPU占用: '处理器占用',
};

const UNIT_WORDS = {
  'km/h': '千米每小时', 'm/s': '米每秒', 'm²': '平方米', 'm³': '立方米', m2: '平方米', m3: '立方米',
  Hz: '赫兹', kHz: '千赫兹', MHz: '兆赫兹', GHz: '吉赫兹',
  B: '字节', KB: '千字节', MB: '兆字节', GB: '吉字节', TB: '太字节',
  kg: '千克', g: '克', mg: '毫克', t: '吨', km: '千米', m: '米', cm: '厘米', mm: '毫米',
  L: '升', mL: '毫升', h: '小时', min: '分钟', s: '秒', ms: '毫秒', us: '微秒',
};

function replaceRomanNumerals(text) {
  let output = [...text].map((char) => ROMAN_CHARS.get(char) || char).join('');
  // Only convert standalone multi-character Roman numerals. This avoids
  // turning ordinary Latin words such as "C" or "IVF" into numbers.
  return output.replace(/(?<![A-Za-z])([IVXLCDM]{2,})(?![A-Za-z])/gi, (match) => {
    const upper = match.toUpperCase();
    const value = romanToNumber(upper);
    return value >= 1 && value <= 3999 ? numberToChinese(value) : match;
  });
}

/**
 * Convert display text into conservative, pronunciation-friendly Chinese.
 * The rules intentionally target symbols and units that commonly confuse
 * local Chinese TTS; ordinary words and normal punctuation are preserved.
 */
function normalizeSpeechText(value) {
  let text = String(value || '')
    .replace(/m²/g, 'm2').replace(/m³/g, 'm3')
    .replace(/²/g, '平方').replace(/³/g, '立方').replace(/¹/g, '一')
    .normalize('NFKC')
    // NFKC folds the compatibility semicolon to ASCII. Restore it here so
    // repeated normalization (markdown extraction plus sentence splitting)
    // remains idempotent and keeps the intended long pause.
    .replace(/;/g, '\uFF1B')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  text = replaceRomanNumerals(text)
    // Protect content whose punctuation is not meaningful to speech.
    .replace(/(?:https?|ftp):\/\/[^\s)》】]+/gi, '链接')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '邮箱地址')
    // Dates, times, ranges, ratios and fractions.
    .replace(/(\d{4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})/g, '$1年$2月$3日')
    .replace(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g, (_match, hour, minute, second) => timeForSpeech(hour, minute, second))
    .replace(/(\d+(?:\.\d+)?)\s*(?:-|~|～|至)\s*(\d+(?:\.\d+)?)/g, (_match, from, to) => `${numberForSpeech(from)}到${numberForSpeech(to)}`)
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_match, numerator, denominator) => `${numberForSpeech(denominator)}分之${numberForSpeech(numerator)}`)
    .replace(/(\d+)\s*:\s*(\d+)/g, (_match, left, right) => `${numberForSpeech(left)}比${numberForSpeech(right)}`)
    // Currency and percentages.
    .replace(/([$¥￥€£])\s*(\d[\d,]*(?:\.\d+)?)/g, (_match, sign, number) => `${numberForSpeech(number)}${({ '$': '美元', '¥': '元', '￥': '元', '€': '欧元', '£': '英镑' })[sign]}`)
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(美元|元|人民币|欧元|英镑|日元)/g, (_match, number, unit) => `${numberForSpeech(number)}${unit}`)
    .replace(/°\s*C/gi, '摄氏度')
    .replace(/°\s*F/gi, '华氏度')
    .replace(/℃/g, '摄氏度')
    .replace(/℉/g, '华氏度')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, (_match, number) => `百分之${numberForSpeech(number)}`)
    .replace(/%/g, '百分之')
    .replace(/(\d+(?:\.\d+)?)\s*(摄氏度|华氏度)/g, (_match, number, unit) => `${numberForSpeech(number)}${unit}`)
    .replace(/(\d+(?:\.\d+)?)\s*(m²|m³|m2|m3|km\/h|m\/s|kHz|MHz|GHz|KB|MB|GB|TB|Hz|kg|mg|cm|mm|ms|us|mL|L|km|m|g|t|h|min|s|B)\b/gi, (_match, number, unit) => `${numberForSpeech(number)}${UNIT_WORDS[unit] || UNIT_WORDS[unit.toLowerCase()] || unit}`)
    // Do not rewrite isolated one-letter tokens such as the B in "A/B";
    // those are usually identifiers, not units.
    .replace(/\b(km\/h|m\/s|m²|m³|kHz|MHz|GHz|KB|MB|GB|TB|Hz|kg|mg|cm|mm|ms|us|mL|min)\b/gi, (match) => UNIT_WORDS[match] || UNIT_WORDS[match.toLowerCase()] || match)
    // GPT-SoVITS first recognizes decimals, then mistakes a long fractional
    // part for an identifier and rewrites it again (3.1415926 -> 三.幺四…).
    // Make standalone decimal notation explicit before it reaches that layer.
    // Letter-adjacent values are left intact for version and identifier syntax.
    .replace(/(?<![A-Za-z0-9_.])(-?)(?:(\d[\d,]*)\.(\d+)|\.(\d+))(?![A-Za-z0-9_.])/g, (_match, sign, integer, fraction, pureFraction) => decimalForSpeech(sign, integer, fraction || pureFraction))
    // Unit normalization may have already converted a negative numeric value
    // to Chinese, leaving only its ASCII sign. Resolve that sign before the
    // model's generic punctuation cleanup can turn it into a subtraction.
    .replace(/(?<![\w])-+(?=[零一二三四五六七八九十百千万亿])/g, '负')
    // Common technical abbreviations are more reliable when spoken as words.
    .replace(/\b(AI|API|CPU|GPU|RAM|ROM|USB|URL|URI|HTTP|HTTPS|JSON|XML|SQL|UI|UX|SDK|IDE|FAQ)\b/g, (match) => ACRONYM_WORDS[match] || match)
    .replace(/\+\s*\/\s*-/g, '正负')
    .replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/g, (_match, left, right) => `${numberForSpeech(left)}加${numberForSpeech(right)}`)
    .replace(/(?<![\w])-(\d+(?:\.\d+)?)/g, (_match, number) => `负${numberForSpeech(number)}`)
    .replace(/±/g, '正负')
    .replace(/×/g, '乘')
    .replace(/÷/g, '除以')
    .replace(/≤/g, '小于等于')
    .replace(/≥/g, '大于等于')
    .replace(/≠/g, '不等于')
    .replace(/≈/g, '约等于')
    .replace(/≡/g, '恒等于')
    .replace(/∝/g, '正比于')
    .replace(/∂/g, '偏导')
    .replace(/</g, '小于')
    .replace(/>/g, '大于')
    .replace(/=/g, '等于')
    .replace(/∑/g, '求和')
    .replace(/√/g, '平方根')
    .replace(/∞/g, '无穷大')
    .replace(/∈/g, '属于')
    .replace(/∉/g, '不属于')
    .replace(/∴/g, '所以')
    .replace(/∵/g, '因为')
    .replace(/©/g, '版权')
    .replace(/®/g, '注册商标')
    .replace(/™/g, '商标')
    .replace(/°/g, '度')
    .replace(/→/g, '指向')
    .replace(/←/g, '返回')
    .replace(/&&/g, '并且')
    .replace(/\|\|/g, '或者')
    .replace(/&/g, '和')
    .replace(/@/g, '艾特')
    .replace(/#/g, '井号')
    .replace(/[αΑ]/g, '阿尔法').replace(/[βΒ]/g, '贝塔').replace(/[γΓ]/g, '伽马').replace(/[δΔ]/g, '德尔塔')
    .replace(/[λΛ]/g, '兰姆达').replace(/[μΜ]/g, '缪').replace(/[πΠ]/g, '派').replace(/[σΣ]/g, '西格玛')
    .replace(/\s*\+\s*/g, '加')
    .replace(/\.{2,}|…+/g, '……')
    // Adjacent terminal marks describe one prosodic boundary. Keeping them as
    // separate sentences creates one-syllable audio fragments ("?!" -> "?" +
    // "!") and sounds like a cut rather than a natural reaction.
    .replace(/[!?]{2,}/g, (marks) => marks.includes('?') ? '?' : '!')
    // A colon is too short for Fairy's prosody. Structural colons were
    // consumed above (times, ratios, URLs and email addresses), so prose
    // colons can safely use the stronger semicolon pause. Collapse variants
    // and repeated colons to avoid accidental double pauses.
    .replace(/[：﹕︰꞉˸]+/g, '\uFF1B')
    .replace(/:{1,}/g, '\uFF1B')
    .replace(/\uFF1B{2,}/g, '\uFF1B')
    .replace(/[—–−]+/g, '，')
    .replace(/-{2,}/g, '，')
    .replace(/,{2,}/g, '，')
    .replace(/,{1}/g, '，')
    .replace(/\s*([，。！？；：、）》】』」,.!?;:])\s*/g, '$1')
    .replace(/\s*([（《【『「])\s*/g, '$1');
  return safeText(text);
}

function splitSpeechSentences(text) {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return [];
  const raw = [];
  let current = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const previous = normalized[index - 1] || '';
    const next = normalized[index + 1] || '';
    current += char;
    // A decimal point is part of the number, not a speech boundary.
    if (char === '.' && /\d/.test(previous) && /\d/.test(next)) continue;
    if ('。！？；!?;'.includes(char) && next !== '…') {
      raw.push(current);
      current = '';
      continue;
    }
    if (char === '…' && next !== '…' && previous !== '…') {
      raw.push(current);
      current = '';
    }
  }
  if (current.trim()) raw.push(current);
  const result = [];
  for (const sentence of raw) {
    let remaining = sentence.trim();
    while (remaining.length > MAX_SENTENCE_LENGTH) {
      const boundary = Math.max(remaining.lastIndexOf('，', MAX_SENTENCE_LENGTH), remaining.lastIndexOf(',', MAX_SENTENCE_LENGTH), remaining.lastIndexOf('：', MAX_SENTENCE_LENGTH), remaining.lastIndexOf(':', MAX_SENTENCE_LENGTH));
      const cut = boundary > 7 ? boundary + 1 : MAX_SENTENCE_LENGTH;
      result.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) result.push(remaining);
  }
  return result;
}
return {normalizeSpeechText,splitSpeechSentences};
})()