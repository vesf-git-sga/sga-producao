const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// --- DADOS E CONFIGURAÇÕES ---
const TIPO = {
    ADMINISTRATIVO: 'ADMINISTRATIVO',
    ESCOLAR: 'ESCOLAR',
    EXTERNO: 'EXTERNO'
};
const inputFile = path.join(__dirname, 'base_unidades.csv');
const outputFile = path.join(__dirname, 'inserts.sql');

// --- FUNÇÃO PRINCIPAL ---
async function processarDados() {
    console.log('Iniciando processamento do arquivo:', inputFile);

    const unidades = await lerCsv(inputFile);
    
    if (unidades.length === 0) {
        console.error("\n❌ ERRO: Nenhuma linha de dados foi lida do arquivo 'base_unidades.csv'.");
        console.error("Verifique se o arquivo não está vazio e se o separador de colunas é ponto e vírgula (;).");
        return;
    }
     console.log(`=> ${unidades.length} linhas de dados encontradas no CSV.`);

    let sqlInserts = [];
    let codigosGerados = new Set();

    unidades.forEach(unidade => {
        const headers = Object.keys(unidade);
        if (headers.length === 0 || !unidade[headers[0]]) return;
        
        const nomeCompleto = unidade[headers[0]].trim();
        let tipo, nome, sigla, orgPai, secExecutiva, depto;

        if (nomeCompleto.toLowerCase().includes('escola') || nomeCompleto.toLowerCase().includes('creche') || nomeCompleto.toUpperCase().includes('UTEC')) {
            tipo = TIPO.ESCOLAR;
            nome = nomeCompleto;
            orgPai = 'SEDUC';
        } else if (nomeCompleto.includes('(')) {
            tipo = TIPO.ADMINISTRATIVO;
            const partes = nomeCompleto.match(/(.*?)\s*\((.*?)\)/);
            if (!partes) return;
            nome = partes[1].trim();
            const hierarquia = partes[2].split('/');
            sigla = hierarquia[hierarquia.length - 1];
            orgPai = hierarquia[0];
            secExecutiva = hierarquia[1] || null;
            depto = hierarquia[2] || null;
        } else {
            tipo = TIPO.ADMINISTRATIVO;
            nome = nomeCompleto;
            orgPai = 'SEDUC';
        }

        let baseCode = nome.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
        let seq = 1;
        let finalCode = `${baseCode}${String(seq).padStart(3, '0')}`;
        while (codigosGerados.has(finalCode)) {
            seq++;
            finalCode = `${baseCode}${String(seq).padStart(3, '0')}`;
        }
        codigosGerados.add(finalCode);

        sqlInserts.push(
            `INSERT INTO sectors (type, name, acronym, parent_organization, executive_secretariat, department, code) VALUES (${sqlValue(tipo)}, ${sqlValue(nome)}, ${sqlValue(sigla)}, ${sqlValue(orgPai)}, ${sqlValue(secExecutiva)}, ${sqlValue(depto)}, ${sqlValue(finalCode)});`
        );
    });
    
    // --- LÓGICA DE ESCRITA DO ARQUIVO ---
    const finalSqlString = [
        '-- Script para popular a tabela de setores (Gerado em ' + new Date().toLocaleString('pt-BR') + ')',
        '-- Execute o conteúdo deste arquivo no seu cliente SQL.',
        '-- ----------------------------------------------------',
        ...sqlInserts
    ].join('\n\n');

    try {
        fs.writeFileSync(outputFile, finalSqlString, { encoding: 'utf-8' });
        console.log(`\n✅ Sucesso! O arquivo "inserts.sql" foi gerado corretamente na pasta 'migration'.`);
        console.log('=> Próximo passo: execute o conteúdo desse arquivo no seu banco de dados.');
    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO: Falha ao escrever o arquivo de saída inserts.sql.');
        console.error(error);
    }
}

// --- FUNÇÕES AUXILIARES ---
function sqlValue(value) {
    if (value === null || typeof value === 'undefined') return 'NULL';
    return `'${String(value).replace(/'/g, "''")}'`;
}

function lerCsv(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`Arquivo não encontrado: ${filePath}`));
        }
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

// --- EXECUÇÃO ---
processarDados();