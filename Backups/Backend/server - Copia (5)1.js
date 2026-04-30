// backend/src/server.js
// Arquivo principal do servidor Express

// Carrega as variáveis de ambiente do arquivo .env

// >>> ADICIONE ESTA FUNÇÃO AUXILIAR NO INÍCIO DO ARQUIVO <<<
const crypto = require('crypto'); // Certifique-se que o 'crypto' está sendo importado

function generateRandomPassword(length = 10) {
  // Gera uma senha aleatória com letras maiúsculas, minúsculas, números e um símbolo.
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%&*';
  
  const allChars = uppercase + lowercase + numbers + specialChars;
  
  let password = '';
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += specialChars[crypto.randomInt(specialChars.length)];

  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Embaralha a senha para que os primeiros caracteres não sejam sempre os mesmos
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

require('dotenv').config({ path: '../.env' });

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Importa o pacote CORS
const XLSX = require('xlsx'); // Para lidar com arquivos XLSX
const csv = require('csv-parser'); // Para lidar com arquivos CSV
const fs = require('fs'); // Para lidar com arquivos do sistema de arquivos
const multer = require('multer'); // Para upload de arquivos
const path = require('path'); // Para manipulação de caminhos de arquivo

// Importações para PDFmake
const PdfPrinter = require('pdfmake');

// Define o caminho base para as fontes
const fontsPath = path.join(__dirname, 'fonts');
console.log(`[DEBUG FONT] Caminho base das fontes: ${fontsPath}`); // DEBUG

// Verifica se os arquivos de fonte existem e loga
const fontFiles = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italics.ttf',
  bolditalics: 'Roboto-MediumItalics.ttf'
};

// Mapeia as fontes para o PdfPrinter
const fonts = {
  Roboto: {}
};

let allFontsFound = true; // Flag para verificar se todas as fontes foram encontradas

for (const [key, fileName] of Object.entries(fontFiles)) {
  const fullPath = path.join(fontsPath, fileName);
  if (!fs.existsSync(fullPath)) {
    console.error(`[ERRO CRÍTICO FONT] Fonte não encontrada em: ${fullPath}. O PDF não será gerado corretamente.`);
    allFontsFound = false;
  } else {
    console.log(`[DEBUG FONT] Fonte encontrada: ${fullPath}`);
    fonts.Roboto[key] = fullPath;
  }
}

let printer;
if (Object.keys(fonts.Roboto).length > 0 && allFontsFound) {
  console.log('[DEBUG FONT] Todas as fontes essenciais foram encontradas. Inicializando PdfPrinter.');
  printer = new PdfPrinter(fonts);
} else {
  console.error('[ERRO CRÍTICO FONT] Não foi possível carregar todas as fontes necessárias. A geração de PDF pode falhar.');
  printer = new PdfPrinter({
    'Helvetica': {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  });
}


const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET; // Chave secreta para JWT
const DATABASE_URL = process.env.DATABASE_URL; // URL de conexão com o banco de dados

// Configuração do pool de conexão com o PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Testa a conexão com o banco de dados
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar ao banco de dados:', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Erro ao executar query de teste:', err.stack);
    }
    console.log('Conectado ao PostgreSQL com sucesso! Tempo atual do DB:', result.rows[0].now);
  });
});

// Configuração do Multer para upload de arquivos
const upload = multer({ dest: 'uploads/' }); // Pasta temporária para uploads

// Middlewares
app.use(express.json()); // Permite que o Express parseie corpos de requisição JSON
app.use(cors()); // Habilita o CORS para todas as rotas (necessário para o frontend)

// Middleware de Autenticação (para proteger rotas)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ message: 'Token não fornecido. Acesso negado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Se o token for inválido ou expirado
      return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
    req.user = user; // Anexa o payload do JWT ao objeto request
    next(); // Procede para a próxima função middleware/rota
  });
};

// Definindo os nomes dos perfis para evitar erros de digitação
const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    BASIC: 'basic'
};

// Mapeamento de cada ação para os perfis que podem executá-la
const PERMISSIONS = {
    // Apenas admins podem gerenciar usuários
    USER_MANAGE: [ROLES.ADMIN], 
    
    // Admins e Gerentes podem criar/editar dados cadastrais
    DATA_MANAGE: [ROLES.ADMIN, ROLES.MANAGER], 

    // Apenas Admins podem deletar registros mestres (mais seguro)
    DATA_DELETE: [ROLES.ADMIN],

    // Todos podem visualizar dados gerais
    DATA_VIEW: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],

    // Permissão de Auditoria
    AUDIT_VIEW: [ROLES.ADMIN],
};

// Middleware para verificar permissão de acesso (admin ou manager)
const authorizeRole = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logAudit(req.user.id, 'unauthorized_access', 'role_check', null, { attempted_role: req.user.role, required_roles: roles, path: req.path }, req.ip);
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
    next();
  };
};

// >>> NOVO MIDDLEWARE (baseado na mesma ideia) <<<
const authorizePermission = (permissionKey) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    
    // 1. Busca na nossa "fonte da verdade" quais perfis são permitidos
    const allowedRoles = PERMISSIONS[permissionKey];

    // 2. A lógica de verificação é a mesma que a sua!
    if (allowedRoles && allowedRoles.includes(userRole)) {
      // Se o perfil do usuário está na lista de perfis permitidos para esta ação, continue.
      next(); 
    } else {
      // Se não, reutilizamos sua lógica de log e erro.
      logAudit(req.user.id, 'unauthorized_access', 'permission_check', null, { required_permission: permissionKey, user_role: userRole, path: req.path }, req.ip);
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
  };
};

// Middleware para registrar logs de auditoria
const logAudit = async (userId, actionType, targetEntity = null, targetId = null, details = null, ipAddress = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, target_entity, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, actionType, targetEntity, targetId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
  }
};

// ======================================
// Rotas de Autenticação (Mantidas da Fase 1)
// ======================================

// Rota de Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip; // Captura o IP do cliente

  if (!email || !password) {
    await logAudit(null, 'login_failed', 'user', null, { reason: 'Missing credentials', email }, ipAddress);
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      await logAudit(null, 'login_failed', 'user', null, { reason: 'User not found', email }, ipAddress);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await logAudit(user.id, 'login_failed', 'user', user.id, { reason: 'Incorrect password', email }, ipAddress);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    await logAudit(user.id, 'login_success', 'user', user.id, { email }, ipAddress);

    res.status(200).json({ message: 'Login bem-sucedido!', token, user: tokenPayload });

  } catch (error) {
    console.error('Erro no login:', error);
    await logAudit(null, 'login_error', null, null, { error: error.message, email }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota de Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await logAudit(req.user.id, 'logout', 'user', req.user.id, { email: req.user.email }, req.ip);
  res.status(200).json({ message: 'Logout realizado com sucesso.' });
});

// Rota para verificar o token
app.get('/api/auth/verify-token', authenticateToken, (req, res) => {
  res.status(200).json({ isValid: true, user: req.user });
});

// Rota de exemplo protegida
app.get('/api/protected-data', authenticateToken, (req, res) => {
  res.status(200).json({ message: `Bem-vindo, ${req.user.username}! Você acessou dados protegidos.`, user: req.user });
});

