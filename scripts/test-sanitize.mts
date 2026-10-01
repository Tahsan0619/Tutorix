// Unit checks for the output sanitizers: npx tsx scripts/test-sanitize.mts
import { cleanMarkdown, plainText } from '../src/lib/sanitize.ts';
import { cleanText, listItem } from '../supabase/functions/ai/util.ts';

const damaged = JSON.parse('{"a":"$\\frac{1}{2} \\times 3 \\rightarrow \\theta$"}').a; // what JSON.parse does to single-backslash LaTeX
const cases: [string, (s: string) => string, string, string][] = [
  ['server: JSON-damaged LaTeX', cleanText, damaged, '$\\frac{1}{2} \\times 3 \\rightarrow \\theta$'],
  ['server: \\neq damaged inside math', cleanText, '$a \neq b$'.replace('\\n', '\n'), '$a \\neq b$'],
  ['server: literal \\n without math', cleanText, 'Line one\\nLine two', 'Line one\nLine two'],
  ['server: keeps \\nabla in math', cleanText, 'Use $\\nabla f$ here', 'Use $\\nabla f$ here'],
  ['server: HTML formatting', cleanText, 'This is <b>bold</b><br>next', 'This is **bold**\nnext'],
  ['server: keeps HTML as subject matter', cleanText, 'What does the <li> tag do?', 'What does the <li> tag do?'],
  ['server: unwraps code fence', cleanText, '```markdown\n## Title\nText\n```', '## Title\nText'],
  ['server: unbalanced bold', cleanText, '**Key idea: water expands', 'Key idea: water expands'],
  ['server: ^circ repair', cleanText, '$0^circ C$', '$0^\\circ C$'],
  ['server: zero-width chars', cleanText, 'a\u200Bb\uFEFF', 'ab'],
  ['server: keeps Bangla ZWJ', cleanText, 'র‍্যাব', 'র‍্যাব'],
  ['server: blank lines', cleanText, 'a\n\n\n\nb   ', 'a\n\nb'],
  ['list: dash bullet', listItem, '- Converts **solar energy**', 'Converts **solar energy**'],
  ['list: numbering', listItem, '2. Second step', 'Second step'],
  ['list: keeps decimals', listItem, '3.14 is pi', '3.14 is pi'],
  ['list: keeps negative number', listItem, '-5 °C is cold', '-5 °C is cold'],
  ['client: \\( \\) delimiters', cleanMarkdown, 'Area \\(A = \\pi r^2\\)', 'Area $A = \\pi r^2$'],
  ['client: \\[ \\] delimiters', cleanMarkdown, '\\[E = mc^2\\]', '$$E = mc^2$$'],
  ['client: currency escaped', cleanMarkdown, 'It costs $5 and $10 total', 'It costs \\$5 and \\$10 total'],
  ['client: math with number kept', cleanMarkdown, 'So $10 \\times 5 = 50$ here', 'So $10 \\times 5 = 50$ here'],
  ['client: simple math kept', cleanMarkdown, 'Solve $2x + 3 = 7$', 'Solve $2x + 3 = 7$'],
  ['client: lone price', cleanMarkdown, 'Price is $20.', 'Price is \\$20.'],
  ['client: display math kept', cleanMarkdown, '$$x = \\frac{-b}{2a}$$', '$$x = \\frac{-b}{2a}$$'],
  ['client: <br> in table row', cleanMarkdown, '| a<br>b | c |\n| --- | --- |', '| a b | c |\n| --- | --- |'],
  ['client: JSON-damaged LaTeX', cleanMarkdown, damaged, '$\\frac{1}{2} \\times 3 \\rightarrow \\theta$'],
  ['plain: strips markdown+math', plainText, '**Newton** says $F = ma$', 'Newton says F = ma'],
  ['server: spaced em dash', cleanText, 'Photosynthesis — the way plants make food', 'Photosynthesis, the way plants make food'],
  ['server: unspaced em dash', cleanText, 'Roots—the anchor—hold soil', 'Roots, the anchor, hold soil'],
  ['server: em dash range', cleanText, 'Pages 12—18', 'Pages 12-18'],
  ['server: trailing em dash', cleanText, 'Wait for it —.', 'Wait for it.'],
  ['client: em dash table cell', cleanMarkdown, '| Q1 | — |\n| --- | --- |', '| Q1 | - |\n| --- | --- |'],
  ['client: leading em dash', cleanMarkdown, '— Rabindranath Tagore', 'Rabindranath Tagore'],
  ['client: comma before em dash', cleanMarkdown, 'Leaves, — and stems', 'Leaves, and stems'],
];

let failed = 0;
for (const [name, fn, input, expected] of cases) {
  const got = fn(input);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got:      ${JSON.stringify(got)}\n      expected: ${JSON.stringify(expected)}`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) process.exitCode = 1;
