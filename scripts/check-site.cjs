const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const routes = ['index.html', 'privacidade/index.html', 'termos/index.html', 'suporte/index.html'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('qa/approved-v16-manifest.json'));
const files = new Set(manifest.files.map(item => item.file));
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };

// O pacote público deve corresponder aos arquivos da composição aprovada,
// e não incluir referências quebradas ou caminhos locais do computador.
for (const item of manifest.files) {
  check(!path.isAbsolute(item.file) && !item.file.split('/').includes('..'), `Caminho inválido: ${item.file}`);
  const bytes = fs.readFileSync(path.join(root, item.file));
  check(bytes.length === item.bytes, `Tamanho divergente: ${item.file}`);
  check(crypto.createHash('sha256').update(bytes).digest('hex') === item.sha256, `SHA divergente: ${item.file}`);
}
check(read('CNAME').trim() === 'pepdozy.com.br', 'Domínio divergente');
check(fs.existsSync(path.join(root, '.nojekyll')), '.nojekyll ausente');

function resolveReference(from, reference) {
  const [relative, anchor] = reference.split('#');
  let file = path.normalize(path.join(path.dirname(from), relative.split('?')[0] || path.basename(from)));
  check(!file.startsWith('../') && !path.isAbsolute(file), `Referência fora do site: ${reference}`);
  check(fs.existsSync(path.join(root, file)), `Referência ausente: ${from} -> ${reference}`);
  if (fs.statSync(path.join(root, file)).isDirectory()) file = path.join(file, 'index.html');
  if (anchor && file.endsWith('.html')) check(read(file).includes(`id="${anchor}"`), `Âncora ausente: ${reference}`);
  check(files.has(file), `Recurso não consta na versão aprovada: ${file}`);
}