// Rota para criar um usuário (ADMIN APENAS)
app.post('/api/users/register', authenticateToken, authorizePermission('USER_MANAGE'), async (req, res) => {
  const { username, email, full_name, role } = req.body;
  let { password } = req.body; // 'let' para que possamos modificá-la
  const ipAddress = req.ip;
  let generatedPassword = null;

  // Validação dos campos básicos
  if (!username || !email || !full_name || !role) {
    return res.status(400).json({ message: 'Todos os campos, exceto senha, são obrigatórios.' });
  }

  // Se a senha não for fornecida, gera uma aleatoriamente
  if (!password) {
    password = generateRandomPassword();
    generatedPassword = password; // Armazena a senha gerada para retornar ao admin
  }

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Usuário ou email já cadastrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Futuramente, adicionaremos aqui o campo 'must_change_password' = true
    const newUserResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role`,
      [username, email, passwordHash, full_name, role]
    );
    const newUser = newUserResult.rows[0];

    await logAudit(req.user.id, 'user_created', 'user', newUser.id, { new_user_email: email, new_user_role: role }, ipAddress);
    
    // Retorna a senha gerada se ela foi criada pelo sistema
    res.status(201).json({ 
      message: 'Usuário registrado com sucesso.', 
      user: newUser,
      ...(generatedPassword && { generatedPassword }) // Adiciona a senha à resposta se ela foi gerada
    });

  } catch (error) {
    console.error('Erro ao registrar novo usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ======================================
// NOVAS ROTAS DE RELATÓRIOS - PESSOAS
// ======================================

// Função auxiliar para buscar os dados de pessoas
const getPeopleReportData = async () => {
  const result = await pool.query(
    `SELECT
       p.full_name,
       p.cpf,
       p.email,
       p.registration_number,
       s.sector_name,
       s.secretariat
     FROM people p
     LEFT JOIN sectors s ON p.sector_id = s.id
     ORDER BY p.full_name ASC`
  );
  return result.rows;
};

// Rota para exportar lista de pessoas em CSV
app.get('/api/reports/people/csv', authenticateToken, async (req, res) => {
  try {
    const people = await getPeopleReportData();
    if (people.length === 0) {
      return res.status(404).json({ message: 'Nenhuma pessoa encontrada para gerar relatório.' });
    }

    const headers = ['Nome Completo', 'CPF', 'Email', 'Matrícula', 'Setor', 'Secretaria'];
    const csvRows = [headers.join(';')]; // Usando ';' como separador

    for (const person of people) {
      const row = [
        person.full_name,
        person.cpf,
        person.email,
        person.registration_number || 'N/A',
        person.sector_name || 'N/A',
        person.secretariat || 'N/A'
      ];
      // Aspas em todos os campos para evitar problemas com vírgulas e pontos e vírgulas
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }

    const csvString = csvRows.join('\n');
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_pessoas.csv');
    res.send(Buffer.from(csvString, 'utf-8')); // Garante a codificação correta
    await logAudit(req.user.id, 'generate_report', 'people_report_csv', null, { count: people.length }, req.ip);
  } catch (error) {
    console.error('Erro ao gerar relatório CSV de pessoas:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório CSV de pessoas.' });
  }
});

// Rota para exportar lista de pessoas em XLSX
app.get('/api/reports/people/xlsx', authenticateToken, async (req, res) => {
  try {
    const people = await getPeopleReportData();
    if (people.length === 0) {
      return res.status(404).json({ message: 'Nenhuma pessoa encontrada para gerar relatório.' });
    }
    
    // Mapeia os dados para ter cabeçalhos amigáveis
    const dataForSheet = people.map(p => ({
      'Nome Completo': p.full_name,
      'CPF': p.cpf,
      'Email': p.email,
      'Matrícula': p.registration_number || 'N/A',
      'Setor': p.sector_name || 'N/A',
      'Secretaria': p.secretariat || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pessoas');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment('relatorio_pessoas.xlsx');
    res.send(buffer);
    await logAudit(req.user.id, 'generate_report', 'people_report_xlsx', null, { count: people.length }, req.ip);
  } catch (error) {
    console.error('Erro ao gerar relatório XLSX de pessoas:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório XLSX de pessoas.' });
  }
});

// Rota para exportar lista de pessoas em PDF
app.get('/api/reports/people/pdf', authenticateToken, async (req, res) => {
  try {
    const people = await getPeopleReportData();
    if (people.length === 0) {
      return res.status(404).json({ message: 'Nenhuma pessoa encontrada para gerar relatório.' });
    }

    const bodyData = people.map(p => [
      p.full_name,
      p.cpf,
      p.email,
      p.sector_name || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Pessoas Cadastradas', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto'],
            body: [
              ['Nome Completo', 'CPF', 'Email', 'Setor'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Pessoas: ${people.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#e9ecef', alignment: 'left' },
        footer: { fontSize: 10, italics: true }
      },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_pessoas.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'people_report_pdf', null, { count: people.length }, req.ip);
  } catch (error) {
    console.error('Erro ao gerar relatório PDF de pessoas:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório PDF de pessoas.' });
  }
});

// Arquivo: server.js

// ======================================
// NOVAS ROTAS DE RELATÓRIOS - SETORES E TIPOS DE ITENS
// ======================================

// --- RELATÓRIOS DE SETORES ---

const getSectorsReportData = async () => {
  const result = await pool.query('SELECT code, secretariat, executive, sector_name, address, contact_phone FROM sectors ORDER BY secretariat, sector_name');
  return result.rows;
};

app.get('/api/reports/sectors/csv', authenticateToken, async (req, res) => {
  try {
    const sectors = await getSectorsReportData();
    const headers = ['Código', 'Secretaria', 'Secretaria Executiva', 'Nome do Setor', 'Endereço', 'Telefone de Contato'];
    const csvRows = [headers.join(';')];
    for (const sector of sectors) {
      const row = [
        sector.code,
        sector.secretariat,
        sector.executive || 'N/A',
        sector.sector_name,
        (sector.address || '').replace(/"/g, '""'),
        sector.contact_phone || 'N/A'
      ];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_setores.csv');
    res.send(Buffer.from(csvRows.join('\n')));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de setores.' }); }
});

app.get('/api/reports/sectors/xlsx', authenticateToken, async (req, res) => {
    try {
        const sectors = await getSectorsReportData();
        const dataForSheet = sectors.map(s => ({
            'Código': s.code,
            'Secretaria': s.secretariat,
            'Secretaria Executiva': s.executive || 'N/A',
            'Nome do Setor': s.sector_name,
            'Endereço': s.address || 'N/A',
            'Telefone': s.contact_phone || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Setores');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('relatorio_setores.xlsx');
        res.send(buffer);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de setores.' }); }
});

app.get('/api/reports/sectors/pdf', authenticateToken, async (req, res) => {
  try {
    const sectors = await getSectorsReportData();
    if (sectors.length === 0) {
      return res.status(404).json({ message: 'Nenhum setor encontrado para gerar relatório.' });
    }

    // Selecionando as colunas mais relevantes para o PDF
    const bodyData = sectors.map(s => [
      s.code,
      s.secretariat,
      s.sector_name,
      s.contact_phone || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Setores Cadastrados', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto'],
            body: [
              ['Código', 'Secretaria', 'Setor', 'Telefone'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Setores: ${sectors.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: { /* Estilos do PDF... */ },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_setores.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de setores.' }); }
});

// --- RELATÓRIOS DE TIPOS DE ITENS ---

const getItemTypesReportData = async () => {
  const result = await pool.query('SELECT code, name, description FROM item_types ORDER BY name');
  return result.rows;
};

app.get('/api/reports/item-types/csv', authenticateToken, async (req, res) => {
  try {
    const itemTypes = await getItemTypesReportData();
    const headers = ['Código', 'Nome', 'Descrição'];
    const csvRows = [headers.join(';')];
    for (const item of itemTypes) {
      const row = [item.code, item.name, (item.description || '').replace(/"/g, '""')];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_tipos_de_itens.csv');
    res.send(Buffer.from(csvRows.join('\n')));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de tipos de itens.' }); }
});

app.get('/api/reports/item-types/xlsx', authenticateToken, async (req, res) => {
    try {
        const itemTypes = await getItemTypesReportData();
        const dataForSheet = itemTypes.map(it => ({
            'Código': it.code,
            'Nome': it.name,
            'Descrição': it.description || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tipos de Itens');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('relatorio_tipos_de_itens.xlsx');
        res.send(buffer);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de tipos de itens.' }); }
});

app.get('/api/reports/item-types/pdf', authenticateToken, async (req, res) => {
  try {
    const itemTypes = await getItemTypesReportData();
    if (itemTypes.length === 0) {
      return res.status(404).json({ message: 'Nenhum tipo de item encontrado para gerar relatório.' });
    }

    const bodyData = itemTypes.map(it => [
      it.code,
      it.name,
      it.description || ''
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Tipos de Itens', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto'],
            body: [
              ['Código', 'Nome', 'Descrição'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Tipos de Itens: ${itemTypes.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: { /* Estilos do PDF... */ },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_tipos_de_itens.pdf');
      res.send(resultBuffer);
    });
    pdfDoc.end();
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de tipos de itens.' }); }
});

// Arquivo: server.js

// ======================================
// NOVAS ROTAS DE GESTÃO DE USUÁRIOS
// ======================================

// Rota para listar todos os usuários (ADMIN APENAS)
app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, full_name, role, created_at FROM users ORDER BY full_name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// NOVA ROTA ABAIXO DA ROTA DE LISTAR USUÁRIOS 

// Rota para deletar um usuário (ADMIN APENAS)
app.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userIdToDelete = parseInt(req.params.id, 10);
  const loggedInUserId = req.user.id;
  const ipAddress = req.ip;

  // Medida de segurança: um administrador não pode deletar a si mesmo.
  if (userIdToDelete === loggedInUserId) {
    await logAudit(loggedInUserId, 'delete_user_failed', 'user', userIdToDelete, { reason: 'Admin tried to delete self' }, ipAddress);
    return res.status(403).json({ message: 'Você não pode remover sua própria conta de administrador.' });
  }

  try {
    const deleteResult = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [userIdToDelete]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    await logAudit(loggedInUserId, 'delete_user_success', 'user', userIdToDelete, { deleted_user: deleteResult.rows[0].email }, ipAddress);
    res.status(200).json({ message: 'Usuário removido com sucesso.' });

  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    await logAudit(loggedInUserId, 'delete_user_error', 'user', userIdToDelete, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao remover usuário.' });
  }
});

// NOVA ROTA PARA ATUALIZAR USUÁRIOS

// Rota para atualizar um usuário (ADMIN APENAS)
app.put('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userIdToUpdate = parseInt(req.params.id, 10);
  const { full_name, username, email, role } = req.body;
  const ipAddress = req.ip;

  // Validação dos dados recebidos
  if (!full_name || !username || !email || !role) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios: Nome Completo, Username, Email e Perfil.' });
  }

  // Não permitimos a alteração de senha por esta rota por segurança.
  // A alteração de senha deve ter uma rota própria e dedicada.

  try {
    const result = await pool.query(
      `UPDATE users SET full_name = $1, username = $2, email = $3, role = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING id, full_name, username, email, role`,
      [full_name, username, email, role, userIdToUpdate]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado para atualização.' });
    }

    await logAudit(req.user.id, 'update_user_success', 'user', userIdToUpdate, { updated_data: result.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Usuário atualizado com sucesso.', user: result.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    // Trata erro de duplicidade de email ou username
    if (error.code === '23505') {
        return res.status(409).json({ message: 'O username ou email já está em uso por outra conta.' });
    }
    await logAudit(req.user.id, 'update_user_error', 'user', userIdToUpdate, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar usuário.' });
  }
});

// ======================================
// NOVA ROTA DE AUDITORIA
// ======================================

// Rota para listar os logs de auditoria (ADMIN APENAS)
app.get('/api/audit-logs', authenticateToken, authorizePermission('AUDIT_VIEW'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         al.id,
         al.action_type,
         al.target_entity,
         al.target_id,
         al.details,
         al.ip_address,
         al.created_at,
         u.full_name as user_name,
         u.username
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 200`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// >>> NOVA ROTA PARA ALTERAÇÃO DE SENHA <<<

// Rota para o usuário logado alterar a própria senha
app.post('/api/users/me/change-password', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // 1. Validações iniciais
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'Todos os campos de senha são obrigatórios.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'A nova senha e a confirmação não correspondem.' });
  }
  if (newPassword.length < 6) { // Exemplo de regra de complexidade
    return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    // 2. Verifica se a senha atual fornecida está correta
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      await logAudit(userId, 'password_change_failed', 'user', userId, { reason: 'Incorrect current password' }, req.ip);
      return res.status(403).json({ message: 'A senha atual está incorreta.' });
    }

    // 3. Criptografa e salva a nova senha
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    await logAudit(userId, 'password_change_success', 'user', userId, null, req.ip);
    res.status(200).json({ message: 'Senha alterada com sucesso!' });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    await logAudit(userId, 'password_change_error', 'user', userId, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao alterar senha.' });
  }
});

// ======================================
// Funções Auxiliares
// ======================================

