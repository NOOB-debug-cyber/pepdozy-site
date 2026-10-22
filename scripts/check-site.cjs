const REFERENCES_BASE_REVISION = '469df5a11ef8ab1f1d1c6dceb1af37b4bd67e431';
const REMOVED_REFERENCE_URLS = Object.freeze([
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/215866s034lbl.pdf',
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/209637s038lbl.pdf',
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/215256s029lbl.pdf',
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/125469s065lbl.pdf',
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/022341s046lbl.pdf',
  'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/206321s020lbl.pdf',
  'https://doi.org/10.1056/NEJMoa2206038',
  'https://doi.org/10.1056/NEJMoa2032183',
  'https://doi.org/10.1016/S0140-6736(19)31149-3',
  'https://doi.org/10.1056/NEJMoa1411892',
  'https://www.gov.br/anvisa/en/updates/anvisa-approves-the-first-synthetic-semaglutide-pen-for-diabetes-an-analog-product-of-ozempic',
]);

function checkReferencesContract(references, baseline, check) {
  const links = html => [...html.matchAll(/<a\b[^>]*href="(https:\/\/[^\"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(match => ({ href: match[1], text: match[2] }));
  const part = (html, tag) => html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '';
  const main = part(references, 'main');
  const originalLinks = links(baseline);
  const expected = originalLinks.filter(link => !REMOVED_REFERENCE_URLS.includes(link.href));
  check(originalLinks.length === 28 && expected.length === 17, 'Base deve conter 28 links e preservar exatamente 17');
  check(REMOVED_REFERENCE_URLS.every(url => originalLinks.some(link => link.href === url)), 'URL de exclusão não encontrada na base Git');
  for (const url of REMOVED_REFERENCE_URLS) check(!references.includes(url), `URL excluída reapareceu: ${url}`);
  check(!/Mounjaro|Ozempic|Wegovy|Trulicity|Victoza|Saxenda|Ozivy/i.test(references), 'Marca editorialmente retirada reapareceu');
  check(!!main, 'Conteúdo principal das referências ausente');
  check((main.match(/<section\b/g) || []).length === 1, 'Referências devem ocupar um único bloco');
  check(!/<h[2-6]\b|<dl\b|class="(?:card|notice|reference-index|revision-list)(?:\s|\")/.test(main), 'Subseção, cartão ou histórico editorial reintroduzido');
  const lists = [...main.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/g)];
  check(lists.length === 1, 'Referências devem conter uma lista única');
  const list = lists[0]?.[0] || '';
  const listInner = lists[0]?.[2] || '';
  const items = [...listInner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)];
  check(items.length === 17, 'Lista única deve conter 17 links independentes');
  check(listInner.replace(/<li\b[^>]*>[\s\S]*?<\/li>/g, '').trim() === '', 'Conteúdo fora dos itens da lista');
  check(JSON.stringify(links(list)) === JSON.stringify(expected), 'Links permitidos e textos devem ser idênticos à base Git, na mesma ordem');
  check(JSON.stringify(links(main)) === JSON.stringify(links(list)), 'Fonte externa fora da lista única');
  for (const item of items) {
    const remaining = item[1].replace(/<span\b[^>]*>\s*<\/span>/g, '')
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, '').trim();
    check(remaining === '' && links(item[1]).length === 1, 'Cada item deve conter só o link e âncoras discretas, sem prosa');
  }
  const legacyIds = [...baseline.matchAll(/\bid="([^\"]+)"/g)].map(match => match[1]).filter(id => id !== 'conteudo');
  for (const id of [...legacyIds, 'medicamentos']) {
    check(new RegExp(`<(?:li|span)\\b[^>]*\\bid="${id}"`).test(list), `Âncora legada/app ausente da lista: ${id}`);
  }
  const ids = [...references.matchAll(/\bid="([^\"]+)"/g)].map(match => match[1]);
  check(new Set(ids).size === ids.length, 'IDs das referências não podem ser duplicados');
  for (const tag of ['header', 'h1', 'footer']) check(part(references, tag) === part(baseline, tag), `${tag} das referências alterado`);
  const intro = main.slice(0, main.indexOf('<section'));
  const description = references.match(/<meta name="description" content="([^\"]*)"/)?.[1] || '';
  check(!!description && /Fontes informativas/.test(description), 'Meta deve descrever fontes informativas');
  check(!/estimativ|modelo|curva|parâmetro/i.test(intro + description), 'Introdução/meta não podem afirmar modelo ou curva ativos');
  const originalNote = baseline.match(/<div class="notice">\s*<p>([\s\S]*?)<\/p>\s*<\/div>/)?.[1];
  const note = references.match(/<p class="references-note">([\s\S]*?)<\/p>/)?.[1];
  check(!!originalNote && note === originalNote, 'Nota informativa final deve conservar o texto original');
  check(main.indexOf('class="references-note"') > main.indexOf('</section>'), 'Nota deve vir após a lista, sem cartão extra');
  for (const removed of [
    'Discute limitações do modelo; não valida as curvas individuais do aplicativo.',
    'Estudos clínicos usados somente como contexto', 'SURMOUNT-1', 'STEP 1', 'REWIND', 'SCALE',
    'Curva estimada educativa', 'Fundamentos matemáticos', 'Diário de registros de glicemia',
    'Cada ponto representa uma medição feita em aparelho externo', 'O gráfico mostra apenas os pontos das medições informadas.',
    'O app não mede glicose, não classifica resultados', 'Os resumos descrevem somente as medições incluídas na seleção.',
    'Peso, meta e atividade', 'Histórico de revisões', '19 de outubro de 2026', '4 de agosto de 2026',
    'bateman-sc-v2', 'Esta página documenta a versão descrita.',
  ]) check(!references.includes(removed), `Trecho editorial excluído reapareceu: ${removed}`);
}