for (const file of routes) {
  const html = read(file);
  const text = html.replace(/<[^>]*>/g, '');
  check(/<html lang="pt-BR">/.test(html), `Idioma: ${file}`);
  check((html.match(/<h1\b/g) || []).length === 1, `Título principal: ${file}`);
  check((html.match(/class="brand__logo"/g) || []).length === 1, `Logo: ${file}`);
  check(!/PepDozy(?!™)/.test(text), `Marca sem ™: ${file}`);
  check(!/PepDozy®|™™/.test(text), `Marca inconsistente: ${file}`);
  check(!/\/Users\/|localhost|127\.0\.0\.1|file:\/\//.test(html), `Caminho privado: ${file}`);
  check(!/<script\b|<iframe\b|<form\b|\son[a-z]+\s*=/i.test(html), `Coleta/script inesperado: ${file}`);
  check(html.includes(`class="${file.startsWith('termos/') ? 'theme-light' : 'theme-dark'}`), `Tema: ${file}`);
  check(html.includes('layout-v16.css'), `Layout V16 ausente: ${file}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  check(new Set(ids).size === ids.length, `IDs duplicados: ${file}`);
  for (const tag of html.matchAll(/<(?:a|link|img|source)\b[^>]*>/g)) {
    if (tag[0].startsWith('<img')) check(/\balt="[^"]*"/.test(tag[0]), `Imagem sem alternativa: ${file}`);
    for (const attr of tag[0].matchAll(/\b(href|src|srcset)="([^"]+)"/g)) {
      const refs = attr[1] === 'srcset' ? attr[2].split(',').map(value => value.trim().split(/\s+/)[0]) : [attr[2]];
      for (const ref of refs) {
        if (/^(https:\/\/|mailto:)/.test(ref)) continue;
        check(!/^[a-z]+:/i.test(ref), `Protocolo não permitido: ${ref}`);
        resolveReference(file, ref);
      }
    }
  }
  console.log(`PASS ${file}: conteúdo, tema, logo, links e arquivos aprovados`);
}
const home = read('index.html');
check(!home.includes('class="goal-card"'), 'Meta antiga acima das tiles');
check((home.match(/class="feature-card(?: |")/g) || []).length === 3, 'Quantidade de cards da Home');
check(home.indexOf('class="feature-cards"') > home.indexOf('destination--terms'), 'Posição dos cards da Home');
check(!/hidratacao|terms-closing-row/.test(read('termos/index.html')), 'Hidratação reintroduzida em Uso e licença');
check(read('termos/index.html').includes('Não mede a concentração no sangue, não representa todo o medicamento presente no corpo e não prevê sua resposta individual ao tratamento.'), 'Limite de uso estimativo removido');
check(read('privacidade/index.html').includes('GitHub'), 'Informação sobre hospedagem removida');
check(read('suporte/index.html').includes('mailto:'), 'Contato de suporte ausente');

// Conteúdo editorial autorizado em 28/09/2026, com ajuste delimitado do tópico 10.
// Paleta, figuras e outras páginas permanecem preservadas.
const terms = read('termos/index.html');
const paletteCss = read('assets/terms-palette.css');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const plainText = terms.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
check(sha256(plainText) === 'de5194c358a4039ff528721a00941a2421e28c1fa4db1823864cc8a1e27f8c96', 'Texto dos Termos difere da versão editorial autorizada');
check(sha256(terms.match(/<figure[\s\S]*?<\/figure>/)[0]) === 'cd1acfcd0ad332c7b2ef225f75a1b57dca0a1f7a8c7319ce302b55d5cd2a63c6', 'Aparelhos/card dos Termos alterados');
check(terms.includes('assets/terms-palette.css'), 'Paleta dos Termos ausente');
for (const route of routes.filter(file => file !== 'termos/index.html')) {
  check(!read(route).includes('terms-palette.css'), `Paleta dos Termos vazou para ${route}`);
}
const chapterColors = [...terms.matchAll(/class="(?:notice )?terms-chapter terms-chapter--(\w+)"/g)].map(match => match[1]);
check(JSON.stringify(chapterColors) === JSON.stringify(['neutral', 'lavender', 'blue', 'neutral', 'lavender', 'blue', 'neutral', 'lavender', 'blue', 'neutral']), 'Sequência dos dez blocos numerados');
const cssWithoutComments = paletteCss.replace(/\/\*[\s\S]*?\*\//g, '');
for (const match of cssWithoutComments.matchAll(/([^{}]+)\{/g)) {
  check(/^body\.page-terms(?:\s|$)/.test(match[1].trim()), 'Seletor fora do escopo dos Termos');
}
check(paletteCss.includes('text-decoration-line: underline'), 'Links sem sublinhado');
check(paletteCss.includes('a:focus-visible') && paletteCss.includes('outline: .2rem solid var(--focus)'), 'Foco visível ausente');
const rule = selector => {
  const start = paletteCss.indexOf(selector + ' {');
  check(start !== -1, `Regra ausente: ${selector}`);
  return paletteCss.slice(start, paletteCss.indexOf('}', start));
};
const color = (css, name) => {
  const match = css.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})', 'i'));
  check(!!match, `Token ausente: ${name}`);
  return match[1];
};
const base = rule('body.page-terms');
const chapterRules = ['body.page-terms .terms-chapter', 'body.page-terms .terms-chapter--lavender', 'body.page-terms .terms-chapter--blue'].map(rule);
const luminance = hex => {
  const [r, g, b] = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (const chapter of chapterRules) {
  const background = color(chapter, '--chapter-bg');
  for (const token of ['--body-text', '--link', '--link-hover', '--focus']) {
    check(contrast(color(base, token), background) >= 4.5, `Contraste insuficiente: ${token} sobre ${background}`);
  }
  check(contrast(color(chapter, '--chapter-heading'), background) >= 4.5, `Contraste do título sobre ${background}`);
}
console.log(`PASS: ${checks} verificações; ${routes.length} páginas; ${manifest.files.length} arquivos aprovados`);