// Função para gerar SKU (CORRIGIDA)
// Padrão: ABC123XXX
// ABC: três letras da marca (se somente duas, acrescentar 'X')
// 123: sequência numérica crescente
// XXX: sigla do tipo de item
const generateSku = async (brand, itemTypeId) => {
  try {
    // 1. Obter a sigla do tipo de item
    const itemTypeResult = await pool.query('SELECT code FROM item_types WHERE id = $1', [itemTypeId]);
    if (itemTypeResult.rows.length === 0) {
      throw new Error('Tipo de item não encontrado para gerar SKU.');
    }
    const itemTypeCode = itemTypeResult.rows[0].code.toUpperCase(); // Ex: 'NOTE'

    // 2. Obter as três letras da marca
    let brandPrefix = brand.substring(0, 3).toUpperCase();
    while (brandPrefix.length < 3) {
      brandPrefix += 'X'; // Adiciona 'X' se a marca tiver menos de 3 letras
    }

    // 3. Obter a maior sequência numérica existente para essa combinação de prefixo e tipo
    // A query agora extrai a parte numérica do SKU e busca o MAX.
    const maxSeqNumResult = await pool.query(
      `SELECT MAX(CAST(SUBSTRING(sku FROM 4 FOR 3) AS INTEGER)) as max_seq_num
       FROM assets
       WHERE SUBSTRING(sku FROM 1 FOR 3) = $1 AND SUBSTRING(sku FROM 7) = $2`,
      [brandPrefix, itemTypeCode]
    );

    let sequentialNum = 1;
    if (maxSeqNumResult.rows.length > 0 && maxSeqNumResult.rows[0].max_seq_num !== null) {
      sequentialNum = maxSeqNumResult.rows[0].max_seq_num + 1;
    }

    const paddedSequentialNum = String(sequentialNum).padStart(3, '0'); // Garante 3 dígitos (ex: 001, 010, 123)

    return `${brandPrefix}${paddedSequentialNum}${itemTypeCode}`;

  } catch (error) {
    console.error('Erro ao gerar SKU:', error);
    throw new Error('Falha ao gerar SKU.');
  }
};

// Helper para gerar uma abreviação semântica para nomes (ex: "Secretaria de Educação" -> "EDU")
function getSemanticAbbreviation(name, defaultAbbr = 'XXX') {
  // Palavras comuns a serem ignoradas na abreviação
  const commonWords = ['de', 'da', 'do', 'dos', 'das', 'e', 'ou', 'com', 'para', 'em', 'um', 'uma', 'os', 'as', 'a', 'o', 'geral', 'gerência', 'secretaria', 'departamento', 'coordenação'];
  
  // Filtra palavras significativas e as converte para maiúsculas
  const words = name.split(' ')
                    .filter(word => word.length > 2 && !commonWords.includes(word.toLowerCase()))
                    .map(word => word.toUpperCase());

  if (words.length === 0) {
    // Se não houver palavras significativas, tenta pegar as 3 primeiras letras do nome original
    return name.substring(0, 3).toUpperCase().padStart(3, 'X');
  }

  // Prioriza a última palavra significativa para a abreviação
  let abbr = words[words.length - 1].substring(0, 3);

  // Se a abreviação ainda for muito curta e houver mais palavras,
  // tenta combinar as primeiras letras das palavras significativas.
  if (abbr.length < 3 && words.length > 1) {
    abbr = '';
    for (let i = 0; i < words.length && abbr.length < 3; i++) {
      abbr += words[i].charAt(0);
    }
  }
  
  // Garante que a abreviação tenha 3 caracteres, preenchendo com 'X' se necessário
  while (abbr.length < 3) {
    abbr += 'X';
  }
  return abbr.substring(0, 3); // Garante que não exceda 3 caracteres
}


// Função para gerar Código de Setor (semelhante ao SKU)
// Padrão: SETOR-[ABREV_SECRETARIA]-[ABREV_SETOR]-[SEQUENCIAL]
// SETOR: prefixo fixo
// ABREV_SECRETARIA: abreviação semântica da Secretaria (ex: EDU)
// ABREV_SETOR: abreviação semântica do Nome do Setor (ex: JUR, COM)
// SEQUENCIAL: sequência numérica crescente para essa combinação específica
const generateSectorCode = async (secretariat, sectorName) => {
  try {
    const secretariatAbbr = getSemanticAbbreviation(secretariat, 'SEC'); // 'EDU' para 'Secretaria de Educação'
    const sectorNameAbbr = getSemanticAbbreviation(sectorName, 'SET'); // 'JUR' para 'Assuntos Jurídicos'

    const baseCodePart = `SETOR-${secretariatAbbr}-${sectorNameAbbr}`;

    // Busca o maior número sequencial existente para esta baseCodePart
    const maxSeqNumResult = await pool.query(
      `SELECT MAX(CAST(SUBSTRING(code FROM LENGTH($1) + 2) AS INTEGER)) as max_seq_num
       FROM sectors
       WHERE code LIKE $1 || '-%'`, // Ex: 'SETOR-EDU-JUR-%'
      [baseCodePart]
    );

    let sequentialNum = 1;
    if (maxSeqNumResult.rows.length > 0 && maxSeqNumResult.rows[0].max_seq_num !== null) {
      sequentialNum = maxSeqNumResult.rows[0].max_seq_num + 1;
    }

    const paddedSequentialNum = String(sequentialNum).padStart(3, '0');

    return `${baseCodePart}-${paddedSequentialNum}`;

  } catch (error) {
    console.error('Erro ao gerar código de setor:', error);
    throw new Error('Falha ao gerar código de setor.');
  }
};


// ======================================
// Rotas para Tipos de Itens (Item Types)
// ======================================

// Criar um novo Tipo de Item
app.post('/api/item-types', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { name, description } = req.body;
  const ipAddress = req.ip;

  if (!name) {
    return res.status(400).json({ message: 'O nome do tipo de item é obrigatório.' });
  }

  try {
    // Gerar código sequencial para o tipo de item (ex: IT001)
    const lastItemType = await pool.query('SELECT code FROM item_types ORDER BY id DESC LIMIT 1');
    let newCodeNum = 1;
    if (lastItemType.rows.length > 0) {
      const lastCode = lastItemType.rows[0].code;
      const numMatch = lastCode.match(/IT(\d+)/);
      if (numMatch && numMatch[1]) {
            newCodeNum = parseInt(numMatch[1], 10) + 1;
          }
        }
        const code = `IT${String(newCodeNum).padStart(3, '0')}`; // IT001, IT002, etc.

        const newItemType = await pool.query(
          `INSERT INTO item_types (code, name, description)
           VALUES ($1, $2, $3) RETURNING *`,
          [code, name, description]
        );

        await logAudit(req.user.id, 'create_item_type', 'item_type', newItemType.rows[0].id, { name, code }, ipAddress);
        res.status(201).json({ message: 'Tipo de item criado com sucesso.', itemType: newItemType.rows[0] });

      } catch (error) {
        console.error('Erro ao criar tipo de item:', error);
        if (error.code === '23505') { // Código de erro para violação de unique constraint (se ainda existir)
          return res.status(409).json({ message: 'Tipo de item com este nome já existe.' });
        }
        await logAudit(req.user.id, 'create_item_type_error', 'item_type', null, { error: error.message, name }, ipAddress);
        res.status(500).json({ message: 'Erro interno do servidor ao criar tipo de item.' });
      }
    });

// Listar todos os Tipos de Itens
app.get('/api/item-types', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM item_types ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar tipos de itens:', error);
    await logAudit(req.user.id, 'list_item_types_error', 'item_type', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar tipos de itens.' });
  }
});

// Obter Tipo de Item por ID
app.get('/api/item-types/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM item_types WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter tipo de item:', error);
    await logAudit(req.user.id, 'get_item_type_error', 'item_type', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter tipo de item.' });
  }
});

// Atualizar Tipo de Item
app.put('/api/item-types/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const ipAddress = req.ip;

  if (!name) {
    return res.status(400).json({ message: 'O nome do tipo de item é obrigatório.' });
  }

  try {
    const oldItemTypeResult = await pool.query('SELECT * FROM item_types WHERE id = $1', [id]);
    if (oldItemTypeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado para atualização.' });
    }
    const oldItemType = oldItemTypeResult.rows[0];

    const updatedItemType = await pool.query(
      `UPDATE item_types SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [name, description, id]
    );

    await logAudit(req.user.id, 'update_item_type', 'item_type', id, { old_data: oldItemType, new_data: updatedItemType.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Tipo de item atualizado com sucesso.', itemType: updatedItemType.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar tipo de item:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Tipo de item com este nome já existe.' });
    }
    await logAudit(req.user.id, 'update_item_type_error', 'item_type', id, { error: error.message, name }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar tipo de item.' });
  }
});

// Deletar Tipo de Item
app.delete('/api/item-types/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem ativos associados a este tipo de item
    const assetsCount = await pool.query('SELECT COUNT(*) FROM assets WHERE item_type_id = $1', [id]);
    if (parseInt(assetsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar este tipo de item, pois existem ativos associados a ele.' });
    }

    const deletedItemType = await pool.query('DELETE FROM item_types WHERE id = $1 RETURNING *', [id]);
    if (deletedItemType.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_item_type', 'item_type', id, { deleted_item_type: deletedItemType.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Tipo de item deletado com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar tipo de item:', error);
    await logAudit(req.user.id, 'delete_item_type_error', 'item_type', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar tipo de item.' });
  }
});

// ======================================
// Rotas para Setores (Sectors)
// ======================================

// Criar um novo Setor
app.post('/api/sectors', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { secretariat, executive, sector_name, address, contact_phone } = req.body;
  const ipAddress = req.ip;

  if (!secretariat || !sector_name) {
    return res.status(400).json({ message: 'Secretaria e Nome do Setor são obrigatórios.' });
  }

  try {
    // Gerar código de setor usando a nova função
    const code = await generateSectorCode(secretariat, sector_name);

    const newSector = await pool.query(
      `INSERT INTO sectors (code, secretariat, executive, sector_name, address, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code, secretariat, executive, sector_name, address, contact_phone]
    );

    await logAudit(req.user.id, 'create_sector', 'sector', newSector.rows[0].id, { sector_name, code }, ipAddress);
    res.status(201).json({ message: 'Setor criado com sucesso.', sector: newSector.rows[0] });

  } catch (error) {
    console.error('Erro ao criar setor:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Setor com este nome já existe.' });
    }
    await logAudit(req.user.id, 'create_sector_error', 'sector', null, { error: error.message, sector_name }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao criar setor.' });
  }
});

// Listar todos os Setores
app.get('/api/sectors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sectors ORDER BY secretariat, sector_name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar setores:', error);
    await logAudit(req.user.id, 'list_sectors_error', 'sector', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar setores.' });
  }
});

// Obter Setor por ID
app.get('/api/sectors/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM sectors WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Setor não encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter setor:', error);
    await logAudit(req.user.id, 'get_sector_error', 'sector', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter setor.' });
  }
});