function runSiteChecks() {
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const routes = ['index.html', 'privacidade/index.html', 'termos/index.html', 'suporte/index.html', 'referencias/index.html'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('qa/approved-v16-manifest.json'));
const files = new Set(manifest.files.map(item => item.file));
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };

// O inventário identifica os bytes da candidata local; não comprova publicação.
// Também não admite referências quebradas ou caminhos locais do computador.
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
  check(files.has(file), `Recurso não consta no inventário da candidata: ${file}`);
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
  console.log(`PASS ${file}: conteúdo, tema, logo, links e arquivos inventariados`);
}
const home = read('index.html');
const homeLayout = read('assets/layout-v16.css');
check(!home.includes('class="goal-card"'), 'Meta antiga acima das tiles');
check((home.match(/class="feature-card(?: |")/g) || []).length === 3, 'Quantidade de cards da Home');
check(home.indexOf('class="feature-cards"') > home.indexOf('destination--terms'), 'Posição dos cards da Home');
check(homeLayout.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), 'Grade desktop dos destinos não possui quatro colunas iguais');
for (const [name, column] of [['privacy', 1], ['terms', 2], ['references', 3], ['support', 4]]) {
  check(homeLayout.includes(`.destination--${name} { grid-column: ${column}; grid-row: 1; }`), `Posição desktop divergente: ${name}`);
}
check(!/hidratacao|terms-closing-row/.test(read('termos/index.html')), 'Hidratação reintroduzida em Uso e licença');
check(read('termos/index.html').includes('Não mede a concentração no sangue, não representa todo o medicamento presente no corpo e não prevê sua resposta individual ao tratamento.'), 'Limite de uso estimativo removido');
check(read('privacidade/index.html').includes('GitHub'), 'Informação sobre hospedagem removida');
check(read('suporte/index.html').includes('mailto:'), 'Contato de suporte ausente');
for (const file of ['suporte/index.html', 'privacidade/index.html', 'termos/index.html']) {
  check(read(file).includes('mailto:pepdozy@gmail.com'), `Contato oficial ausente: ${file}`);
  check(!read(file).includes('cabralmoreirao23@icloud.com'), `Contato pessoal ainda presente: ${file}`);
}
const references = read('referencias/index.html');
const { execFileSync } = require('node:child_process');
const baselineReferences = execFileSync('git', ['show', REFERENCES_BASE_REVISION + ':referencias/index.html'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
check(home.includes('href="referencias/"'), 'Acesso às Referências técnicas ausente na Home');
checkReferencesContract(references, baselineReferences, check);
for (const route of routes.filter(file => file !== 'referencias/index.html')) {
  const original = execFileSync('git', ['show', REFERENCES_BASE_REVISION + ':' + route], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  check(read(route) === original, 'Página fora do escopo foi alterada: ' + route);
}
check(manifest.approvedOn === null && manifest.status === 'LOCAL_CANDIDATE_NOT_PUBLISHED', 'Manifesto deve declarar candidata local, sem aprovação/publicação');
check(manifest.referencesListRevision?.baseCommit === REFERENCES_BASE_REVISION, 'Base Git da revisão de referências divergente');

// A revisão editorial de 15/10/2026 foi aprovada para integração; os testes
// verificam os fatos técnicos e os limites antes do deploy coordenado.
const terms = read('termos/index.html');
const paletteCss = read('assets/terms-palette.css');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
check(sha256(terms.match(/<figure[\s\S]*?<\/figure>/)[0]) === 'cd1acfcd0ad332c7b2ef225f75a1b57dca0a1f7a8c7319ce302b55d5cd2a63c6', 'Aparelhos/card dos Termos alterados');
check(home.includes('Sua jornada com GLP-1, registrada no seu ritmo.'), 'Proposta principal ausente');
check(home.includes('Textos armazenados localmente no iPhone, sem envio automático a serviços externos.'), 'Privacidade abrangente ausente na Home');
check(!references.includes('As retas opcionais são regressões lineares descritivas separadas por contexto'), 'Descrição removida de regressões presente nas Referências');
check(!/em desenvolvimento|em testes|em breve|quando (?:o )?Meu Diário for/i.test(home + terms + read('privacidade/index.html')), 'Condicional de disponibilidade presente');
check(terms.includes('somente os registros que você selecionar'), 'Exportação seletiva ausente nos Termos');
check(read('privacidade/index.html').includes('schema') === false, 'Detalhe técnico de schema exposto ao público');
check(read('privacidade/index.html').includes('somente os registros selecionados pelo usuário'), 'Exportação seletiva ausente na Privacidade');
check(read('privacidade/index.html').includes('Os textos do Meu Diário são armazenados localmente no iPhone e não são enviados automaticamente a serviços externos. O compartilhamento fica a critério do usuário.'), 'Privacidade abrangente ausente na Política');
check(read('privacidade/index.html').includes('A integração com o Apple Health solicita apenas permissão de leitura de peso e não escreve dados.'), 'Escopo do Apple Health ausente na Política');
for (const file of routes) {
  check(!read(file).includes('Registros e fotos ficam fora do backup automático do iPhone.'), `Parágrafo proibido presente: ${file}`);
  check(!read(file).includes('Os registros locais e as fotos de progresso ficam fora do backup automático do iPhone.'), `Redação automática proibida presente: ${file}`);
}
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
console.log(`PASS: ${checks} verificações; ${routes.length} páginas; ${manifest.files.length} arquivos inventariados na candidata local`);
}

if (require.main === module) runSiteChecks();
module.exports = { REFERENCES_BASE_REVISION, REMOVED_REFERENCE_URLS, checkReferencesContract };
