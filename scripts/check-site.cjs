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
check(read('termos/index.html').includes('Não são medições de sangue'), 'Limite de uso estimativo removido');
check(read('privacidade/index.html').includes('GitHub'), 'Informação sobre hospedagem removida');
check(read('suporte/index.html').includes('mailto:'), 'Contato de suporte ausente');
console.log(`PASS: ${checks} verificações; ${routes.length} páginas; ${manifest.files.length} arquivos aprovados`);