// Atualizar Setor
app.put('/api/sectors/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { secretariat, executive, sector_name, address, contact_phone } = req.body;
  const ipAddress = req.ip;

  if (!secretariat || !sector_name) {
    return res.status(400).json({ message: 'Secretaria e Nome do Setor são obrigatórios.' });
  }

  try {
    const oldSectorResult = await pool.query('SELECT * FROM sectors WHERE id = $1', [id]);
    if (oldSectorResult.rows.length === 0) {
      return res.status(404).json({ message: 'Setor não encontrado para atualização.' });
    }
    const oldSector = oldSectorResult.rows[0];

    const updatedSector = await pool.query(
      `UPDATE sectors SET secretariat = $1, executive = $2, sector_name = $3, address = $4, contact_phone = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [secretariat, executive, sector_name, address, contact_phone, id]
    );

    await logAudit(req.user.id, 'update_sector', 'sector', id, { old_data: oldSector, new_data: updatedSector.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Setor atualizado com sucesso.', sector: updatedSector.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar setor:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Setor com este nome já existe.' });
    }
    await logAudit(req.user.id, 'update_sector_error', 'sector', id, { error: error.message, sector_name }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar setor.' });
  }
});

// Deletar Setor
  app.delete('/api/sectors/:id', authenticateToken, authorizePermission('DATA_DELETE'), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem ativos associados a este setor
    const assetsCount = await pool.query('SELECT COUNT(*) FROM assets WHERE current_sector_id = $1', [id]);
    if (parseInt(assetsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar este setor, pois existem ativos associados a ele.' });
    }
    // Verificar se existem pessoas associadas a este setor
    const peopleCount = await pool.query('SELECT COUNT(*) FROM people WHERE sector_id = $1', [id]);
    if (parseInt(peopleCount.rows[0].count, 10) > 0) {
        return res.status(400).json({ message: 'Não é possível deletar este setor, pois existem pessoas associadas a ele.' });
    }
    // Verificar se existem movimentações de ativos com este setor como destino
    const movementsCount = await pool.query('SELECT COUNT(*) FROM asset_movements WHERE destination_sector_id = $1', [id]);
    if (parseInt(movementsCount.rows[0].count, 10) > 0) {
        return res.status(400).json({ message: 'Não é possível deletar este setor, pois existem movimentações de ativos que o utilizam como setor de destino.' });
    }


    const deletedSector = await pool.query('DELETE FROM sectors WHERE id = $1 RETURNING *', [id]);
    if (deletedSector.rows.length === 0) {
      return res.status(404).json({ message: 'Setor não encontrado para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_sector', 'sector', id, { deleted_sector: deletedSector.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Setor deletado com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar setor:', error);
    await logAudit(req.user.id, 'delete_sector_error', 'sector', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar setor.' });
  }
});

// ======================================
// Rotas para Pessoas (People) - NOVA FUNCIONALIDADE
// ======================================

// Criar uma nova Pessoa
app.post('/api/people', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { full_name, sector_id, registration_number, cpf, email } = req.body;
  const ipAddress = req.ip;

  if (!full_name || !cpf || !email) { // CPF e Email são NOT NULL no DB
    return res.status(400).json({ message: 'Nome Completo, CPF e Email são obrigatórios.' });
  }

  try {
    // Verificar unicidade de CPF, Matrícula e Email
    const existingPerson = await pool.query(
      `SELECT id FROM people WHERE cpf = $1 OR registration_number = $2 OR email = $3`,
      [cpf, registration_number, email]
    );
    if (existingPerson.rows.length > 0) {
      await logAudit(req.user.id, 'person_creation_failed', 'person', null, { reason: 'CPF, Registration Number or Email already exists', attempted_cpf: cpf, attempted_registration: registration_number, attempted_email: email }, ipAddress);
      return res.status(409).json({ message: 'Pessoa com este CPF, Matrícula ou Email já cadastrada.' });
    }

    const newPerson = await pool.query(
      `INSERT INTO people (full_name, sector_id, registration_number, cpf, email)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, sector_id, registration_number, cpf, email`,
      [full_name, sector_id || null, registration_number || null, cpf, email]
    );

    await logAudit(req.user.id, 'create_person', 'person', newPerson.rows[0].id, { full_name, cpf, email }, ipAddress);
    res.status(201).json({ message: 'Pessoa cadastrada com sucesso.', person: newPerson.rows[0] });

  } catch (error) {
    console.error('Erro ao cadastrar nova pessoa:', error);
    await logAudit(req.user.id, 'person_creation_error', 'person', null, { error: error.message, full_name, cpf, email }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar pessoa.' });
  }
});

// Listar todas as Pessoas
app.get('/api/people', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         s.secretariat,
         s.executive,
         s.sector_name
       FROM people p
       LEFT JOIN sectors s ON p.sector_id = s.id
       ORDER BY p.full_name ASC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar pessoas:', error);
    await logAudit(req.user.id, 'list_people_error', 'person', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar pessoas.' });
  }
});

// Obter Pessoa por ID
app.get('/api/people/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         s.secretariat,
         s.executive,
         s.sector_name
       FROM people p
       LEFT JOIN sectors s ON p.sector_id = s.id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter pessoa:', error);
    await logAudit(req.user.id, 'get_person_error', 'person', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter pessoa.' });
  }
});

// Atualizar Pessoa
app.put('/api/people/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { full_name, sector_id, registration_number, cpf, email } = req.body;
  const ipAddress = req.ip;

  if (!full_name || !cpf || !email) {
    return res.status(400).json({ message: 'Nome Completo, CPF e Email são obrigatórios.' });
  }

  try {
    const oldPersonResult = await pool.query('SELECT * FROM people WHERE id = $1', [id]);
    if (oldPersonResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada para atualização.' });
    }
    const oldPerson = oldPersonResult.rows[0];

    // Verificar unicidade de CPF, Matrícula e Email, excluindo o próprio registro
    const existingConflicts = await pool.query(
      `SELECT id FROM people
       WHERE (cpf = $1 OR registration_number = $2 OR email = $3) AND id != $4`,
      [cpf, registration_number, email, id]
    );
    if (existingConflicts.rows.length > 0) {
      await logAudit(req.user.id, 'person_update_failed', 'person', id, { reason: 'CPF, Registration Number or Email already exists for another person', attempted_cpf: cpf, attempted_registration: registration_number, attempted_email: email }, ipAddress);
      return res.status(409).json({ message: 'Pessoa com este CPF, Matrícula ou Email já existe para outro cadastro.' });
    }

    const updatedPerson = await pool.query(
      `UPDATE people SET
         full_name = $1, sector_id = $2, registration_number = $3, cpf = $4, email = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [full_name, sector_id || null, registration_number || null, cpf, email, id]
    );

    await logAudit(req.user.id, 'update_person', 'person', id, { old_data: oldPerson, new_data: updatedPerson.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Pessoa atualizada com sucesso.', person: updatedPerson.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar pessoa:', error);
    if (error.code === '23505') { // Unique violation for CPF, registration_number or email
        return res.status(409).json({ message: 'CPF, Matrícula ou Email já existe para outra pessoa.' });
    }
    await logAudit(req.user.id, 'person_update_error', 'person', id, { error: error.message, full_name, cpf, email }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar pessoa.' });
  }
});

// Deletar Pessoa
app.delete('/api/people/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem movimentações de ativos associadas a esta pessoa
    const movementsCount = await pool.query('SELECT COUNT(*) FROM asset_movements WHERE recipient_person_id = $1', [id]);
    if (parseInt(movementsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar esta pessoa, pois existem movimentações de ativos associadas a ela.' });
    }

    const deletedPerson = await pool.query('DELETE FROM people WHERE id = $1 RETURNING *', [id]);
    if (deletedPerson.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_person', 'person', id, { deleted_person: deletedPerson.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Pessoa deletada com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar pessoa:', error);
    await logAudit(req.user.id, 'delete_person_error', 'person', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar pessoa.' });
  }
});

// NOVO ENDPOINT 1: Listar ativos atualmente associados a uma pessoa
app.get('/api/people/:id/assets', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Esta query encontra os ativos cuja movimentação mais recente foi um 'loan' ou 'exit' para esta pessoa.
    const query = `
      WITH LatestMovement AS (
          SELECT
              ma.asset_id,
              MAX(am.movement_date) as max_date
          FROM asset_movements am
          JOIN movement_assets ma ON am.id = ma.movement_id
          GROUP BY ma.asset_id
      ),
      CurrentResponsible AS (
          SELECT
              ma.asset_id,
              am.recipient_person_id,
              a.status
          FROM asset_movements am
          JOIN movement_assets ma ON am.id = ma.movement_id
          JOIN assets a ON a.id = ma.asset_id
          JOIN LatestMovement lm ON ma.asset_id = lm.asset_id AND am.movement_date = lm.max_date
          WHERE a.status IN ('loaned', 'in_use')
      )
      SELECT
          a.id, a.sku, a.brand, a.model, a.serial_number, a.patrimonio_number,
          it.name as item_type_name
      FROM assets a
      JOIN item_types it ON a.item_type_id = it.id
      JOIN CurrentResponsible cr ON a.id = cr.asset_id
      WHERE cr.recipient_person_id = $1;
    `;
    const result = await pool.query(query, [id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(`Erro ao buscar ativos da pessoa ${id}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar ativos da pessoa.' });
  }
});

// NOVO ENDPOINT 2: Encontrar um ativo e seu responsável para devolução
app.post('/api/assets/find-for-return', authenticateToken, async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ message: 'Identificador (patrimônio ou nº de série) é obrigatório.' });
  }

  try {
    // 1. Encontrar o ativo
    const assetResult = await pool.query(
        `SELECT a.*, it.name as item_type_name 
         FROM assets a 
         JOIN item_types it ON a.item_type_id = it.id 
         WHERE a.patrimonio_number = $1 OR a.serial_number = $1`, [identifier]
    );
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado.' });
    }
    const asset = assetResult.rows[0];

    // 2. Verificar se o ativo pode ser devolvido
    if (!['loaned', 'in_use'].includes(asset.status)) {
        return res.status(409).json({ message: `Este ativo não pode ser devolvido. Status atual: '${asset.status}'.` });
    }

    // 3. Encontrar o responsável atual
    const movementQuery = `
      SELECT am.recipient_person_id
      FROM asset_movements am
      JOIN movement_assets ma ON am.id = ma.movement_id
      WHERE ma.asset_id = $1 AND am.movement_type IN ('loan', 'exit')
      ORDER BY am.movement_date DESC
      LIMIT 1;
    `;
    const movementResult = await pool.query(movementQuery, [asset.id]);
    if (movementResult.rows.length === 0) {
        return res.status(404).json({ message: 'Não foi possível encontrar o responsável atual por este ativo.' });
    }
    const personId = movementResult.rows[0].recipient_person_id;

    // Se o personId for nulo (pode acontecer em saídas antigas sem pessoa vinculada), retorne um erro apropriado.
    if (!personId) {
        return res.status(404).json({ message: 'O ativo foi movimentado, mas não há um responsável (pessoa) vinculado à última saída.' });
    }

    // 4. Buscar os dados do responsável
    const personResult = await pool.query('SELECT * FROM people WHERE id = $1', [personId]);
    if (personResult.rows.length === 0) {
        return res.status(404).json({ message: 'Cadastro do responsável pelo ativo não encontrado.' });
    }
    const person = personResult.rows[0];

    // 5. Retornar ambos
    res.status(200).json({ asset, person });

  } catch (error) {
    console.error('Erro ao buscar ativo para devolução:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// NOVO ENDPOINT: Rota para importar Pessoas via XLSX/CSV
app.post('/api/people/import', authenticateToken, authorizeRole(['admin', 'manager']), upload.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  let importedCount = 0;
  let errors = [];

  try {
    // Processa o arquivo XLSX ou CSV para extrair os dados
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' })) // Adicionado separador ';' comum em CSVs no Brasil
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }

    fs.unlinkSync(filePath); // Remove o arquivo temporário após a leitura

    // Itera sobre cada linha do arquivo para inserir no banco
    for (const [index, row] of data.entries()) {
      const line = index + 2; // +2 para corresponder à linha do arquivo (considerando o cabeçalho)
      const {
        full_name,
        cpf,
        email,
        registration_number,
        sector_name // O arquivo virá com o nome do setor, não o ID
      } = row;

      if (!full_name || !cpf || !email) {
        errors.push(`Linha ${line}: Ignorada. Nome completo, CPF e E-mail são obrigatórios.`);
        continue;
      }

      // Inicia uma transação por linha para garantir a integridade
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Verifica se a pessoa já existe pelo CPF ou E-mail
        const existingPerson = await client.query('SELECT id FROM people WHERE cpf = $1 OR email = $2', [cpf, email]);
        if (existingPerson.rows.length > 0) {
          errors.push(`Linha ${line}: Pessoa com CPF '${cpf}' ou E-mail '${email}' já existe. Ignorada.`);
          await client.query('ROLLBACK');
          continue;
        }

        let sectorId = null;
        // Se um nome de setor foi fornecido, busca o ID correspondente
        if (sector_name) {
          const sectorResult = await client.query('SELECT id FROM sectors WHERE sector_name = $1', [sector_name]);
          if (sectorResult.rows.length > 0) {
            sectorId = sectorResult.rows[0].id;
          } else {
            errors.push(`Linha ${line}: Setor '${sector_name}' não encontrado. A pessoa será cadastrada sem setor.`);
          }
        }
        
        // Insere a nova pessoa
        await client.query(
          `INSERT INTO people (full_name, cpf, email, registration_number, sector_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [full_name, cpf, email, registration_number || null, sectorId]
        );

        await client.query('COMMIT');
        importedCount++;
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error('Erro ao importar pessoa da linha:', row, dbError);
        errors.push(`Linha ${line}: Erro no banco de dados ao importar '${full_name}': ${dbError.message}`);
      } finally {
        client.release();
      }
    }

    await logAudit(req.user.id, 'import_people', 'person', null, { imported_count: importedCount, errors_count: errors.length, errors }, ipAddress);
    res.status(200).json({
      message: `Importação concluída. ${importedCount} pessoas importadas.`,
      errors: errors,
    });

  } catch (error) {
    console.error('Erro geral na importação de pessoas:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await logAudit(req.user.id, 'import_people_error', 'person', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar pessoas.', error: error.message });
  }
});

