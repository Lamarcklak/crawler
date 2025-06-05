# crawler

Este repositório contém scripts Google Apps Script para extrair preços de produtos agrícolas.

## Tomate Cepea
O arquivo `Tomate cepea` realiza a coleta de cotações de tomate no site HF Brasil.
Execute a função `crawlerHFBrasil()` para popular sua planilha.

## Ceagesp Legumes
O arquivo `ceagesp_legumes.gs` obtém cotações de legumes diretamente do site da Ceagesp.

### Como usar
1. Crie um novo projeto no Google Apps Script e copie o conteúdo dos arquivos `.gs`.
2. Ajuste `SHEET_ID` e `EMAIL_ALERTAS` nas constantes de configuração.
3. Execute `crawlerCeagesp()` para coletar os dados de legumes ou `crawlerHFBrasil()` para tomates.
4. Opcionalmente configure gatilhos para execuções periódicas.

