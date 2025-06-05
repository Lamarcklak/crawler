// ===================
// CONFIGURAÇÕES
// ===================
const CONFIG_CEAGESP = {
  SHEET_ID: 'COLE_AQUI_O_ID_DA_PLANILHA',
  URL_CEAGESP: 'https://ceagesp.gov.br/cotacoes/#cotacao',
  EMAIL_ALERTAS: 'seu-email@exemplo.com'
};

// ===================
// FUNÇÃO PRINCIPAL
// ===================
function crawlerCeagesp() {
  try {
    console.log('Iniciando crawler Ceagesp Legumes...');
    const dados = buscarDadosCeagesp();
    if (!dados || dados.length === 0) return;
    salvarNaPlanilhaCeagesp(dados);
    console.log(`✅ Crawler concluído! ${dados.length} registros processados.`);
  } catch (error) {
    console.error('❌ Erro no crawler:', error);
    GmailApp.sendEmail(CONFIG_CEAGESP.EMAIL_ALERTAS, 'ERRO NO CRAWLER CEAGESP', error.message);
  }
}

// ===================
// EXTRAÇÃO DE DADOS
// ===================
function buscarDadosCeagesp() {
  try {
    // Usa filtro "LEGUMES" e data mais recente disponível
    const paginaInicial = UrlFetchApp.fetch(CONFIG_CEAGESP.URL_CEAGESP).getContentText();
    const matches = [...paginaInicial.matchAll(/value\s*=\s*"(\d{2}\/\d{2}\/\d{4})"/g)].map(m => m[1]);
    const dataMaisRecente = matches.length > 0
      ? matches[matches.length - 1]
      : Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy');
    const options = {
      method: 'post',
      payload: {
        categoria: 'LEGUMES',
        data: dataMaisRecente
      },
      followRedirects: true,
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(CONFIG_CEAGESP.URL_CEAGESP, options);
    const html = response.getContentText();
    return extrairDadosCeagesp(html);
  } catch (error) {
    console.error('Erro na busca de dados:', error);
    return null;
  }
}

function extrairDadosCeagesp(html) {
  const dados = [];
  const tabela = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tabela) {
    console.log('❌ Tabela não encontrada');
    return dados;
  }
  const linhas = tabela[0].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  linhas.slice(1).forEach(linha => {
    const celulas = [];
    const regexCelulas = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while ((m = regexCelulas.exec(linha)) !== null) {
      celulas.push(m[1].replace(/<[^>]*>/g, '').trim());
    }
    if (celulas.length >= 5) {
      const produto = celulas[0];
      const regiao = celulas[1];
      const unidade = celulas[2];
      const preco = parseFloat(celulas[3].replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const dataPreco = celulas[4];
      if (preco > 0) {
        dados.push({
          dataColeta: new Date(),
          produto: produto,
          regiao: regiao,
          unidade: unidade,
          preco: preco,
          dataPreco: normalizarDataUniversal(dataPreco),
          variacao: 0,
          status: 'Estável',
          fonte: 'Ceagesp'
        });
      }
    }
  });
  return dados;
}

// ===================
// NORMALIZAÇÃO E CHAVE ÚNICA
// ===================
function normalizarDataUniversal(dataStr) {
  if (!dataStr) return '';
  if (dataStr instanceof Date) {
    return Utilities.formatDate(dataStr, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  const meses = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
    'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
    'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
  };
  try {
    const partes = dataStr.replace(/[^\d/]/g, '').split('/');
    let dia = '01', mes = '01', ano = new Date().getFullYear();
    if (partes.length >= 1) dia = partes[0].padStart(2, '0');
    if (partes.length >= 2) mes = meses[partes[1].toLowerCase()] || partes[1].padStart(2, '0');
    if (partes.length >= 3) ano = partes[2];
    return `${dia}/${mes}/${ano}`;
  } catch (e) {
    console.error('Erro na normalização de data:', dataStr);
    return '00/00/0000';
  }
}

function criarChaveUnica(produto, regiao, unidade, dataPreco) {
  const normalizar = str => String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const dataNormalizada = normalizarDataUniversal(dataPreco);
  return [
    normalizar(produto),
    normalizar(regiao),
    normalizar(unidade),
    dataNormalizada
  ].join('|');
}

// ===================
// SALVAMENTO NA PLANILHA
// ===================
function salvarNaPlanilhaCeagesp(dadosNovos) {
  const sheet = SpreadsheetApp.openById(CONFIG_CEAGESP.SHEET_ID).getActiveSheet();
  const dadosExistentes = sheet.getDataRange().getValues();
  const indice = new Map();
  for (let i = 1; i < dadosExistentes.length; i++) {
    const linha = dadosExistentes[i];
    let dataPreco = linha[5];
    if (dataPreco instanceof Date) {
      dataPreco = Utilities.formatDate(dataPreco, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
    const chave = criarChaveUnica(linha[1], linha[2], linha[3], dataPreco);
    indice.set(chave, i);
  }
  const zonaHoraria = Session.getScriptTimeZone();
  dadosNovos.forEach(novo => {
    const chave = criarChaveUnica(novo.produto, novo.regiao, novo.unidade, novo.dataPreco);
    if (indice.has(chave)) {
      const linha = indice.get(chave) + 1;
      sheet.getRange(linha, 1, 1, 9).setValues([[
        Utilities.formatDate(novo.dataColeta, zonaHoraria, 'dd/MM/yyyy HH:mm:ss'),
        novo.produto,
        novo.regiao,
        novo.unidade,
        novo.preco,
        novo.dataPreco,
        novo.variacao,
        novo.status,
        novo.fonte
      ]]);
    } else {
      sheet.appendRow([
        Utilities.formatDate(novo.dataColeta, zonaHoraria, 'dd/MM/yyyy HH:mm:ss'),
        novo.produto,
        novo.regiao,
        novo.unidade,
        novo.preco,
        novo.dataPreco,
        novo.variacao,
        novo.status,
        novo.fonte
      ]);
    }
  });
  console.log(`📊 ${dadosNovos.length} registros processados no Ceagesp.`);
}