// ======================================
// Rotas para Ativos (Assets)
// ======================================

// Criar um novo Ativo (Cadastro Manual)
  app.post('/api/assets', authenticateToken, authorizePermission('DATA_MANAGE'), async (req, res) => {
  const { item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_sector_id, acquisition_date, warranty_end_date, notes } = req.body;
  const ipAddress = req.ip;

  if (!item_type_id || !brand || !model || !status) {
    return res.status(400).json({ message: 'Tipo de Item, Marca, Modelo e Status são obrigatórios.' });
  }

  try {
    // Gerar SKU automaticamente
    const sku = await generateSku(brand, item_type_id);

    const newAsset = await pool.query(
      `INSERT INTO assets (sku, item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_sector_id, acquisition_date, warranty_end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [sku, item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_sector_id, acquisition_date, warranty_end_date, notes]
    );

    await logAudit(req.user.id, 'create_asset', 'asset', newAsset.rows[0].id, { sku, brand, model }, ipAddress);
    res.status(201).json({ message: 'Ativo criado com sucesso.', asset: newAsset.rows[0] });

  } catch (error) {
    console.error('Erro ao criar ativo:', error);
    if (error.code === '23505') { // Unique violation for serial_number or patrimonio_number or SKU
      return res.status(409).json({ message: 'Número de série, número de patrimônio ou SKU já existe.' });
    }
    await logAudit(req.user.id, 'create_asset_error', 'asset', null, { error: error.message, brand, model }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao criar ativo.' });
  }
});

// Listar todos os Ativos (com filtros e paginação, se necessário no futuro)
app.get('/api/assets', authenticateToken, async (req, res) => {
  try {
    // Join com item_types e sectors para obter nomes legíveis
    const result = await pool.query(
      `SELECT
         a.*,
         it.name AS item_type_name,
         s.sector_name AS current_sector_name,
         s.secretariat AS current_sector_secretariat
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN sectors s ON a.current_sector_id = s.id
       ORDER BY a.sku ASC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar ativos:', error);
    await logAudit(req.user.id, 'list_assets_error', 'asset', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar ativos.' });
  }
});

// Obter Ativo por ID
app.get('/api/assets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter ativo:', error);
    await logAudit(req.user.id, 'get_asset_error', 'asset', id, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao obter ativo.' });
  }
});

// NOVO ENDPOINT: Obter Ativo por Número de Patrimônio
app.get('/api/assets/by-patrimonio/:patrimonio_number', authenticateToken, async (req, res) => {
  const { patrimonio_number } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.sku,
         a.brand,
         a.model,
         a.description,
         a.serial_number,
         a.patrimonio_number,
         it.name AS item_type_name,
         a.status
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       WHERE a.patrimonio_number = $1`,
      [patrimonio_number]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado com este número de patrimônio.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter ativo por número de patrimônio:', error);
    await logAudit(req.user.id, 'get_asset_by_patrimonio_error', 'asset', null, { error: error.message, patrimonio_number }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar ativo por número de patrimônio.' });
  }
});

// NOVO ENDPOINT: Validar ativo para uma movimentação
app.post('/api/assets/validate-for-movement', authenticateToken, async (req, res) => {
  const { patrimonio_number, movement_type } = req.body;

  if (!patrimonio_number || !movement_type) {
    return res.status(400).json({ message: 'Número de patrimônio e tipo de movimentação são obrigatórios.' });
  }

  try {
    const assetResult = await pool.query(
      `SELECT a.*, it.name as item_type_name 
       FROM assets a 
       JOIN item_types it ON a.item_type_id = it.id 
       WHERE a.patrimonio_number = $1`,
      [patrimonio_number]
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado com este número de patrimônio.' });
    }

    const asset = assetResult.rows[0];
    const currentAssetStatus = asset.status;
    let errorMessage = null;

    // Lógica de validação baseada no tipo de movimentação
    switch (movement_type) {
      case 'loan':
      case 'exit':
        if (currentAssetStatus !== 'available') {
          errorMessage = `Este ativo não pode ser movimentado. Status atual: '${currentAssetStatus}'. Apenas ativos 'disponíveis' podem ter saída ou empréstimo.`;
        }
        break;
      case 'return':
        if (!['loaned', 'in_use', 'maintenance'].includes(currentAssetStatus)) {
          errorMessage = `Este ativo não pode ser devolvido. Status atual: '${currentAssetStatus}'.`;
        }
        break;
      case 'maintenance':
        if (['retired', 'disposed'].includes(currentAssetStatus)) {
          errorMessage = `Este ativo baixado ('${currentAssetStatus}') não pode ser enviado para manutenção.`;
        }
        break;
    }

    if (errorMessage) {
      // Retorna um erro 409 Conflict, que semanticamente indica um conflito com o estado atual do recurso.
      return res.status(409).json({ message: errorMessage });
    }

    // Se passou por todas as validações, retorna o ativo com sucesso.
    res.status(200).json(asset);

  } catch (error) {
    console.error('Erro ao validar ativo para movimentação:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Atualizar Ativo
app.put('/api/assets/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_sector_id, acquisition_date, warranty_end_date, notes } = req.body;
  const ipAddress = req.ip;

  if (!item_type_id || !brand || !model || !status) {
    return res.status(400).json({ message: 'Tipo de Item, Marca, Modelo e Status são obrigatórios.' });
  }

  try {
    const oldAssetResult = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (oldAssetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado para atualização.' });
    }
    const oldAsset = oldAssetResult.rows[0];

    // Se o tipo de item ou a marca mudarem, o SKU precisa ser recalculado
    let sku = oldAsset.sku;
    if (oldAsset.item_type_id !== item_type_id || oldAsset.brand !== brand) {
      sku = await generateSku(brand, item_type_id);
    }

    const updatedAsset = await pool.query(
      `UPDATE assets SET
         sku = $1, item_type_id = $2, brand = $3, model = $4, description = $5,
         serial_number = $6, patrimonio_number = $7, unit_of_measure = $8, status = $9,
         current_sector_id = $10, acquisition_date = $11, warranty_end_date = $12, notes = $13,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $14 RETURNING *`,
      [sku, item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_sector_id, acquisition_date, warranty_end_date, notes, id]
    );

    await logAudit(req.user.id, 'update_asset', 'asset', id, { old_data: oldAsset, new_data: updatedAsset.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Ativo atualizado com sucesso.', asset: updatedAsset.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar ativo:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Número de série, número de patrimônio ou SKU já existe para outro ativo.' });
    }
    await logAudit(req.user.id, 'update_asset_error', 'asset', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar ativo.' });
  }
});

// Deletar Ativo
app.delete('/api/assets/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem movimentações associadas a este ativo
    const movementsCount = await pool.query('SELECT COUNT(*) FROM movement_assets WHERE asset_id = $1', [id]); // Alterado para movement_assets
    if (parseInt(movementsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar este ativo, pois existem movimentações registradas para ele.' });
    }

    const deletedAsset = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
    if (deletedAsset.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_asset', 'asset', id, { deleted_asset: deletedAsset.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Ativo deletado com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar ativo:', error);
    await logAudit(req.user.id, 'delete_asset_error', 'asset', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar ativo.' });
  }
});

// ======================================
// Rotas de Importação (XLSX/CSV)
// ======================================

// Rota para importar Tipos de Itens via XLSX/CSV
app.post('/api/item-types/import', authenticateToken, authorizeRole(['admin', 'manager']), upload.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];

  try {
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => {
            data = results;
            resolve();
          })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath); // Remove o arquivo temporário
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }

    fs.unlinkSync(filePath); // Remove o arquivo temporário após processamento

    let importedCount = 0;
    let errors = [];

    for (const row of data) {
      const name = row['Tipo de Item'] || row['name'];
      const description = row['Descrição'] || row['description'];

      if (!name) {
        errors.push(`Linha ignorada: Nome do tipo de item ausente. Dados: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        // Verifica se o tipo de item já existe
        const existingItemType = await pool.query('SELECT id FROM item_types WHERE name = $1', [name]);
        if (existingItemType.rows.length > 0) {
          errors.push(`Tipo de item '${name}' já existe. Linha ignorada.`);
          continue;
        }

        // Gerar código sequencial para o tipo de item
        const lastItemType = await pool.query('SELECT code FROM item_types ORDER BY id DESC LIMIT 1');
        let newCodeNum = 1;
        if (lastItemType.rows.length > 0) {
          const lastCode = lastItemType.rows[0].code;
          const numMatch = lastCode.match(/IT(\d+)/);
          if (numMatch && numMatch[1]) {
            newCodeNum = parseInt(numMatch[1], 10) + 1;
          }
        }
        const code = `IT${String(newCodeNum).padStart(3, '0')}`; // IT001, IT002, etc.

        await pool.query(
          `INSERT INTO item_types (code, name, description)
           VALUES ($1, $2, $3)`,
          [code, name, description]
        );
        importedCount++;
      } catch (dbError) {
        console.error('Erro ao importar tipo de item da linha:', row, dbError);
        errors.push(`Erro ao importar tipo de item '${name}': ${dbError.message}`);
      }
    }

    await logAudit(req.user.id, 'import_item_types', 'item_type', null, { imported_count: importedCount, errors_count: errors.length, errors }, ipAddress);
    res.status(200).json({
      message: `Importação de tipos de itens concluída. ${importedCount} tipos importados.`,
      errors: errors,
    });

  } catch (error) {
    console.error('Erro geral na importação de tipos de itens:', error);
    fs.unlinkSync(filePath); // Tenta remover o arquivo temporário em caso de erro
    await logAudit(req.user.id, 'import_item_types_error', 'item_type', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar tipos de itens.', error: error.message });
  }
});

// Rota para importar Setores via XLSX/CSV
app.post('/api/sectors/import', authenticateToken, authorizeRole(['admin', 'manager']), upload.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];

  try {
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => {
            data = results;
            resolve();
          })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }

    fs.unlinkSync(filePath);

    let importedCount = 0;
    let errors = [];

    for (const row of data) {
      const secretariat = row['Secretaria'] || row['secretariat'];
      const executive = row['Executiva'] || row['executive'];
      const sector_name = row['Setor'] || row['sector_name'];
      const address = row['Endereço'] || row['address'];
      const contact_phone = row['Telefone de Contato'] || row['contact_phone'];

      if (!secretariat || !sector_name) {
        errors.push(`Linha ignorada: Secretaria ou Nome do Setor ausente. Dados: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        // Verifica se o setor já existe (pela combinação de secretariat e sector_name)
        const existingSector = await pool.query('SELECT id FROM sectors WHERE secretariat = $1 AND sector_name = $2', [secretariat, sector_name]);
        if (existingSector.rows.length > 0) {
          errors.push(`Setor '${sector_name}' na secretaria '${secretariat}' já existe. Linha ignorada.`);
          continue;
        }

        // NOVO: Gerar código de setor usando a nova função
        const code = await generateSectorCode(secretariat, sector_name);

        await pool.query(
          `INSERT INTO sectors (code, secretariat, executive, sector_name, address, contact_phone)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [code, secretariat, executive, sector_name, address, contact_phone]
        );
        importedCount++;
      } catch (dbError) {
        console.error('Erro ao importar setor da linha:', row, dbError);
        errors.push(`Erro ao importar setor '${sector_name}': ${dbError.message}`);
      }
    }

    await logAudit(req.user.id, 'import_sectors', 'sector', null, { imported_count: importedCount, errors_count: errors.length, errors }, ipAddress);
    res.status(200).json({
      message: `Importação de setores concluída. ${importedCount} setores importados.`,
      errors: errors,
    });

  } catch (error) {
    console.error('Erro geral na importação de setores:', error);
    fs.unlinkSync(filePath);
    await logAudit(req.user.id, 'import_sectors_error', 'sector', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar setores.', error: error.message });
  }
});


// ======================================
// Rotas de Relatórios Iniciais
// ======================================

// Rota para exportar lista de ativos em CSV
app.get('/api/reports/assets/csv', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const result = await pool.query(
      `SELECT
         a.sku,
         it.name AS item_type_name,
         a.brand,
         a.model,
         a.description,
         a.serial_number,
         a.patrimonio_number,
         a.unit_of_measure,
         a.status,
         s.secretariat AS current_sector_secretariat,
         s.sector_name AS current_sector_name,
         a.acquisition_date,
         a.warranty_end_date,
         a.notes,
         a.created_at
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN sectors s ON a.current_sector_id = s.id
       ORDER BY a.sku ASC`
    );

    const assets = result.rows;
    if (assets.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado para gerar relatório.' });
    }

    // Cria o cabeçalho do CSV
    const headers = [
      'SKU', 'Tipo de Item', 'Marca', 'Modelo', 'Descrição', 'Número de Série',
      'Número de Patrimônio', 'Unidade de Medida', 'Status', 'Secretaria Atual',
      'Setor Atual', 'Data de Aquisição', 'Data Fim Garantia', 'Observações', 'Data de Criação'
    ];
    const csvRows = [headers.join(',')];

    // Adiciona os dados
    for (const asset of assets) {
      const row = [
        asset.sku,
        asset.item_type_name,
        asset.brand,
        asset.model,
        asset.description ? `"${asset.description.replace(/"/g, '""')}"` : '', // Escapa aspas duplas
        asset.serial_number,
        asset.patrimonio_number,
        asset.unit_of_measure,
        asset.status,
        asset.current_sector_secretariat,
        asset.current_sector_name,
        asset.acquisition_date ? asset.acquisition_date.toISOString().split('T')[0] : '',
        asset.warranty_end_date ? asset.warranty_end_date.toISOString().split('T')[0] : '',
        asset.notes ? `"${asset.notes.replace(/"/g, '""')}"` : '',
        asset.created_at ? asset.created_at.toISOString() : ''
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('relatorio_ativos.csv');
    res.send(csvString);

    await logAudit(req.user.id, 'generate_report', 'asset_report_csv', null, { format: 'CSV', count: assets.length }, ipAddress);
  } catch (error) {
    console.error('Erro ao gerar relatório CSV de ativos:', error);
    await logAudit(req.user.id, 'generate_report_error', 'asset_report_csv', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório CSV de ativos.' });
  }
});

// Rota para exportar lista de ativos em XLSX
app.get('/api/reports/assets/xlsx', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const result = await pool.query(
      `SELECT
         a.sku,
         it.name AS item_type_name,
         a.brand,
         a.model,
         a.description,
         a.serial_number,
         a.patrimonio_number,
         a.unit_of_measure,
         a.status,
         s.secretariat AS current_sector_secretariat,
         s.sector_name AS current_sector_name,
         a.acquisition_date,
         a.warranty_end_date,
         a.notes,
         a.created_at
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN sectors s ON a.current_sector_id = s.id
       ORDER BY a.sku ASC`
    );

    const assets = result.rows;
    if (assets.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado para gerar relatório.' });
    }

    const worksheet = XLSX.utils.json_to_sheet(assets);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ativos');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment('relatorio_ativos.xlsx'); // Corrigido para .xlsx
    res.send(buffer);

    await logAudit(req.user.id, 'generate_report', 'asset_report_xlsx', null, { format: 'XLSX', count: assets.length }, ipAddress);
  } catch (error) {
    console.error('Erro ao gerar relatório XLSX de ativos:', error);
    await logAudit(req.user.id, 'generate_report_error', 'asset_report_xlsx', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório XLSX de ativos.' });
  }
});

// Rota para exportar lista de ativos em PDF (usando pdfmake)
app.get('/api/reports/assets/pdf', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const result = await pool.query(
      `SELECT
         a.sku,
         it.name AS item_type_name,
         a.brand,
         a.model,
         a.status,
         s.sector_name AS current_sector_name
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN sectors s ON a.current_sector_id = s.id
       ORDER BY a.sku ASC`
    );

    const assets = result.rows;
    if (assets.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado para gerar relatório.' });
    }

    // Estrutura do documento PDF para pdfmake
    const docDefinition = {
      content: [
        { text: 'PREFEITURA DO RECIFE', style: 'header', alignment: 'center' },
        { text: 'SECRETARIA DE EDUCAÇÃO', style: 'subheader', alignment: 'center' },
        { text: 'Sistema de Gestão de Ativos - SGA', style: 'subheader', alignment: 'center' },
        { text: '\n\n' },
        { text: `RELATÓRIO DE ATIVOS`, style: 'documentTitle', alignment: 'center' },
        { text: `\nData de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, alignment: 'right' },
        { text: '\n\n' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*'], // Larguras das colunas
            body: [
              // Cabeçalho da tabela
              ['SKU', 'Tipo de Item', 'Marca', 'Modelo', 'Status', 'Setor Atual'].map(header => ({ text: header, style: 'tableHeader' })),
              // Dados dos ativos
              ...assets.map(asset => [
                asset.sku,
                asset.item_type_name,
                asset.brand,
                asset.model,
                asset.status,
                asset.current_sector_name || 'N/A'
              ])
            ]
          },
          layout: {
            hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 2 : 1; },
            vLineWidth: function (i, node) { return (i === 0 || i === node.table.widths.length) ? 2 : 1; },
            hLineColor: function (i, node) { return (i === 0 || i === node.table.body.length) ? '#007bff' : '#ccc'; },
            vLineColor: function (i, node) { return (i === 0 || i === node.table.widths.length) ? '#007bff' : '#ccc'; },
            paddingLeft: function(i, node) { return 8; },
            paddingRight: function(i, node) { return 8; },
            paddingTop: function(i, node) { return 5; },
            paddingBottom: function(i, node) { return 5; },
          }
        },
        '\n\n',
        { text: `Total de Ativos: ${assets.length}`, alignment: 'right', style: 'footer' }
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 5],
          color: '#0056b3' // Azul mais escuro
        },
        subheader: {
          fontSize: 12,
          margin: [0, 0, 0, 5]
        },
        documentTitle: {
          fontSize: 18,
          bold: true,
          margin: [0, 10, 0, 10],
          decoration: 'underline'
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 15, 0, 5],
          color: '#0056b3'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#007bff', // Azul da prefeitura
          alignment: 'center',
          margin: [0, 5, 0, 5]
        },
        footer: {
          fontSize: 10,
          italics: true,
          color: '#343a40' // Cinza escuro
        }
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        alignment: 'left'
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    let resultBuffer;

    pdfDoc.on('data', function (chunk) {
      chunks.push(chunk);
    });
    pdfDoc.on('end', function () {
      resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_ativos.pdf');
      res.send(resultBuffer);
      logAudit(req.user.id, 'generate_report', 'asset_report_pdf', null, { format: 'PDF', count: assets.length }, ipAddress);
    });

    pdfDoc.on('error', (err) => {
      console.error('Erro durante a geração do PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erro interno do servidor ao gerar o PDF.' });
      }
      logAudit(req.user.id, 'generate_report_error', 'asset_report_pdf', null, { error: err.message }, ipAddress);
    });

    pdfDoc.end();

  } catch (error) {
    console.error('Erro ao gerar relatório PDF de ativos (catch principal):', error);
    await logAudit(req.user.id, 'generate_report_error', 'asset_report_pdf', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar relatório PDF de ativos.' });
  }
});

// ======================================
// Rotas para Movimentações de Ativos (Asset Movements) - ATUALIZADO PARA MÚLTIPLOS ATIVOS
// ======================================

// Registrar uma nova movimentação de ativo (Entrada, Saída, Empréstimo, Devolução, Manutenção)
app.post('/api/asset-movements', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const {
    asset_ids, // AGORA É UM ARRAY DE IDS DE ATIVOS
    movement_type,
    recipient_person_id,
    recipient_name,
    recipient_document,
    purpose,
    expected_return_date,
    notes,
    destination_sector_id, // NOVO: Setor de destino
    request_channel_type, // NOVO: Tipo de canal da solicitação
    request_channel_details // NOVO: Detalhes do canal da solicitação
  } = req.body;
  const responsible_user_id = req.user.id; // Usuário autenticado é o responsável
  const ipAddress = req.ip;

  if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0 || !movement_type || !responsible_user_id) {
    return res.status(400).json({ message: 'IDs dos ativos (array), tipo de movimentação e usuário responsável são obrigatórios.' });
  }

  // Validação para garantir que recipient_person_id ou recipient_name/documento seja fornecido para certos tipos de movimento
  if (['loan', 'exit'].includes(movement_type) && !recipient_person_id && (!recipient_name || !recipient_document)) {
    return res.status(400).json({ message: 'Para empréstimo ou saída, é necessário informar um recebedor (selecionando uma pessoa cadastrada ou informando nome e documento).' });
  }

  // Validação para setor de destino em Saída/Empréstimo
  if (['loan', 'exit'].includes(movement_type) && !destination_sector_id) {
    return res.status(400).json({ message: 'Para empréstimo ou saída, o setor de destino é obrigatório.' });
  }

  // Validação para Canal da Solicitação
  if (request_channel_type) {
    if (request_channel_type === 'SEI' && !request_channel_details) {
      return res.status(400).json({ message: 'Para Canal SEI, o número do SEI é obrigatório.' });
    }
    if (request_channel_type === 'Ordem Direta' && !request_channel_details) {
      return res.status(400).json({ message: 'Para Canal Ordem Direta, o nome e cargo do ordenante são obrigatórios.' });
    }
  }

  let client; // Mova a declaração para fora para ser acessível no finally
  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Inicia a transação

    // 1. Inserir a nova movimentação principal
    const newMovementResult = await client.query(
      `INSERT INTO asset_movements (
         movement_type, responsible_user_id, recipient_person_id, recipient_name,
         recipient_document, purpose, expected_return_date, notes,
         destination_sector_id, request_channel_type, request_channel_details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        movement_type, responsible_user_id, req.body.recipient_person_id || null, req.body.recipient_name || null,
        req.body.recipient_document || null, purpose || null, expected_return_date || null, notes || null,
        req.body.destination_sector_id || null, request_channel_type || null, request_channel_details || null
      ]
    );
    const newMovementId = newMovementResult.rows[0].id;

    let newAssetStatus;

    // 2. Processar cada ativo na movimentação
    for (const asset_id of asset_ids) {
      const assetResult = await client.query('SELECT status FROM assets WHERE id = $1', [asset_id]);
      if (assetResult.rows.length === 0) {
        throw new Error(`Ativo com ID ${asset_id} não encontrado.`);
      }
      const currentAssetStatus = assetResult.rows[0].status;
      newAssetStatus = currentAssetStatus;

      // ... (o seu switch case completo aqui, sem alterações)
      switch (movement_type) {
        case 'entry':
          newAssetStatus = 'available';
          await client.query(
            `UPDATE assets SET status = $1, current_sector_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_sector_id || null, asset_id]
          );
          break;
        case 'exit':
          if (currentAssetStatus !== 'available') {
            throw new Error(`Ativo ${asset_id} não pode ter saída. Status atual: ${currentAssetStatus}.`);
          }
          newAssetStatus = 'in_use';
          await client.query(
            `UPDATE assets SET status = $1, current_sector_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_sector_id || null, asset_id]
          );
          break;
        case 'loan':
          if (currentAssetStatus !== 'available') {
            throw new Error(`Ativo ${asset_id} não pode ser emprestado. Status atual: ${currentAssetStatus}.`);
          }
          if (!expected_return_date) {
            throw new Error('Data de devolução esperada é obrigatória para empréstimos.');
          }
          newAssetStatus = 'loaned';
          await client.query(
            `UPDATE assets SET status = $1, current_sector_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_sector_id || null, asset_id]
          );
          break;
        case 'return':
        if (!['loaned', 'in_use', 'maintenance'].includes(currentAssetStatus)) {
          throw new Error(`Ativo ${asset_id} não pode ser devolvido. Status atual: ${currentAssetStatus}.`);
        }
        newAssetStatus = 'available';
        
        // NOVO: Busca o ID do setor padrão "Almoxarifado - CETEC"
        const infraSectorResult = await client.query(
          `SELECT id FROM sectors WHERE sector_name = 'Almoxarifado - CETEC' LIMIT 1`
        );
        if (infraSectorResult.rows.length === 0) {
            throw new Error("Setor padrão de devolução ('Almoxarifado - CETEC') não encontrado no cadastro de setores.");
        }
        const infraSectorId = infraSectorResult.rows[0].id;

        // Atualiza o ativo para o status 'disponível' e o move para o setor padrão
        await client.query(
          `UPDATE assets SET status = $1, current_sector_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [newAssetStatus, infraSectorId, asset_id]
        );
        break;
        case 'maintenance':
          if (['retired', 'disposed'].includes(currentAssetStatus)) {
               throw new Error(`Ativo ${asset_id} não pode ir para manutenção. Status atual: ${currentAssetStatus}.`);
          }
          newAssetStatus = 'maintenance';
          await client.query(
            `UPDATE assets SET status = $1, current_sector_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_sector_id || null, asset_id]
          );
          break;
        default:
          throw new Error(`Tipo de movimentação inválido para o ativo ${asset_id}.`);
      }

      await client.query(
        `INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)`,
        [newMovementId, asset_id]
      );
    }

    await client.query('COMMIT'); // Confirma a transação
    await logAudit(responsible_user_id, `create_movement_${movement_type}`, 'asset_movement', newMovementId, { asset_ids, movement_type, new_status: newAssetStatus }, ipAddress);
    res.status(201).json({ message: `Movimentação de ${movement_type} registrada com sucesso.`, movement_id: newMovementId, assets_moved: asset_ids.length });

  } catch (error) {
    // Se o cliente foi conectado, garanta o rollback
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao registrar movimentação de ativo:', error);
    // Use 'error.message' para uma mensagem mais limpa, ou 'error' para mais detalhes
    const errorMessage = error instanceof Error ? error.message : 'Um erro desconhecido ocorreu.';
    await logAudit(responsible_user_id, `create_movement_error_${movement_type}`, 'asset_movement', null, { error: errorMessage, asset_ids, movement_type }, ipAddress);
    res.status(500).json({ message: `Erro interno do servidor ao registrar movimentação: ${errorMessage}` });
  } finally {
    // Garanta que o cliente seja liberado de volta para o pool, não importa o que aconteça
    if (client) {
      client.release();
    }
  }
});

// Listar todas as movimentações de ativos (com filtros, se necessário)
app.get('/api/asset-movements', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         am.id,
         am.movement_type,
         am.movement_date,
         am.purpose,
         am.expected_return_date,
         am.actual_return_date,
         am.notes,
         am.created_at,
         am.updated_at,
         u.username AS responsible_username,
         u.full_name AS responsible_full_name,
         COALESCE(p.full_name, am.recipient_name) AS recipient_display_name, -- Prioriza nome da pessoa cadastrada
         p.cpf AS recipient_person_cpf,
         p.registration_number AS recipient_person_registration,
         ds.secretariat AS destination_secretariat,
         ds.executive AS destination_executive,
         ds.sector_name AS destination_sector_name,
         am.request_channel_type,
         am.request_channel_details
       FROM asset_movements am
       JOIN users u ON am.responsible_user_id = u.id
       LEFT JOIN people p ON am.recipient_person_id = p.id
       LEFT JOIN sectors ds ON am.destination_sector_id = ds.id
       ORDER BY am.movement_date DESC`
    );

    // Para cada movimentação, buscar os ativos associados
    const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
      const assetsResult = await pool.query(
        `SELECT
           a.id,
           a.sku,
           a.brand,
           a.model,
           a.serial_number,
           a.patrimonio_number,
           a.status,
           it.name AS item_type_name
         FROM movement_assets ma
         JOIN assets a ON ma.asset_id = a.id
         JOIN item_types it ON a.item_type_id = it.id
         WHERE ma.movement_id = $1
         ORDER BY a.sku ASC`,
        [movement.id]
      );
      return {
        ...movement,
        assets: assetsResult.rows,
        total_assets_moved: assetsResult.rows.length // Adiciona o totalizador
      };
    }));

    res.status(200).json(movementsWithAssets);
  } catch (error) {
    console.error('Erro ao listar movimentações de ativos:', error);
    await logAudit(req.user.id, 'list_movements_error', 'asset_movement', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar movimentações.' });
  }
});

// ======================================
// Rotas para Dashboard - FASE 3
// ======================================

// Obter dados sumarizados para o Dashboard
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;

  try {
    // Total de Ativos
    const totalAssetsResult = await pool.query('SELECT COUNT(*) FROM assets');
    const totalAssets = parseInt(totalAssetsResult.rows[0].count, 10);

    // Ativos por Status
    const assetsByStatusResult = await pool.query('SELECT status, COUNT(*) FROM assets GROUP BY status');
    const assetsByStatus = assetsByStatusResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});

    // Ativos por Categoria (Item Type)
    const assetsByCategoryResult = await pool.query(
      `SELECT it.name AS category_name, COUNT(a.id) AS count
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       GROUP BY it.name
       ORDER BY count DESC`
    );
    const assetsByCategory = assetsByCategoryResult.rows.map(row => ({
      name: row.category_name,
      value: parseInt(row.count, 10)
    }));

    // Movimentações Recentes (últimas 5)
    const recentMovementsResult = await pool.query(
      `SELECT
         am.id,
         am.movement_type,
         am.movement_date,
         u.full_name AS responsible_user_name,
         COALESCE(p.full_name, am.recipient_name) AS recipient_display_name
       FROM asset_movements am
       JOIN users u ON am.responsible_user_id = u.id
       LEFT JOIN people p ON am.recipient_person_id = p.id
       ORDER BY am.movement_date DESC
       LIMIT 5`
    );
    
    // Para cada movimentação recente, buscar os ativos associados
    const recentMovements = await Promise.all(recentMovementsResult.rows.map(async (movement) => {
      const assetsForMovement = await pool.query(
        `SELECT a.sku, a.brand, a.model
         FROM movement_assets ma
         JOIN assets a ON ma.asset_id = a.id
         WHERE ma.movement_id = $1
         LIMIT 1`, // Pega apenas o primeiro ativo para exibição resumida no dashboard
        [movement.id]
      );
      const assetInfo = assetsForMovement.rows[0] || { sku: 'N/A', brand: 'N/A', model: 'N/A' };

      return {
        id: movement.id,
        asset: `${assetInfo.brand} ${assetInfo.model} (${assetInfo.sku})`,
        type: movement.movement_type,
        date: new Date(movement.movement_date).toLocaleDateString('pt-BR'),
        user: movement.responsible_user_name || movement.recipient_display_name || 'N/A'
      };
    }));


    // Alertas Pendentes (empréstimos próximos do vencimento ou vencidos)
    const pendingAlertsResult = await pool.query(
      `SELECT
         a.sku,
         a.brand,
         a.model,
         am.expected_return_date,
         p.full_name AS recipient_full_name -- Adicionado para exibir o nome do responsável
       FROM asset_movements am
       JOIN movement_assets ma ON am.id = ma.movement_id
       JOIN assets a ON ma.asset_id = a.id
       LEFT JOIN people p ON am.recipient_person_id = p.id -- Adicionado para buscar o nome da pessoa
       WHERE am.movement_type = 'loan'
         AND a.status = 'loaned' -- <<< ADIÇÃO CRUCIAL AQUI
         AND am.actual_return_date IS NULL
         AND am.expected_return_date IS NOT NULL
         AND am.expected_return_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY am.expected_return_date ASC
       LIMIT 5`
    );
    const pendingAlerts = pendingAlertsResult.rows.map(row => ({
      id: row.sku,
      message: `Devolução do "${row.brand} ${row.model}" ${new Date(row.expected_return_date) <= new Date() ? 'atrasada' : 'próxima'}.`,
      asset: `${row.brand} ${row.model} (com ${row.recipient_full_name || 'responsável não informado'})`, // Adicionado nome
      dueDate: new Date(row.expected_return_date).toLocaleDateString('pt-BR')
    }));


    const dashboardSummary = {
      totalAssets: totalAssets,
      availableAssets: assetsByStatus.available || 0,
      inUseAssets: assetsByStatus.in_use || 0,
      loanedAssets: assetsByStatus.loaned || 0,
      maintenanceAssets: assetsByStatus.maintenance || 0,
      assetsByCategory: assetsByCategory,
      recentMovements: recentMovements,
      pendingAlerts: pendingAlerts,
    };

    await logAudit(req.user.id, 'get_dashboard_summary', null, null, null, ipAddress);
    res.status(200).json(dashboardSummary);

  } catch (error) {
    console.error('Erro ao obter dados do dashboard:', error);
    await logAudit(req.user.id, 'get_dashboard_summary_error', null, null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao obter dados do dashboard.' });
  }
});


// NOVO: Rota para gerar Recibo PDF para uma Movimentação Específica - ATUALIZADO PARA MÚLTIPLOS ATIVOS
app.get('/api/asset-movements/:id/receipt-pdf', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    const movementResult = await pool.query(
      `SELECT
         am.*,
         u.full_name AS responsible_user_full_name,
         u.email AS responsible_user_email,
         COALESCE(p.full_name, am.recipient_name) AS recipient_display_name,
         p.cpf AS recipient_person_cpf,
         p.registration_number AS recipient_person_registration,
         ds.secretariat AS destination_secretariat,
         ds.executive AS destination_executive,
         ds.sector_name AS destination_sector_name
       FROM asset_movements am
       JOIN users u ON am.responsible_user_id = u.id
       LEFT JOIN people p ON am.recipient_person_id = p.id
       LEFT JOIN sectors ds ON am.destination_sector_id = ds.id
       WHERE am.id = $1`,
      [id]
    );

    const movement = movementResult.rows[0];

    if (!movement) {
      return res.status(404).json({ message: 'Movimentação não encontrada.' });
    }

    // Buscar todos os ativos associados a esta movimentação
    const assetsInMovementResult = await pool.query(
      `SELECT
         a.sku,
         a.brand,
         a.model,
         a.serial_number,
         a.patrimonio_number,
         it.name AS item_type_name,
         a.status
       FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       JOIN item_types it ON a.item_type_id = it.id
       WHERE ma.movement_id = $1
       ORDER BY a.sku ASC`,
      [movement.id]
    );
    const assetsInMovement = assetsInMovementResult.rows;

    // Conteúdo do PDF
    const docDefinition = {
      content: [
        { text: 'PREFEITURA DO RECIFE', style: 'header', alignment: 'center' },
        { text: 'SECRETARIA DE EDUCAÇÃO', style: 'subheader', alignment: 'center' },
        { text: 'Sistema de Gestão de Ativos - SGA', style: 'subheader', alignment: 'center' },
        { text: '\n\n' },
        { text: `RECIBO DE ${movement.movement_type.toUpperCase()}`, style: 'documentTitle', alignment: 'center' },
        { text: `\nData de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, alignment: 'right' },
        { text: '\n\n' },

        { text: 'Detalhes da Movimentação:', style: 'sectionHeader' },
        {
          ul: [
            `ID da Movimentação: ${movement.id}`,
            `Tipo: ${movement.movement_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
            `Data: ${new Date(movement.movement_date).toLocaleDateString('pt-BR')}`,
            `Responsável (Sistema): ${movement.responsible_user_full_name} (${movement.responsible_user_email})`,
            `Solicitante: ${movement.recipient_display_name || 'N/A'}`,
            movement.recipient_person_cpf ? `CPF Solicitante: ${movement.recipient_person_cpf}` : (movement.recipient_document ? `Documento Solicitante: ${movement.recipient_document}` : null),
            movement.recipient_person_registration ? `Matrícula Solicitante: ${movement.recipient_person_registration}` : null,
            movement.destination_sector_name ? `Setor de Destino: ${movement.destination_secretariat} - ${movement.destination_sector_name}` : null,
            movement.request_channel_type ? `Canal da Solicitação: ${movement.request_channel_type}` : null,
            movement.request_channel_details ? `Detalhes do Canal: ${movement.request_channel_details}` : null,
            movement.purpose ? `Finalidade: ${movement.purpose}` : null,
            movement.expected_return_date ? `Data de Devolução Esperada: ${new Date(movement.expected_return_date).toLocaleDateString('pt-BR')}` : null,
            movement.actual_return_date ? `Data de Devolução Real: ${new Date(movement.actual_return_date).toLocaleDateString('pt-BR')}` : null,
            movement.notes ? `Observações: ${movement.notes}` : null,
          ].filter(Boolean), // Filtra itens nulos
          margin: [0, 5]
        },
        { text: '\n\n' },

        { text: `Ativos Movimentados (${assetsInMovement.length}):`, style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', '*', 'auto'], // Larguras das colunas
            body: [
              // Cabeçalho da tabela
              ['SKU', 'Tipo', 'Marca', 'Modelo', 'Nº Série', 'Patrimônio'].map(header => ({ text: header, style: 'tableHeader' })),
              // Dados dos ativos
              ...assetsInMovement.map(asset => [
                asset.sku,
                asset.item_type_name,
                asset.brand,
                asset.model,
                asset.serial_number || 'N/A',
                asset.patrimonio_number || 'N/A'
              ])
            ]
          },
          layout: {
            hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 2 : 1; },
            vLineWidth: function (i, node) { return (i === 0 || i === node.table.widths.length) ? 2 : 1; },
            hLineColor: function (i, node) { return (i === 0 || i === node.table.body.length) ? '#007bff' : '#ccc'; },
            vLineColor: function (i, node) { return (i === 0 || i === node.table.widths.length) ? '#007bff' : '#ccc'; },
            paddingLeft: function(i, node) { return 8; },
            paddingRight: function(i, node) { return 8; },
            paddingTop: function(i, node) { return 5; },
            paddingBottom: function(i, node) { return 5; },
          }
        },
        '\n\n',
        { text: '________________________________________', alignment: 'center', margin: [0, 40, 0, 5] },
        { text: `${movement.recipient_display_name || movement.responsible_user_full_name}`, alignment: 'center' },
        { text: 'Assinatura do Solicitante / Responsável', alignment: 'center', fontSize: 9 }
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
        documentTitle: { fontSize: 18, bold: true, margin: [0, 10, 0, 10], decoration: 'underline' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5], color: '#0056b3' },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#007bff', // Azul da prefeitura
          alignment: 'center',
          margin: [0, 5, 0, 5]
        },
        defaultStyle: { font: 'Roboto', fontSize: 10 },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        alignment: 'left'
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    let resultBuffer;

    pdfDoc.on('data', function (chunk) {
      chunks.push(chunk);
    });
    pdfDoc.on('end', function () {
      resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment(`recibo_movimentacao_${movement.id}.pdf`);
      res.send(resultBuffer);
      logAudit(req.user.id, 'generate_receipt_pdf', 'asset_movement', movement.id, { movement_type: movement.movement_type }, ipAddress);
    });
    pdfDoc.on('error', (err) => {
      console.error('Erro durante a geração do PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erro interno do servidor ao gerar o PDF.' });
      }
      logAudit(req.user.id, 'generate_receipt_pdf_error', 'asset_movement', movement.id, { error: err.message }, ipAddress);
    });
    pdfDoc.end();

  } catch (error) {
    console.error('Erro ao gerar recibo PDF (catch principal):', error);
    await logAudit(req.user.id, 'generate_receipt_pdf_error', 'asset_movement', id, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar recibo PDF.' });
  }
});


// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
