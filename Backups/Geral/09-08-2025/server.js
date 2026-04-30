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
const importStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Garante que uma pasta temporária exista para as importações
    const tempDir = path.join(__dirname, 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Cria um nome de arquivo temporário e único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadImport = multer({ storage: importStorage });
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


// Configuração do Multer para upload de arquivos com controle de destino e nome
const uploadDir = path.join(__dirname, 'uploads', 'receipts');

// Garante que o diretório de uploads exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Busca os detalhes que nosso middleware encontrou.
    const movementId = req.params.id;
    const details = req.movementDetails;

    // Formata o nome da pessoa para ser seguro para um nome de arquivo
    const recipientName = details.recipient_name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]/gi, '_') // Substitui caracteres não alfanuméricos por _
      .toLowerCase();

    // Formata a data para YYYY-MM-DD
    const movementDate = new Date(details.movement_date).toISOString().split('T')[0];
    
    const originalExtension = path.extname(file.originalname);
    
    // Cria o novo nome de arquivo descritivo
    const newFilename = `recibo_mov${movementId}_${recipientName}_${movementDate}${originalExtension}`;
    
    cb(null, newFilename);
  }
});

const upload = multer({ storage: storage });

// server.js -> Adicionar esta configuração de storage

const evidenceDir = path.join(__dirname, 'uploads', 'evidence');
// Garante que o diretório de evidências exista
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

const evidenceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, evidenceDir);
  },
  filename: function (req, file, cb) {
    const assetId = req.params.id;
    const uniqueSuffix = Date.now();
    const originalExtension = path.extname(file.originalname);
    const newFilename = `evidencia_ativo${assetId}_${uniqueSuffix}${originalExtension}`;
    cb(null, newFilename);
  }
});

const uploadEvidence = multer({ storage: evidenceStorage });

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
    // Permissões de Menu Principal
    MENU_DASHBOARD: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],
    MENU_CADASTROS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],
    MENU_OPERACOES: [ROLES.ADMIN, ROLES.MANAGER],
    MENU_CONSULTAS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],
    MENU_RELATORIOS: [ROLES.ADMIN, ROLES.MANAGER],
    MENU_AUDITORIA: [ROLES.ADMIN],
    MENU_CONFIGURACOES: [ROLES.ADMIN],
    
    // Permissões de Submenus e Ações Específicas
    SUBMENU_TIPOS_ITENS: [ROLES.ADMIN, ROLES.MANAGER],
    SUBMENU_UNIDADES: [ROLES.ADMIN, ROLES.MANAGER],
    SUBMENU_PESSOAS: [ROLES.ADMIN, ROLES.MANAGER],
    SUBMENU_ATIVOS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],

    // Permissões para botões de criar/editar/importar dentro das páginas
    ACTION_CREATE_EDIT: [ROLES.ADMIN, ROLES.MANAGER],
    ACTION_DELETE: [ROLES.ADMIN], // Apenas admin pode excluir permanentemente
    ACTION_APPROVE_REJECT: [ROLES.ADMIN],
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

// >>> NOVA FUNÇÃO AUXILIAR ( Padronizar número de telefone) <<<
const formatPhoneNumber = (phone) => {
  if (!phone) {
    return null;
  }
  // 1. Remove todos os caracteres que não são dígitos
  const digitsOnly = String(phone).replace(/\D/g, '');

  // 2. Verifica se o número tem 10 (fixo) ou 11 dígitos (celular)
  if (digitsOnly.length === 10) {
    // Formato: 81 3333-4444
    return `${digitsOnly.substring(0, 2)} ${digitsOnly.substring(2, 6)}-${digitsOnly.substring(6, 10)}`;
  } else if (digitsOnly.length === 11) {
    // Formato: 81 99999-8888
    return `${digitsOnly.substring(0, 2)} ${digitsOnly.substring(2, 7)}-${digitsOnly.substring(7, 11)}`;
  } else {
    // Se não se encaixar nos padrões, retorna o número limpo (ou null se preferir)
    return digitsOnly; 
  }
};

// >>> NOVO MIDDLEWARE (Nome de recibos assinados) <<<
const fetchMovementDetailsForUpload = async (req, res, next) => {
  try {
    const { id } = req.params;
    const movementResult = await pool.query(
      `SELECT 
         am.movement_date,
         p.full_name AS recipient_name
       FROM asset_movements am
       LEFT JOIN people p ON am.recipient_person_id = p.id
       WHERE am.id = $1`,
      [id]
    );

    if (movementResult.rows.length === 0) {
      return res.status(404).json({ message: 'Movimentação não encontrada para nomear o arquivo.' });
    }

    // Anexa os detalhes encontrados ao objeto 'req' para que a próxima função (o multer) possa usá-los.
    req.movementDetails = movementResult.rows[0];
    next(); // Continua para o próximo passo (o upload)

  } catch (error) {
    console.error('Erro ao buscar detalhes da movimentação para upload:', error);
    return res.status(500).json({ message: 'Erro interno ao preparar o upload.' });
  }
};

// >>> NOVO MIDDLEWARE (Perfis de Acesso) <<<
const authorizePermission = (permissionKey) => {
  return (req, res, next) => {
    // ETAPA 1: VERIFICAÇÃO DE SEGURANÇA ADICIONADA
    // Garante que o middleware de autenticação foi executado corretamente
    // e que o objeto req.user e sua propriedade 'role' existem.
    if (!req.user || typeof req.user.role === 'undefined') {
      logAudit(null, 'authorization_error', 'permission_check', null, { reason: 'User object not found in request', path: req.path }, req.ip);
      // Retorna um erro 500 porque esta é uma falha interna inesperada, não um erro de permissão do usuário.
      return res.status(500).json({ message: 'Erro de autenticação interna. O usuário não pôde ser verificado.' });
    }

    const userRole = req.user.role;
    const allowedRoles = PERMISSIONS[permissionKey];

    // ETAPA 2: A LÓGICA DE PERMISSÃO PERMANECE A MESMA
    if (allowedRoles && allowedRoles.includes(userRole)) {
      next(); // Permissão concedida
    } else {
      // Permissão negada
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
  const ipAddress = req.ip;

  if (!email || !password) {
    await logAudit(null, 'login_failed', 'user', null, { reason: 'Missing credentials', email }, ipAddress);
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      await logAudit(null, 'login_failed', 'user', null, { reason: 'User not found', email }, ipAddress);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await logAudit(user.id, 'login_failed', 'user', user.id, { reason: 'Incorrect password', email }, ipAddress);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // <<< VERIFICAÇÃO DE CONTA ATIVA >>>
    if (!user.is_active) {
      await logAudit(user.id, 'login_failed', 'user', user.id, { reason: 'Account is deactivated', email }, ipAddress);
      return res.status(403).json({ message: 'Sua conta está desativada. Entre em contato com o administrador.' });
    }
    // <<< FIM DA ADIÇÃO >>>

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      must_change_password: user.must_change_password,
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
app.post('/api/users/register', authenticateToken, authorizePermission('MENU_CONFIGURACOES'), async (req, res) => {
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
       p.full_name, p.cpf, p.email, p.registration_number, u.name AS unit_name, u.type AS unit_type
     FROM people p
     LEFT JOIN units u ON p.unit_id = u.id
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

    const headers = ['Nome Completo', 'CPF', 'Email', 'Matrícula', 'Unidade', 'Tipo da Unidade'];
    const csvRows = [headers.join(';')];

    for (const person of people) {
      const row = [
        person.full_name,
        person.cpf,
        person.email,
        person.registration_number || 'N/A',
        person.unit_name || 'N/A',
        person.unit_type || 'N/A'
      ];
      csvRows.push(row.map(field => `"${field || ''}"`).join(';'));
    }

    const csvString = csvRows.join('\n');
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_pessoas.csv');
    res.send(Buffer.from(csvString, 'utf-8'));
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
      'Unidade': p.unit_name || 'N/A',
      'Tipo da Unidade': p.unit_type || 'N/A',
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
      p.unit_name || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Pessoas Cadastradas', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto'],
            body: [
              ['Nome Completo', 'CPF', 'Email', 'Unidade'].map(h => ({ text: h, style: 'tableHeader' })),
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

// ======================================
// NOVAS ROTAS DE RELATÓRIO DE AUDITORIA
// ======================================

// Função auxiliar para buscar todos os dados de auditoria
const getAuditLogsReportData = async (filters = {}) => {
  const { userId, actionType, startDate, endDate } = filters;

  let baseQuery = `
    SELECT
      al.id, al.action_type, al.target_entity, al.target_id,
      al.details, al.ip_address, al.created_at,
      u.full_name as user_name, u.username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
  `;

  const whereClauses = [];
  const queryParams = [];
  let paramIndex = 1;

  if (userId) {
    whereClauses.push(`al.user_id = $${paramIndex++}`);
    queryParams.push(userId);
  }
  if (actionType) {
    whereClauses.push(`al.action_type = $${paramIndex++}`);
    queryParams.push(actionType);
  }
  if (startDate) {
    whereClauses.push(`al.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }
  if (endDate) {
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    whereClauses.push(`al.created_at < $${paramIndex++}`);
    queryParams.push(nextDay.toISOString().split('T')[0]);
  }

  if (whereClauses.length > 0) {
    baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  baseQuery += ` ORDER BY al.created_at DESC`;
  
  const result = await pool.query(baseQuery, queryParams);
  return result.rows;
};

// Rota para exportar logs em CSV
app.get('/api/reports/audit-logs/csv', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    const logs = await getAuditLogsReportData(req.query);
    const headers = ['Data e Hora', 'Usuário', 'Username', 'Ação', 'Entidade Alvo', 'ID Alvo', 'Endereço IP', 'Detalhes'];
    const csvRows = [headers.join(';')];
    for (const log of logs) {
      const row = [
        new Date(log.created_at).toLocaleString('pt-BR'),
        log.user_name || 'Sistema',
        log.username || 'N/A',
        log.action_type,
        log.target_entity || 'N/A',
        log.target_id || 'N/A',
        log.ip_address,
        log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '{}'
      ];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8').attachment('relatorio_auditoria.csv').send(csvRows.join('\n'));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de auditoria.' }); }
});

// Rota para exportar logs em XLSX
app.get('/api/reports/audit-logs/xlsx', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    const logs = await getAuditLogsReportData(req.query);
    const dataForSheet = logs.map(log => ({
      'Data e Hora': new Date(log.created_at).toLocaleString('pt-BR'),
      'Usuário': log.user_name || 'Sistema',
      'Username': log.username || 'N/A',
      'Ação': log.action_type,
      'Entidade Alvo': log.target_entity || 'N/A',
      'ID Alvo': log.target_id || 'N/A',
      'Endereço IP': log.ip_address,
      'Detalhes': JSON.stringify(log.details, null, 2)
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('relatorio_auditoria.xlsx').send(buffer);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de auditoria.' }); }
});

// Rota para exportar logs em PDF
app.get('/api/reports/audit-logs/pdf', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    const logs = await getAuditLogsReportData(req.query);
    const bodyData = logs.map(log => [
      new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      log.user_name || 'Sistema',
      log.action_type.replace(/_/g, ' '),
      log.target_entity || 'N/A',
      log.ip_address
    ]);
    const docDefinition = {
      content: [
        { text: 'Relatório de Auditoria do Sistema', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: [
              ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Endereço IP'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: { header: { fontSize: 18, bold: true }, tableHeader: { bold: true, fontSize: 10 } },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => res.header('Content-Type', 'application/pdf').attachment('relatorio_auditoria.pdf').send(Buffer.concat(chunks)));
    pdfDoc.end();
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de auditoria.' }); }
});

// ROTA PARA BUSCAR ATIVOS COM GARANTIA A VENCER (PARA DASHBOARD E RELATÓRIO)
app.get('/api/reports/expiring-warranties', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    // A query busca ativos cuja garantia vence entre hoje e os próximos 90 dias.
    // Ela já agrupa e conta os resultados para nós.
    const query = `
      SELECT
        COUNT(a.id) as asset_count,
        it.name as item_type_name,
        a.brand,
        a.model,
        a.warranty_end_date
      FROM
        assets a
      JOIN
        item_types it ON a.item_type_id = it.id
      WHERE
        a.warranty_end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '90 days')
      GROUP BY
        it.name, a.brand, a.model, a.warranty_end_date
      ORDER BY
        a.warranty_end_date ASC;
    `;
    
    const result = await pool.query(query);
    
    // Processa os resultados para calcular os dias restantes
    const expiringWarranties = result.rows.map(row => {
      const warrantyEndDate = new Date(row.warranty_end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      warrantyEndDate.setHours(0, 0, 0, 0);
      
      const diffTime = warrantyEndDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        count: parseInt(row.asset_count, 10),
        description: `${row.item_type_name} ${row.brand} ${row.model}`,
        endDate: warrantyEndDate.toLocaleDateString('pt-BR'),
        daysRemaining: diffDays
      };
    });

    await logAudit(req.user.id, 'generate_report', 'expiring_warranties_report', null, { count: expiringWarranties.length }, ipAddress);
    res.status(200).json(expiringWarranties);

  } catch (error) {
    console.error('Erro ao buscar garantias a vencer:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ======================================
// NOVAS ROTAS DE RELATÓRIOS - SETORES E TIPOS DE ITENS
// ======================================

// --- RELATÓRIOS DE SETORES ---

const getUnitsReportData = async () => {
  const result = await pool.query('SELECT code, name, type, address, contact_phone FROM units ORDER BY type, name');
  return result.rows;
};

app.get('/api/reports/units/csv', authenticateToken, async (req, res) => {
  try {
    const units = await getUnitsReportData();
    const headers = ['Código', 'Nome da Unidade', 'Tipo', 'Endereço', 'Telefone'];
    const csvRows = [headers.join(';')];
    for (const unit of units) {
      const row = [
        unit.code || 'N/A',
        unit.name,
        unit.type,
        (unit.address || '').replace(/"/g, '""'),
        unit.contact_phone || 'N/A'
      ];
      csvRows.push(row.map(field => `"${field}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_unidades.csv');
    res.send(Buffer.from(csvRows.join('\n')));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV de unidades.' }); }
});

app.get('/api/reports/units/xlsx', authenticateToken, async (req, res) => {
    try {
        const units = await getUnitsReportData(); // Usa a nova função de busca
        const dataForSheet = units.map(u => ({
            'Código': u.code || 'N/A',
            'Nome da Unidade': u.name,
            'Tipo': u.type,
            'Endereço': u.address || 'N/A',
            'Telefone': u.contact_phone || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Unidades'); // Nome da aba atualizado
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('relatorio_unidades.xlsx'); // Nome do arquivo atualizado
        res.send(buffer);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX de unidades.' }); }
});

app.get('/api/reports/units/pdf', authenticateToken, async (req, res) => {
  try {
    const units = await getUnitsReportData(); // Usa a nova função de busca
    if (units.length === 0) {
      return res.status(404).json({ message: 'Nenhuma unidade encontrada para gerar relatório.' });
    }

    const bodyData = units.map(u => [ // Mapeia os novos dados
      u.code || 'N/A',
      u.name,
      u.type,
      u.contact_phone || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Unidades Cadastradas', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto'],
            body: [
              // Cabeçalhos atualizados
              ['Código', 'Nome da Unidade', 'Tipo', 'Telefone'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `\nTotal de Unidades: ${units.length}`, alignment: 'right', style: 'footer' }
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
      res.attachment('relatorio_unidades.pdf'); // Nome do arquivo atualizado
      res.send(resultBuffer);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'unit_report_xlsx', null, { count: units.length }, req.ip);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de unidades.' }); }
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
    await logAudit(req.user.id, 'generate_report', 'item_type_report_xlsx', null, { count: itemTypes.length }, req.ip);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório PDF de tipos de itens.' }); }
});

// Arquivo: server.js

// ======================================
// NOVAS ROTAS DE GESTÃO DE USUÁRIOS
// ======================================

// Rota para listar todos os usuários (ADMIN APENAS)
app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, full_name, role, created_at, is_active FROM users ORDER BY full_name ASC');
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

  if (userIdToDelete === loggedInUserId) {
    await logAudit(loggedInUserId, 'delete_user_failed', 'user', userIdToDelete, { reason: 'Admin tried to delete self' }, ipAddress);
    return res.status(403).json({ message: 'Você não pode remover sua própria conta de administrador.' });
  }

  const client = await pool.connect(); // Pega uma conexão do pool para a transação

  try {
    await client.query('BEGIN'); // Inicia a transação

    // 1. Anonimiza os logs de auditoria do usuário que será deletado
    // Em vez de deletar os logs, apenas removemos a referência ao usuário.
    await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [userIdToDelete]);
    
    // Você pode adicionar lógicas similares para outras tabelas que tenham o user_id, se houver.

    // 2. Agora, deleta o usuário com segurança
    const deleteResult = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userIdToDelete]);

    if (deleteResult.rowCount === 0) {
      // Se o usuário não existia, desfaz a transação
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Se tudo deu certo, confirma a transação
    await client.query('COMMIT');

    // Registra o log de auditoria da exclusão bem-sucedida (agora fora da transação)
    await logAudit(loggedInUserId, 'delete_user_success', 'user', userIdToDelete, { deleted_user_email: deleteResult.rows[0].email }, ipAddress);
    
    res.status(200).json({ message: 'Usuário removido com sucesso.' });

  } catch (error) {
    // Se qualquer passo falhar, desfaz todas as operações da transação
    await client.query('ROLLBACK');
    
    console.error('Erro ao remover usuário:', error);
    await logAudit(loggedInUserId, 'delete_user_error', 'user', userIdToDelete, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao remover usuário.' });
  } finally {
    // Libera a conexão de volta para o pool
    client.release();
  }
});

// Rota para atualizar um usuário (ADMIN APENAS)
app.put('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userIdToUpdate = parseInt(req.params.id, 10);
  // <<< 'is_active' ADICIONADO AQUI >>>
  const { full_name, username, email, role, is_active } = req.body;
  const ipAddress = req.ip;

  // Validação dos dados recebidos
  if (!full_name || !username || !email || !role || typeof is_active !== 'boolean') {
    return res.status(400).json({ message: 'Todos os campos, incluindo o status de ativação, são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      // <<< QUERY ATUALIZADA PARA INCLUIR 'is_active' >>>
      `UPDATE users SET full_name = $1, username = $2, email = $3, role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING id, full_name, username, email, role, is_active`,
      [full_name, username, email, role, is_active, userIdToUpdate]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado para atualização.' });
    }

    await logAudit(req.user.id, 'update_user_success', 'user', userIdToUpdate, { updated_data: result.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Usuário atualizado com sucesso.', user: result.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
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
// server.js -> SUBSTITUA A ROTA EXISTENTE PELA VERSÃO ABAIXO

// Rota para listar os logs de auditoria (AGORA COM FILTROS)
app.get('/api/audit-logs', authenticateToken, authorizePermission('MENU_AUDITORIA'), async (req, res) => {
  try {
    // Extrai os possíveis filtros da query string da URL
    const { userId, actionType, startDate, endDate } = req.query;

    let baseQuery = `
      SELECT
         al.id, al.action_type, al.target_entity, al.target_id,
         al.details, al.ip_address, al.created_at,
         u.full_name as user_name, u.username
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
    `;

    const whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (userId) {
      whereClauses.push(`al.user_id = $${paramIndex++}`);
      queryParams.push(userId);
    }
    if (actionType) {
      whereClauses.push(`al.action_type = $${paramIndex++}`);
      queryParams.push(actionType);
    }
    if (startDate) {
      whereClauses.push(`al.created_at >= $${paramIndex++}`);
      queryParams.push(startDate);
    }
    if (endDate) {
      // Adicionamos 1 dia e buscamos por '<' para incluir o dia inteiro de endDate
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      whereClauses.push(`al.created_at < $${paramIndex++}`);
      queryParams.push(nextDay.toISOString().split('T')[0]);
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY al.created_at DESC LIMIT 200`;

    const result = await pool.query(baseQuery, queryParams);
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

    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', 
      [newPasswordHash, userId]
    );

    // CRUCIAL: Gera um novo token com a informação 'must_change_password: false'
    const newPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      must_change_password: false, // <-- A informação atualizada
    };
    const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' });

    await logAudit(userId, 'password_change_success', 'user', userId, null, req.ip);
    
    // Envia o novo token junto com a mensagem de sucesso
    res.status(200).json({ message: 'Senha alterada com sucesso!', token: newToken });

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

async function getFilteredMovements(filters) {
  // Extrai todos os possíveis filtros do objeto
  const { startDate, endDate, patrimonio, movementType, solicitante, cpf, matricula } = filters;

  let queryParams = [];
  let whereClauses = [];

  // A consulta base agora faz todos os JOINs necessários desde o início.
  // Usamos SELECT DISTINCT para evitar duplicatas de movimentações que tenham múltiplos ativos.
  let baseQuery = `
    SELECT DISTINCT
       am.*, 
       u.username AS responsible_username, 
       u.full_name AS responsible_full_name,
       COALESCE(p.full_name, am.recipient_name) AS recipient_display_name
     FROM asset_movements am
     JOIN users u ON am.responsible_user_id = u.id
     LEFT JOIN people p ON am.recipient_person_id = p.id
     LEFT JOIN movement_assets ma ON am.id = ma.movement_id
     LEFT JOIN assets a ON ma.asset_id = a.id
  `;

  // --- LÓGICA DE FILTROS SIMPLIFICADA ---
  // Todos os filtros agora são adicionados à mesma cláusula WHERE.

  if (patrimonio) {
    queryParams.push(`%${patrimonio}%`);
    whereClauses.push(`a.patrimonio_number ILIKE $${queryParams.length}`);
  }
  if (solicitante) {
    queryParams.push(`%${solicitante}%`);
    whereClauses.push(`p.full_name ILIKE $${queryParams.length}`);
  }
  if (cpf) {
    queryParams.push(cpf);
    whereClauses.push(`p.cpf = $${queryParams.length}`);
  }
  if (matricula) {
    queryParams.push(matricula);
    whereClauses.push(`p.registration_number = $${queryParams.length}`);
  }
  if (startDate) {
    queryParams.push(startDate);
    whereClauses.push(`am.movement_date >= $${queryParams.length}`);
  }
  if (endDate) {
    queryParams.push(endDate);
    whereClauses.push(`am.movement_date <= $${queryParams.length}`);
  }
  if (movementType) {
    queryParams.push(movementType);
    whereClauses.push(`am.movement_type = $${queryParams.length}`);
  }

  // Constrói a cláusula WHERE final
  if (whereClauses.length > 0) {
    baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  baseQuery += ` ORDER BY am.movement_date DESC, am.id DESC`;

  const result = await pool.query(baseQuery, queryParams);

  // O restante da lógica para buscar os ativos de cada movimentação permanece igual.
  const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
    const assetsResult = await pool.query(
  `SELECT a.id, a.sku, a.patrimonio_number, a.brand, a.model FROM movement_assets ma JOIN assets a ON ma.asset_id = a.id WHERE ma.movement_id = $1`,
  [movement.id]
  );
    return { ...movement, assets: assetsResult.rows };
  }));

  return movementsWithAssets;
}

const generateSku = async (brand, itemTypeId) => {
  try {
    // 1. Obter a sigla do tipo de item
    const itemTypeResult = await pool.query('SELECT sku_code FROM item_types WHERE id = $1', [itemTypeId]);
    if (itemTypeResult.rows.length === 0 || !itemTypeResult.rows[0].sku_code) { // Verifica também se o código não é nulo
      throw new Error('Tipo de item não encontrado ou sem código SKU definido para gerar SKU.');
    }
    const itemTypeCode = itemTypeResult.rows[0].sku_code.toUpperCase();
    const safeBrand = brand || 'S/M'; // S/M = Sem Marca
    // 2. Obter as três letras da marca
    let brandPrefix = safeBrand.substring(0, 3).toUpperCase();
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

// Criar um novo Tipo de Item (via formulário)
app.post('/api/item-types', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { name, description, sku_code } = req.body;
  const ipAddress = req.ip;

  // Validação dos campos
  if (!name || !sku_code) {
    return res.status(400).json({ message: 'Nome e Código SKU (3 letras) são obrigatórios.' });
  }
  if (String(sku_code).length !== 3) {
    return res.status(400).json({ message: 'O Código SKU deve ter exatamente 3 caracteres.' });
  }

  try {
    // Lógica para gerar o código principal (ex: SEDUC001)
    const lastItemType = await pool.query('SELECT code FROM item_types ORDER BY id DESC LIMIT 1');
    let newCodeNum = 1;
    if (lastItemType.rows.length > 0) {
      const lastCode = lastItemType.rows[0].code;
      // Regex para encontrar o número depois de 'SEDUC'
      const numMatch = lastCode.match(/SEDUC(\d+)/);
      if (numMatch && numMatch[1]) {
        newCodeNum = parseInt(numMatch[1], 10) + 1;
      }
    }
    const code = `SEDUC${String(newCodeNum).padStart(3, '0')}`;

    const newItemType = await pool.query(
      `INSERT INTO item_types (code, name, description, sku_code)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, name, description, sku_code.toUpperCase()]
    );

    await logAudit(req.user.id, 'create_item_type', 'item_type', newItemType.rows[0].id, { name, code, sku_code }, ipAddress);
    res.status(201).json({ message: 'Tipo de item criado com sucesso.', itemType: newItemType.rows[0] });

  } catch (error) {
    console.error('Erro ao criar tipo de item:', error);
    if (error.code === '23505') { // Erro de violação de unique (para nome ou sku_code)
      return res.status(409).json({ message: 'Tipo de item com este nome ou Código SKU já existe.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor.' });
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
  const { name, description, sku_code } = req.body; // ✨ Recebe o novo campo
  const ipAddress = req.ip;

  if (!name || !sku_code) { // ✨ Valida o novo campo
    return res.status(400).json({ message: 'Nome e Código SKU (3 letras) são obrigatórios.' });
  }
  if (sku_code.length !== 3) { // ✨ Valida o tamanho
    return res.status(400).json({ message: 'O Código SKU deve ter exatamente 3 caracteres.' });
  }

  try {
    const oldItemTypeResult = await pool.query('SELECT * FROM item_types WHERE id = $1', [id]);
    if (oldItemTypeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de item não encontrado para atualização.' });
    }
    const oldItemType = oldItemTypeResult.rows[0];

    const updatedItemType = await pool.query(
      `UPDATE item_types SET name = $1, description = $2, sku_code = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [name, description, sku_code.toUpperCase(), id] // ✨ Atualiza o novo campo
    );

    await logAudit(req.user.id, 'update_item_type', 'item_type', id, { old_data: oldItemType, new_data: updatedItemType.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Tipo de item atualizado com sucesso.', itemType: updatedItemType.rows[0] });

  } catch (error) {
    console.error('Erro ao atualizar tipo de item:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Tipo de item com este nome ou Código SKU já existe.' });
    }
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
// Rotas para Unidades (Units) - NOVA ESTRUTURA
// ======================================

// Listar todas as Unidades (com filtro opcional por tipo)
app.get('/api/units', authenticateToken, async (req, res) => {
  const { type } = req.query;
  try {
    // A nova query inclui uma subconsulta para contar os ativos em cada unidade
    let query = `
      SELECT
        u.*,
        COALESCE(asset_counts.count, 0) AS current_assets_count
      FROM
        units u
      LEFT JOIN
        (
          SELECT
            current_unit_id,
            COUNT(id) as count
          FROM
            assets
          WHERE
            current_unit_id IS NOT NULL
          GROUP BY
            current_unit_id
        ) AS asset_counts ON u.id = asset_counts.current_unit_id
    `;
    const params = [];

    if (type) {
      params.push(type);
      // Adiciona a cláusula WHERE ou AND dependendo se a query já tem um WHERE
      query += ' WHERE u.type = $1';
    }

    query += ' ORDER BY u.name ASC';
    
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar unidades:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao listar unidades.' });
  }
});

// Criar uma nova Unidade
app.post('/api/units', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { type, name, code, parent_id, address, contact_phone, contact_email, notes } = req.body;
  const ipAddress = req.ip;

  if (!type || !name) {
    return res.status(400).json({ message: 'Tipo e Nome da unidade são obrigatórios.' });
  }

  try {
    const newUnit = await pool.query(
      `INSERT INTO units (type, name, code, parent_id, address, contact_phone, contact_email, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [type, name, code || null, parent_id || null, address || null, contact_phone || null, contact_email || null, notes || null]
    );

    await logAudit(req.user.id, 'create_unit', 'unit', newUnit.rows[0].id, { unit_name: name, type }, ipAddress);
    res.status(201).json({ message: 'Unidade criada com sucesso.', unit: newUnit.rows[0] });

  } catch (error) {
    console.error('Erro ao criar unidade:', error);
    if (error.code === '23505') { // Erro de violação de unique (código ou nome)
      return res.status(409).json({ message: 'Já existe uma unidade com este nome ou código.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor ao criar unidade.' });
  }
});

// Atualizar uma Unidade
// ATUALIZAR UNIDADE (VERSÃO FINAL E CORRIGIDA)
app.put('/api/units/:id', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
    const { id: idFromParams } = req.params;
    // Capturamos o parent_id com um nome temporário
    const { name, code, parent_id: parentIdFromRequest, status, type, address, contact_phone, contact_email, notes } = req.body;
    const ipAddress = req.ip;

    // A CORREÇÃO CRUCIAL ACONTECE AQUI:
    // Convertemos o parent_id para número ou null, garantindo o tipo correto.
    const parent_id = parentIdFromRequest ? parseInt(parentIdFromRequest, 10) : null;
    

    if (!name || !status || !type) {
        return res.status(400).json({ message: 'Nome, Status e Tipo são obrigatórios.' });
    }

    try {
        const id = parseInt(idFromParams, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de unidade inválido.' });
        }

        // ===== INÍCIO DOS NOVOS BLOCOS DE VERIFICAÇÃO DE DUPLICIDADE =====

        // Verificação 1: Checa se o CÓDIGO (se existir) já pertence a OUTRA unidade.
        if (code) {
            const codeConflictCheck = await pool.query(
                `SELECT id FROM units WHERE code = $1 AND id != $2`,
                [code.toUpperCase(), id]
            );
            if (codeConflictCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Já existe outra unidade com este Código/Sigla.' });
            }
        }

        // Verificação 2: Checa se a combinação de NOME, TIPO e PAI já pertence a OUTRA unidade.
        const nameConflictCheck = await pool.query(
            // "IS NOT DISTINCT FROM" lida corretamente com parent_id que pode ser NULL
            `SELECT id FROM units WHERE name = $1 AND type = $2 AND parent_id IS NOT DISTINCT FROM $3 AND id != $4`,
            [name, type, parent_id || null, id]
        );
        if (nameConflictCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Já existe outra unidade com este nome na mesma hierarquia.' });
        }

        // ===== FIM DOS NOVOS BLOCOS DE VERIFICAÇÃO =====
        
        const updatedUnit = await pool.query(
            `UPDATE units SET 
                name = $1, code = $2, parent_id = $3, status = $4, address = $5, 
                contact_phone = $6, contact_email = $7, notes = $8, updated_at = NOW(),
                type = $9
            WHERE id = $10 RETURNING *`,
            [name, code || null, parent_id || null, status, address || null, contact_phone || null, contact_email || null, notes || null, type, id]
        );

        if (updatedUnit.rowCount === 0) {
            return res.status(404).json({ message: 'Unidade não encontrada para atualização.' });
        }

        await logAudit(req.user.id, 'update_unit', 'unit', id, { updated_data: updatedUnit.rows[0] }, ipAddress);
        res.status(200).json({ message: 'Unidade atualizada com sucesso.', unit: updatedUnit.rows[0] });

    } catch (error) {
        console.error('Erro ao atualizar unidade:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar unidade.' });
    }
});

// Deletar uma Unidade
app.delete('/api/units/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verifica se a unidade é 'pai' de alguma outra unidade
    const childUnitsCount = await pool.query('SELECT COUNT(*) FROM units WHERE parent_id = $1', [id]);
    if (parseInt(childUnitsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar esta unidade, pois ela é uma unidade superior para outra(s). Remova ou realoque as unidades filhas primeiro.' });
    }

    // Adicionar aqui outras verificações (ex: se existem ativos ou pessoas associados)
    //const assetsCount = await pool.query('SELECT COUNT(*) FROM assets WHERE current_unit_id = $1', [id]);
    // if (parseInt(assetsCount.rows[0].count, 10) > 0) {
    //   return res.status(400).json({ message: 'Não é possível deletar esta unidade, pois existem ativos associados a ela.' });
    // }

    const deletedUnit = await pool.query('DELETE FROM units WHERE id = $1 RETURNING *', [id]);
    if (deletedUnit.rowCount === 0) {
        return res.status(404).json({ message: 'Unidade não encontrada para exclusão.' });
    }

    await logAudit(req.user.id, 'delete_unit', 'unit', id, { deleted_unit: deletedUnit.rows[0] }, ipAddress);
    res.status(200).json({ message: 'Unidade deletada com sucesso.' });

  } catch (error) {
    console.error('Erro ao deletar unidade:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao deletar unidade.' });
  }
});

// Criar uma nova Pessoa
app.post('/api/people', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { full_name, unit_id, registration_number, cpf, email, contact_phone, job_title } = req.body;
  const ipAddress = req.ip;

  if (!full_name || !cpf || !email) {
    return res.status(400).json({ message: 'Nome Completo, CPF e Email são obrigatórios.' });
  }

  const formattedPhone = formatPhoneNumber(contact_phone);

  try {
    // Verificar unicidade de CPF, Matrícula e Email
    const existingPerson = await pool.query(
      `SELECT id FROM people WHERE cpf = $1 OR (registration_number IS NOT NULL AND registration_number = $2) OR email = $3`,
      [cpf, registration_number, email]
    );
    if (existingPerson.rows.length > 0) {
      await logAudit(req.user.id, 'person_creation_failed', 'person', null,
        { reason: 'CPF, Registration Number or Email already exists', attempted_cpf: cpf, attempted_registration: registration_number, attempted_email: email }, ipAddress);
      return res.status(409).json({ message: 'Pessoa com este CPF, Matrícula ou Email já cadastrada.' });
    }

    const newPerson = await pool.query(
      `INSERT INTO people (full_name, unit_id, registration_number, cpf, email, contact_phone, job_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [full_name, unit_id || null, registration_number || null, cpf, email, formattedPhone, job_title || null]
    );

    await logAudit(req.user.id, 'create_person', 'person', newPerson.rows[0].id, { full_name, cpf, email }, ipAddress);
    res.status(201).json({ message: 'Pessoa cadastrada com sucesso.', person: newPerson.rows[0] });

  } catch (error) {
    console.error('Erro ao cadastrar nova pessoa:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao cadastrar pessoa.' });
  }
});

// Listar todas as Pessoas
app.get('/api/people', authenticateToken, async (req, res) => {
  try {
    // A nova query inclui uma subconsulta para contar os ativos de cada pessoa
    const query = `
      SELECT
        p.*,
        u.name AS unit_name,
        COALESCE(asset_counts.count, 0) AS current_assets_count
      FROM
        people p
      LEFT JOIN
        units u ON p.unit_id = u.id
      LEFT JOIN
        (
          -- Subconsulta que calcula a contagem de ativos para cada pessoa
          SELECT
            am.recipient_person_id,
            COUNT(DISTINCT a.id) as count
          FROM
            assets a
          -- Encontra a última movimentação de saída de cada ativo
          JOIN
            (
              SELECT
                ma.asset_id,
                MAX(am.id) as last_movement_id
              FROM
                asset_movements am
              JOIN
                movement_assets ma ON am.id = ma.movement_id
              WHERE
                am.movement_type IN ('exit', 'loan')
              GROUP BY
                ma.asset_id
            ) as latest_movements ON a.id = latest_movements.asset_id
          JOIN
            asset_movements am ON latest_movements.last_movement_id = am.id
          WHERE
            a.status IN ('in_use', 'loaned')
          GROUP BY
            am.recipient_person_id
        ) AS asset_counts ON p.id = asset_counts.recipient_person_id
      ORDER BY
        p.full_name ASC;
    `;

    const result = await pool.query(query);
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
     u.name AS unit_name
   FROM people p
   LEFT JOIN units u ON p.unit_id = u.id
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
  const { full_name, unit_id, registration_number, cpf, email, contact_phone, job_title } = req.body;
  const ipAddress = req.ip;

  if (!full_name || !cpf || !email) {
    return res.status(400).json({ message: 'Nome Completo, CPF e Email são obrigatórios.' });
  }

  const formattedPhone = formatPhoneNumber(contact_phone);

  try {
    const oldPersonResult = await pool.query('SELECT * FROM people WHERE id = $1', [id]);
    if (oldPersonResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pessoa não encontrada para atualização.' });
    }
    const oldPerson = oldPersonResult.rows[0];

    // Verifica se os dados já pertencem a OUTRA pessoa
    const existingConflicts = await pool.query(
      `SELECT id FROM people WHERE (cpf = $1 OR (registration_number IS NOT NULL AND registration_number = $2) OR email = $3) AND id != $4`,
      [cpf, registration_number, email, id]
    );
    if (existingConflicts.rows.length > 0) {
      await logAudit(req.user.id, 'person_update_failed', 'person', id, { reason: 'CPF, Registration Number or Email already exists for another person', attempted_cpf: cpf, attempted_registration: registration_number, attempted_email: email }, ipAddress);
      return res.status(409).json({ message: 'Pessoa com este CPF, Matrícula ou Email já existe para outro cadastro.' });
    }

     const updatedPerson = await pool.query(
      `UPDATE people SET
         full_name = $1, unit_id = $2, registration_number = $3, cpf = $4, email = $5, contact_phone = $6, job_title = $7,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [full_name, unit_id || null, registration_number || null, cpf, email, formattedPhone, job_title || null, id]
    );

    if (updatedPerson.rowCount === 0) {
        return res.status(404).json({ message: 'Pessoa não encontrada para atualização.' });
    }

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

// ROTA OTIMIZADA PARA BUSCAR PESSOAS (react-select async)
app.get('/api/people/search', authenticateToken, async (req, res) => {
  const { searchTerm } = req.query;

  // Se o termo de busca for muito curto, retorna vazio para não sobrecarregar o banco
  if (!searchTerm || String(searchTerm).length < 3) {
    return res.json([]);
  }

  try {
    const query = `
      SELECT id, full_name, cpf FROM people
      WHERE 
        full_name ILIKE $1 OR
        cpf ILIKE $1
      ORDER BY full_name ASC
      LIMIT 20;
    `;
    // Usamos '%' para buscar por partes do nome/CPF
    const result = await pool.query(query, [`%${searchTerm}%`]);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erro ao buscar pessoas:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// >>> NOVA ROTA PARA DAR BAIXA EM LOTE <<<

app.put('/api/assets/batch-retire', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const { assetIds, reason } = req.body;
  const ipAddress = req.ip;

  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return res.status(400).json({ message: 'É necessário fornecer uma lista de IDs de ativos.' });
  }
  if (!reason) {
    return res.status(400).json({ message: 'O motivo da baixa é obrigatório.' });
  }

  const client = await pool.connect();
  let successCount = 0;
  const errors = [];
  const processedIds = [];

  try {
    await client.query('BEGIN');

    for (const assetId of assetIds) {
      // 1. Busca cada ativo para validar seu status
      const assetResult = await client.query('SELECT id, status, notes, patrimonio_number FROM assets WHERE id = $1', [assetId]);

      if (assetResult.rows.length === 0) {
        errors.push({ id: assetId, reason: 'Ativo não encontrado.' });
        continue; // Pula para o próximo ID
      }
      
      const asset = assetResult.rows[0];

      // 2. Aplica a regra de negócio: só pode baixar se estiver 'disponível' ou 'em manutenção'
      if (!['available', 'maintenance'].includes(asset.status)) {
        errors.push({ id: assetId, patrimonio: asset.patrimonio_number, reason: `Status atual é '${asset.status}', não pode ser baixado.` });
        continue;
      }

      // 3. Se for válido, prepara a atualização
      const retirementNote = `\n[BAIXADO EM ${new Date().toLocaleDateString('pt-BR')}]: ${reason}`;
      const updatedNotes = (asset.notes || '') + retirementNote;

      await client.query(
        `UPDATE assets SET status = 'retired', notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [updatedNotes, assetId]
      );
      
      successCount++;
      processedIds.push(assetId);
    }

    await client.query('COMMIT'); // Confirma a transação para todos os ativos válidos

    await logAudit(req.user.id, 'batch_retire_asset', 'asset', null, { success_count: successCount, failed_count: errors.length, processed_ids: processedIds, errors }, ipAddress);
    
    res.status(200).json({ 
      message: `Operação concluída. ${successCount} ativos baixados com sucesso.`,
      successCount,
      errors
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao dar baixa em lote:', error);
    res.status(500).json({ message: `Erro ao processar a baixa em lote: ${error.message}` });
  } finally {
    client.release();
  }
});

// server.js -> Adicionar esta NOVA ROTA

// ROTA PARA CRIAR UMA SOLICITAÇÃO DE BAIXA
app.post(
  '/api/assets/:id/request-retirement',
  authenticateToken,
  uploadEvidence.single('evidenceFile'), // Middleware para o upload do arquivo
  async (req, res) => {
    const assetId = parseInt(req.params.id, 10);
    const { reason, details } = req.body;
    const requesterUserId = req.user.id;
    const ipAddress = req.ip;

    if (!req.file) {
      return res.status(400).json({ message: 'O arquivo de evidência (laudo/B.O.) é obrigatório.' });
    }
    if (!reason) {
      // Se a razão não for enviada, remove o arquivo para não deixar lixo
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'O motivo da baixa é obrigatório.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verifica o status atual do ativo
      const assetResult = await client.query('SELECT status FROM assets WHERE id = $1', [assetId]);
      if (assetResult.rows.length === 0) throw new Error('Ativo não encontrado.');

      const currentStatus = assetResult.rows[0].status;
      if (!['available', 'maintenance'].includes(currentStatus)) {
        throw new Error(`Ativos com status '${currentStatus}' não podem ter a baixa solicitada.`);
      }

      // Atualiza o status do ativo para 'pending_retirement'
      await client.query(
        `UPDATE assets SET status = 'pending_retirement', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [assetId]
      );

      // Insere o registro da solicitação na nova tabela
      const requestResult = await client.query(
        `INSERT INTO retirement_requests (asset_id, requester_user_id, reason, details, evidence_path)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [assetId, requesterUserId, reason, details, req.file.path]
      );
      const newRequestId = requestResult.rows[0].id;

      await client.query('COMMIT');
      await logAudit(requesterUserId, 'request_retirement', 'asset', assetId, { requestId: newRequestId, reason }, ipAddress);
      res.status(201).json({ message: 'Solicitação de baixa registrada com sucesso. Aguardando aprovação do gestor.' });

    } catch (error) {
      await client.query('ROLLBACK');
      // Se deu erro, remove o arquivo que foi feito upload
      if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
      }
      console.error('Erro ao solicitar baixa de ativo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      res.status(500).json({ message: `Falha na solicitação: ${errorMessage}` });
    } finally {
      client.release();
    }
  }
);

// server.js -> Adicionar esta NOVA ROTA

// ROTA PARA LISTAR SOLICITAÇÕES DE BAIXA PENDENTES (ADMIN)
app.get('/api/retirement-requests/pending', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rr.id,
        rr.status,
        rr.reason,
        rr.details,
        rr.created_at,
        a.patrimonio_number,
        a.brand,
        a.model,
        u.full_name as requester_name
      FROM retirement_requests rr
      JOIN assets a ON rr.asset_id = a.id
      JOIN users u ON rr.requester_user_id = u.id
      WHERE rr.status = 'pending'
      ORDER BY rr.created_at ASC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar solicitações de baixa:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA APROVAR UMA SOLICITAÇÃO DE BAIXA (ADMIN)
app.put('/api/retirement-requests/:id/approve', authenticateToken, authorizePermission('ACTION_APPROVE_REJECT'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const approverUserId = req.user.id;
  const ipAddress = req.ip;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Busca a solicitação para obter o asset_id e validar
    const requestResult = await client.query('SELECT asset_id, status FROM retirement_requests WHERE id = $1', [requestId]);
    if (requestResult.rows.length === 0) throw new Error('Solicitação não encontrada.');
    if (requestResult.rows[0].status !== 'pending') throw new Error('Esta solicitação já foi processada.');
    const assetId = requestResult.rows[0].asset_id;

    // Atualiza o status do ativo para 'retired'
    await client.query(
      `UPDATE assets SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [assetId]
    );

    // Atualiza o registro da solicitação para 'approved'
    await client.query(
      `UPDATE retirement_requests SET status = 'approved', approver_user_id = $1, approval_date = CURRENT_TIMESTAMP WHERE id = $2`,
      [approverUserId, requestId]
    );

    await client.query('COMMIT');
    await logAudit(approverUserId, 'approve_retirement', 'asset', assetId, { requestId }, ipAddress);
    res.status(200).json({ message: 'Solicitação de baixa APROVADA com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao aprovar baixa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    res.status(500).json({ message: `Falha na aprovação: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// ROTA PARA REJEITAR UMA SOLICITAÇÃO DE BAIXA (ADMIN)
app.put('/api/retirement-requests/:id/reject', authenticateToken, authorizePermission('ACTION_APPROVE_REJECT'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const { rejection_reason } = req.body;
  const approverUserId = req.user.id;
  const ipAddress = req.ip;

  if (!rejection_reason) {
    return res.status(400).json({ message: 'O motivo da rejeição é obrigatório.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const requestResult = await client.query('SELECT asset_id, status FROM retirement_requests WHERE id = $1', [requestId]);
    if (requestResult.rows.length === 0) throw new Error('Solicitação não encontrada.');
    if (requestResult.rows[0].status !== 'pending') throw new Error('Esta solicitação já foi processada.');
    const assetId = requestResult.rows[0].asset_id;

    // Reverte o status do ativo para 'available'
    await client.query(
      `UPDATE assets SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [assetId]
    );

    // Atualiza o registro da solicitação para 'rejected'
    await client.query(
      `UPDATE retirement_requests SET status = 'rejected', approver_user_id = $1, approval_date = CURRENT_TIMESTAMP, rejection_reason = $2 WHERE id = $3`,
      [approverUserId, rejection_reason, requestId]
    );

    await client.query('COMMIT');
    await logAudit(approverUserId, 'reject_retirement', 'asset', assetId, { requestId, rejection_reason }, ipAddress);
    res.status(200).json({ message: 'Solicitação de baixa REJEITADA com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao rejeitar baixa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    res.status(500).json({ message: `Falha na rejeição: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// ROTA DE CONSULTA INTELIGENTE E UNIFICADA PARA ATIVOS
app.get('/api/query/asset/:identifier', authenticateToken, async (req, res) => {
  const { identifier } = req.params;
  const ipAddress = req.ip;

  try {
    // Esta é a consulta principal que busca os dados base do ativo
    const assetQuery = `
      SELECT
        a.id, a.sku, a.brand, a.model, a.description, a.serial_number, a.patrimonio_number,
        a.status, a.acquisition_date, a.notes,
        it.name AS item_type_name,
        u.name AS current_unit_name
      FROM assets a
      JOIN item_types it ON a.item_type_id = it.id
      LEFT JOIN units u ON a.current_unit_id = u.id
      WHERE a.patrimonio_number = $1 OR a.serial_number = $1
    `;
    const assetResult = await pool.query(assetQuery, [identifier]);

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado com este identificador.' });
    }
    const assetDetails = assetResult.rows[0];

    // Se o ativo estiver em uso ou emprestado, faremos uma segunda consulta para encontrar o responsável
    if (['in_use', 'loaned'].includes(assetDetails.status)) {
      const responsibleQuery = `
        SELECT
          p.full_name
        FROM people p
        JOIN asset_movements am ON p.id = am.recipient_person_id
        JOIN movement_assets ma ON am.id = ma.movement_id
        WHERE ma.asset_id = $1 AND am.movement_type IN ('exit', 'loan')
        ORDER BY am.movement_date DESC, am.id DESC
        LIMIT 1
      `;
      const responsibleResult = await pool.query(responsibleQuery, [assetDetails.id]);

      if (responsibleResult.rows.length > 0) {
        assetDetails.responsible_person_name = responsibleResult.rows[0].full_name;
      } else {
        assetDetails.responsible_person_name = 'Responsável não localizado no histórico';
      }
    }

    await logAudit(req.user.id, 'query_asset_details', 'asset', assetDetails.id, { identifier }, ipAddress);
    res.status(200).json(assetDetails);

  } catch (error) {
    console.error(`Erro na consulta inteligente do ativo ${identifier}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor ao consultar ativo.' });
  }
});

// ROTA PARA BUSCAR OS DETALHES DE UMA ÚNICA SOLICITAÇÃO
app.get('/api/retirement-requests/:id', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(`
      SELECT
        rr.*,
        a.patrimonio_number, a.brand, a.model, a.serial_number,
        u.full_name as requester_name
      FROM retirement_requests rr
      JOIN assets a ON rr.asset_id = a.id
      LEFT JOIN users u ON rr.requester_user_id = u.id
      WHERE rr.id = $1
    `, [requestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Solicitação não encontrada.' });
    }
    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao buscar detalhes da solicitação:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA FAZER O DOWNLOAD DO ARQUIVO DE EVIDÊNCIA
app.get('/api/retirement-requests/:id/download-evidence', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('SELECT evidence_path FROM retirement_requests WHERE id = $1', [requestId]);
    if (result.rows.length === 0 || !result.rows[0].evidence_path) {
      return res.status(404).json({ message: 'Arquivo de evidência não encontrado para esta solicitação.' });
    }
    const filePath = result.rows[0].evidence_path;
    
    // Usa res.download() para enviar o arquivo de forma segura
    res.download(filePath, (err) => {
      if (err) {
        console.error("Erro no download do arquivo:", err);
        res.status(500).send("Não foi possível baixar o arquivo.");
      }
    });

  } catch (error) {
    console.error('Erro ao processar download:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
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

// server.js -> ADICIONE ESTA NOVA ROTA COMPLETA

// ROTA PARA BUSCAR O RESUMO DE ATIVOS ATUAIS DE UMA PESSOA
// server.js -> SUBSTITUA A ROTA EXISTENTE PELA VERSÃO FINAL ABAIXO

app.get('/api/people/:id/assets-summary', authenticateToken, async (req, res) => {
  const personId = parseInt(req.params.id, 10);

  try {
    // Esta query agora encontra as MOVIMENTAÇÕES ativas e agrupa os ativos dentro de cada uma
    const query = `
      WITH ActiveMovements AS (
        SELECT
          am.id
        FROM asset_movements am
        WHERE am.movement_type IN ('loan', 'exit')
          AND am.recipient_person_id = $1
          AND EXISTS (
            SELECT 1 FROM movement_assets ma JOIN assets a ON ma.asset_id = a.id
            WHERE ma.movement_id = am.id AND a.status IN ('in_use', 'loaned')
          )
          AND NOT EXISTS (
            SELECT 1 FROM movement_assets ma_ret JOIN asset_movements am_ret ON ma_ret.movement_id = am_ret.id
            WHERE am_ret.movement_type = 'return'
            AND ma_ret.asset_id IN (SELECT asset_id FROM movement_assets WHERE movement_id = am.id)
            AND am_ret.movement_date > am.movement_date
          )
      )
      SELECT
        am.id AS movement_id,
        am.expected_return_date,
        am.delivery_status,
        json_agg(
          json_build_object(
            'id', a.id,
            'patrimonio_number', a.patrimonio_number,
            'item_type_name', it.name,
            'brand', a.brand,
            'model', a.model,
            'status', a.status
          )
        ) AS assets
      FROM asset_movements am
      JOIN movement_assets ma ON am.id = ma.movement_id
      JOIN assets a ON ma.asset_id = a.id
      JOIN item_types it ON a.item_type_id = it.id
      WHERE am.id IN (SELECT id FROM ActiveMovements)
      GROUP BY am.id, am.expected_return_date, am.delivery_status
      ORDER BY am.expected_return_date ASC;
    `;
    
    const result = await pool.query(query, [personId]);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error(`Erro ao buscar resumo de ativos para a pessoa ${personId}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
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
app.post('/api/people/import', authenticateToken, authorizeRole(['admin', 'manager']), uploadImport.single('file'), async (req, res) => {
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
  const line = index + 2;
  const {
    full_name,
    cpf,
    email,
    registration_number,
    unit_name, // Espera a coluna 'unit_name' na planilha
    contact_phone 
  } = row;

  if (!full_name || !cpf || !email) {
    errors.push(`Linha ${line}: Ignorada. Nome completo, CPF e E-mail são obrigatórios.`);
    continue;
  }

  const formattedPhone = formatPhoneNumber(contact_phone);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingPerson = await client.query('SELECT id FROM people WHERE cpf = $1 OR email = $2', [cpf, email]);
    if (existingPerson.rows.length > 0) {
      errors.push(`Linha ${line}: Pessoa com CPF '${cpf}' ou E-mail '${email}' já existe. Ignorada.`);
      await client.query('ROLLBACK');
      continue;
    }

    let unitId = null; // Variável renomeada
    if (unit_name) {
      // Busca na tabela 'units' pelo nome
      const unitResult = await client.query('SELECT id FROM units WHERE name = $1', [unit_name]);
      if (unitResult.rows.length > 0) {
        unitId = unitResult.rows[0].id;
      } else {
        // Mensagem de erro atualizada
        errors.push(`Linha ${line}: Unidade '${unit_name}' não encontrada. A pessoa será cadastrada sem unidade.`);
      }
    }
    
    // Insere na coluna 'unit_id'
    await client.query(
      `INSERT INTO people (full_name, cpf, email, registration_number, unit_id, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [full_name, cpf, email, registration_number || null, unitId, formattedPhone]
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

// Criar um novo Ativo (Cadastro Manual)
  app.post('/api/assets', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const { item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_unit_id, acquisition_date, warranty_end_date, notes } = req.body;
  const ipAddress = req.ip;

  if (!item_type_id || !brand || !model || !status) {
    return res.status(400).json({ message: 'Tipo de Item, Marca, Modelo e Status são obrigatórios.' });
  }

  try {
    // Gerar SKU automaticamente
    const sku = await generateSku(brand, item_type_id);

    const newAsset = await pool.query(
      `INSERT INTO assets (sku, item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_unit_id, acquisition_date, warranty_end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [sku, item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_unit_id, acquisition_date, warranty_end_date, notes]
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
  const { status } = req.query;

  try {
    let query;
    const params = [];

    if (status === 'in_use' || status === 'loaned') {
      // Consulta enriquecida para ativos que estão com usuários
      query = `
        WITH LatestOutgoingMovement AS (
          SELECT
            ma.asset_id,
            MAX(am.id) AS movement_id
          FROM asset_movements am
          JOIN movement_assets ma ON am.id = ma.movement_id
          WHERE am.movement_type IN ('exit', 'loan')
          GROUP BY ma.asset_id
        )
        SELECT
          a.*,
          it.name AS item_type_name,
          u.name AS current_unit_name,
          p.full_name AS responsible_person_name
        FROM assets a
        JOIN item_types it ON a.item_type_id = it.id
        LEFT JOIN LatestOutgoingMovement lom ON a.id = lom.asset_id
        LEFT JOIN asset_movements am ON lom.movement_id = am.id
        LEFT JOIN people p ON am.recipient_person_id = p.id
        LEFT JOIN units u ON am.destination_unit_id = u.id
        WHERE a.status = $1
        ORDER BY p.full_name, a.patrimonio_number;
      `;
      params.push(status);
    } else {
      // Consulta padrão para outros status (available, maintenance, etc.)
      query = `
        SELECT
          a.*,
          it.name AS item_type_name,
          u.name AS current_unit_name
        FROM assets a
        JOIN item_types it ON a.item_type_id = it.id
        LEFT JOIN units u ON a.current_unit_id = u.id
      `;
      if (status) {
        params.push(status);
        query += ` WHERE a.status = $1`;
      }
      query += ` ORDER BY a.patrimonio_number ASC`;
    }

    const result = await pool.query(query, params);
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

// Rota para importar Ativos via XLSX/CSV
app.post('/api/assets/import', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const parseAndFormatDate = (dateInput) => {
    if (!dateInput) return null;
    let parsedDate;
    if (dateInput instanceof Date && !isNaN(dateInput)) {
        parsedDate = dateInput;
    } else if (typeof dateInput === 'string') {
        if (!isNaN(dateInput) && !isNaN(parseFloat(dateInput))) {
            const numericDate = Number(dateInput);
            parsedDate = new Date(Math.round((numericDate - 25569) * 86400 * 1000));
        } else {
            const parts = dateInput.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                if (year && year.length === 4) {
                    parsedDate = new Date(year, month - 1, day);
                }
            }
        }
    } else if (typeof dateInput === 'number') {
        parsedDate = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
    }
    if (parsedDate && !isNaN(parsedDate)) {
        return parsedDate.toISOString().split('T')[0];
    }
    return 'invalid';
  };

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  let importedCount = 0;
  let errors = [];

  try {
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { cellDates: true });
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }
    fs.unlinkSync(filePath);

    const client = await pool.connect();
    try {
      for (const [index, row] of data.entries()) {
        const line = index + 2;
        // CORRIGIDO AQUI: Adicionado 'unit_name' à desestruturação
        const { item_type_name, brand, model, serial_number, patrimonio_number, acquisition_date, warranty_end_date, unit_name } = row;
        let { status } = row;

        if (!item_type_name || !brand || !model) {
          errors.push(`Linha ${line}: Ignorada. 'item_type_name', 'brand' e 'model' são obrigatórios.`);
          continue;
        }

        if (!status) {
          status = 'available';
        }

        const formattedAcquisitionDate = parseAndFormatDate(acquisition_date);
        const formattedWarrantyEndDate = parseAndFormatDate(warranty_end_date);

        if (formattedAcquisitionDate === 'invalid' || formattedWarrantyEndDate === 'invalid') {
            errors.push(`Linha ${line}: Data inválida. Aquisição: '${acquisition_date}', Garantia: '${warranty_end_date}'. Ignorado.`);
            continue;
        }

        try {
          await client.query('BEGIN');
          const existingAsset = await client.query('SELECT id FROM assets WHERE (patrimonio_number IS NOT NULL AND patrimonio_number = $1) OR (serial_number IS NOT NULL AND serial_number = $2)', [patrimonio_number, serial_number]);
          if (existingAsset.rows.length > 0) {
            errors.push(`Linha ${line}: Ativo com patrimônio '${patrimonio_number}' ou série '${serial_number}' já existe. Ignorado.`);
            await client.query('ROLLBACK');
            continue;
          }

          const itemTypeResult = await client.query('SELECT id FROM item_types WHERE name = $1', [item_type_name]);
          if (itemTypeResult.rows.length === 0) {
            errors.push(`Linha ${line}: Tipo de item '${item_type_name}' não encontrado. Ignorado.`);
            await client.query('ROLLBACK');
            continue;
          }
          const item_type_id = itemTypeResult.rows[0].id;
          const sku = await generateSku(brand, item_type_id);

          let current_unit_id = null;
          if (unit_name) {
            const unitResult = await client.query('SELECT id FROM units WHERE name = $1', [unit_name]);
            if (unitResult.rows.length > 0) {
              current_unit_id = unitResult.rows[0].id;
            } else {
              errors.push(`Linha ${line}: Unidade '${unit_name}' não encontrada. O ativo será cadastrado sem unidade.`);
            }
          }

          await client.query(
            `INSERT INTO assets (sku, item_type_id, brand, model, serial_number, patrimonio_number, status, acquisition_date, warranty_end_date, notes, current_unit_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [sku, item_type_id, brand, model, serial_number, patrimonio_number, status, formattedAcquisitionDate, formattedWarrantyEndDate, row.notes || null, current_unit_id]
          );

          await client.query('COMMIT');
          importedCount++;

        } catch (dbError) {
          await client.query('ROLLBACK');
          errors.push(`Linha ${line}: Erro no banco de dados. ${dbError.message}`);
        }
      }
    } finally {
      client.release();
    }

    await logAudit(req.user.id, 'import_assets', 'asset', null, { imported_count: importedCount, errors_count: errors.length }, ipAddress);
    
    res.status(200).json({
      message: 'Importação concluída.',
      importedCount: importedCount,
      errors: errors,
    });

  } catch (error) {
    console.error('Erro geral na importação de ativos:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await logAudit(req.user.id, 'import_assets_error', 'asset', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar ativos.', error: error.message });
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

    if (['retired', 'disposed'].includes(currentAssetStatus)) {
      // Usamos o status em inglês para a mensagem, pois o frontend fará a tradução.
      errorMessage = `Este ativo (status: ${currentAssetStatus}) não pode mais ser movimentado.`;
      return res.status(409).json({ message: errorMessage });
    }

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
  const { item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_unit_id, acquisition_date, warranty_end_date, notes } = req.body;
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
         current_unit_id = $10, acquisition_date = $11, warranty_end_date = $12, notes = $13,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $14 RETURNING *`,
      [sku, item_type_id, brand, model, description, serial_number, patrimonio_number, unit_of_measure, status, current_unit_id, acquisition_date, warranty_end_date, notes, id]
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

// Rota para importar Tipos de Itens via XLSX/CSv

app.post('/api/item-types/import', authenticateToken, authorizeRole(['admin', 'manager']), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];

  try {
    // A sua lógica de leitura de arquivos está ótima e foi mantida.
    // Apenas garantimos que o CSV use ponto e vírgula, que é mais comum.
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' })) // Ajustado para ponto e vírgula
          .on('data', (row) => data.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }

    fs.unlinkSync(filePath); // Remove o arquivo temporário

    let importedCount = 0;
    let updatedCount = 0;
    let errors = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      
      // ✨ CORRIGIDO: Lógica de código sequencial movida para fora do loop para otimização
      const lastItemType = await client.query('SELECT code FROM item_types ORDER BY id DESC LIMIT 1');
      let nextCodeNum = 1;
      if (lastItemType.rows.length > 0 && lastItemType.rows[0].code) {
        const lastCode = lastItemType.rows[0].code;
        const numMatch = lastCode.match(/SEDUC(\d+)/); // ✨ CORRIGIDO: Busca por 'SEDUC'
        if (numMatch && numMatch[1]) {
          nextCodeNum = parseInt(numMatch[1], 10) + 1;
        }
      }

      for (const row of data) {
        // ✨ CORRIGIDO: Lendo todos os campos necessários, com flexibilidade nos nomes das colunas
        console.log('DEBUG: Processando linha do CSV:', row);
        const name = row['Nome do Tipo de Item'] || row['name'];
        const sku_code = row['Código SKU (3 Letras)'] || row['sku_code'];
        const description = row['Descrição (Opcional)'] || row['description'];

        // ✨ CORRIGIDO: Validação agora inclui o sku_code
        if (!name || !sku_code) {
          errors.push(`Linha ignorada: 'Nome' e 'Código SKU' são obrigatórios. Dados: ${JSON.stringify(row)}`);
          continue;
        }
        
        if (String(sku_code).length !== 3) {
            errors.push(`Linha ignorada para '${name}': O Código SKU deve ter 3 caracteres. Valor recebido: '${sku_code}'`);
            continue;
        }

        // ✨ CORRIGIDO: O código do sistema agora usa o prefixo 'SEDUC'
        const code = `SEDUC${String(nextCodeNum).padStart(3, '0')}`;

        // ✨ CORRIGIDO: Usando INSERT ... ON CONFLICT para inserir ou atualizar (UPSERT)
        const result = await client.query(
          `INSERT INTO item_types (name, sku_code, description, code)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (sku_code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            updated_at = NOW()
          RETURNING xmax`, // xmax é 0 para INSERT, e diferente de 0 para UPDATE
          [name, sku_code.toUpperCase(), description, code]
        );

        if (result.rows[0].xmax === '0') {
            importedCount++;
            nextCodeNum++; // Só incrementa o código se for uma nova inserção
        } else {
            updatedCount++;
        }
      }

      await client.query('COMMIT');
      await logAudit(req.user.id, 'import_item_types', 'item_type', null, { imported: importedCount, updated: updatedCount, errors: errors.length }, ipAddress);
      
      res.status(200).json({
        message: `Importação concluída. ${importedCount} tipos criados, ${updatedCount} atualizados.`,
        errors: errors,
      });

    } catch (dbError) {
        await client.query('ROLLBACK');
        console.error('Erro na transação de importação:', dbError);
        errors.push(`Erro fatal no banco de dados: ${dbError.message}`);
        res.status(500).json({ message: 'Erro ao salvar no banco.', errors });
    } finally {
        client.release();
    }

  } catch (error) {
    console.error('Erro geral na importação de tipos de itens:', error);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    await logAudit(req.user.id, 'import_item_types_error', 'item_type', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao importar tipos de itens.', error: error.message });
  }
});

// Rota para importar Unidades via XLSX/CSV (VERSÃO FINAL E ROBUSTA)
app.post('/api/units/import', authenticateToken, authorizeRole(['admin', 'manager']), uploadImport.single('file'), async (req, res) => {
  const ipAddress = req.ip;
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let data = [];
  
  try {
    // Lógica para ler o arquivo XLSX ou CSV
    if (fileExtension === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileExtension === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath).pipe(csv({ separator: ';' }))
          .on('data', (row) => results.push(row))
          .on('end', () => { data = results; resolve(); })
          .on('error', (error) => reject(error));
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Formato de arquivo não suportado. Use .xlsx ou .csv.' });
    }
  } catch (readError) {
    console.error('Erro ao ler o arquivo de importação:', readError);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ message: `Erro ao processar o arquivo: ${readError.message}` });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  let importedCount = 0;
  let updatedCount = 0;
  let errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Inicia a transação

    // Mapeia todos os nomes de unidades existentes para IDs para consulta rápida
    const allUnitsResult = await client.query('SELECT id, name FROM units');
    const unitNameToIdMap = new Map(allUnitsResult.rows.map(u => [u.name, u.id]));

    // Primeira Etapa: Processa apenas as unidades que já existem ou são de topo (sem pai)
    for (const [index, row] of data.entries()) {
      const { name, type, code, parent_name } = row;
      if (!parent_name) {
        // Validação
        if (!name || !type) { errors.push(`Linha ${index + 2}: 'name' e 'type' são obrigatórios.`); continue; }
        
        const result = await upsertUnit(client, row); // Função auxiliar para inserir/atualizar
        if (result.isNew) importedCount++; else updatedCount++;
        
        // Atualiza nosso mapa local para a próxima etapa
        if (!unitNameToIdMap.has(name)) {
            unitNameToIdMap.set(name, result.id);
        }
      }
    }

    // Segunda Etapa: Processa as unidades "filhas"
    for (const [index, row] of data.entries()) {
      const { name, type, code, parent_name } = row;
      if (parent_name) {
         if (!name || !type) { errors.push(`Linha ${index + 2}: 'name' e 'type' são obrigatórios.`); continue; }
        
        // Busca o ID do pai no nosso mapa
        const parentId = unitNameToIdMap.get(parent_name);
        if (!parentId) {
            errors.push(`Linha ${index + 2}: Unidade superior '${parent_name}' para '${name}' não foi encontrada.`);
            continue;
        }

        const result = await upsertUnit(client, { ...row, parent_id: parentId });
        if (result.isNew) importedCount++; else updatedCount++;
      }
    }

    await client.query('COMMIT'); // Confirma todas as inserções/atualizações

    await logAudit(req.user.id, 'import_units', 'unit', null, { imported: importedCount, updated: updatedCount, errors: errors.length }, ipAddress);
    res.status(200).json({
      message: `Importação concluída. ${importedCount} unidades criadas, ${updatedCount} atualizadas.`,
      errors: errors,
    });

  } catch (error) {
    await client.query('ROLLBACK'); // Desfaz tudo em caso de erro
    await logAudit(req.user.id, 'import_units_error', 'unit', null, { error: error.message }, ipAddress);
    res.status(500).json({ message: `Erro durante a transação: ${error.message}`, errors });
  } finally {
    client.release();
  }
});

// Função auxiliar para inserir ou atualizar (UPSERT) uma unidade
async function upsertUnit(client, row) {
    const { name, type, code, parent_id, address, contact_phone, contact_email, notes } = row;
    
    // Valida o tipo
    const validTypes = ['ADMINISTRATIVA', 'ESCOLAR', 'EXTERNA'];
    if (!validTypes.includes(type.toUpperCase())) {
        throw new Error(`Tipo '${type}' é inválido para a unidade '${name}'.`);
    }

    const result = await client.query(
        `INSERT INTO units (name, type, code, parent_id, address, contact_phone, contact_email, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name, type = EXCLUDED.type, parent_id = EXCLUDED.parent_id,
           address = EXCLUDED.address, contact_phone = EXCLUDED.contact_phone,
           contact_email = EXCLUDED.contact_email, notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING id, xmax`,
        [name, type.toUpperCase(), code || null, parent_id || null, address || null, contact_phone || null, contact_email || null, notes || null]
    );

    return { id: result.rows[0].id, isNew: result.rows[0].xmax === '0' };
}

// ======================================
// Rotas de Relatórios Iniciais
// ======================================

// Rota para exportar lista de ativos em CSV
app.get('/api/reports/assets/csv', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const result = await pool.query(
     `SELECT
         a.sku, it.name AS item_type_name, a.brand, a.model, a.description,
         a.serial_number, a.patrimonio_number, a.unit_of_measure, a.status,
         u.name AS current_unit_name,
         a.acquisition_date, a.warranty_end_date, a.notes, a.created_at
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN units u ON a.current_unit_id = u.id
       ORDER BY a.sku ASC`
    );

    const assets = result.rows;
    if (assets.length === 0) {
      return res.status(404).json({ message: 'Nenhum ativo encontrado para gerar relatório.' });
    }

    // Cria o cabeçalho do CSV
    const headers = [
      'SKU', 'Tipo de Item', 'Marca', 'Modelo', 'Descrição', 'Número de Série',
      'Número de Patrimônio', 'Unidade de Medida', 'Status', 'Unidade Atual',
      'Data de Aquisição', 'Data Fim Garantia', 'Observações', 'Data de Criação'
    ];
    const csvRows = [headers.join(',')];

    // Adiciona os dados
    for (const asset of assets) {
      const row = [
        asset.sku,
        asset.item_type_name,
        asset.brand,
        asset.model,
        asset.description ? `"${asset.description.replace(/"/g, '""')}"` : '',
        asset.serial_number,
        asset.patrimonio_number,
        asset.unit_of_measure,
        asset.status,
        asset.current_unit_name,
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
         a.sku, it.name AS item_type_name, a.brand, a.model, a.description,
         a.serial_number, a.patrimonio_number, a.unit_of_measure, a.status,
         u.name AS current_unit_name,
         a.acquisition_date, a.warranty_end_date, a.notes, a.created_at
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN units u ON a.current_unit_id = u.id
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
    res.attachment('relatorio_ativos.xlsx');
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
         u.name AS current_unit_name
       FROM assets a
       JOIN item_types it ON a.item_type_id = it.id
       LEFT JOIN units u ON a.current_unit_id = u.id
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
              ['SKU', 'Tipo de Item', 'Marca', 'Modelo', 'Status', 'Unidade Atual'].map(header => ({ text: header, style: 'tableHeader' })),
              // Dados dos ativos
              ...assets.map(asset => [
                asset.sku,
                asset.item_type_name,
                asset.brand,
                asset.model,
                asset.status,
                asset.current_unit_name || 'N/A'
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
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5], color: '#0056b3' },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
        documentTitle: { fontSize: 18, bold: true, margin: [0, 10, 0, 10], decoration: 'underline' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5], color: '#0056b3' },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#007bff',
          alignment: 'center',
          margin: [0, 5, 0, 5]
        },
        footer: { fontSize: 10, italics: true, color: '#343a40' }
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        alignment: 'left'
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_ativos.pdf');
      res.send(resultBuffer);
      logAudit(req.user.id, 'generate_receipt_pdf', 'asset_movement', movement.id, { movement_type: movement.movement_type }, ipAddress);
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_report', 'asset_report_pdf', null, { format: 'PDF', count: assets.length }, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar recibo PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erro interno do servidor ao gerar o PDF.' });
    }
  }
});

// ======================================
// Rotas para Movimentações de Ativos (Asset Movements) - ATUALIZADO PARA MÚLTIPLOS ATIVOS
// ======================================

// Registrar uma nova movimentação de ativo
app.post('/api/asset-movements', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const {
    asset_ids,
    movement_type,
    recipient_person_id,
    recipient_name,
    recipient_document,
    purpose,
    expected_return_date,
    notes,
    destination_unit_id, // AJUSTADO
    request_channel_type,
    request_channel_details,
    peripherals,
    returned_peripherals
  } = req.body;
  const responsible_user_id = req.user.id;
  const ipAddress = req.ip;

  if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0 || !movement_type || !responsible_user_id) {
    return res.status(400).json({ message: 'IDs dos ativos (array), tipo de movimentação e usuário responsável são obrigatórios.' });
  }

  if (['loan', 'exit'].includes(movement_type) && !recipient_person_id && (!recipient_name || !recipient_document)) {
    return res.status(400).json({ message: 'Para empréstimo ou saída, é necessário informar um recebedor.' });
  }

  // Validação para unidade de destino em Saída/Empréstimo
  if (['loan', 'exit'].includes(movement_type) && !destination_unit_id) {
    return res.status(400).json({ message: 'Para empréstimo ou saída, a unidade de destino é obrigatória.' });
  }
  
  let deliveryStatusForInsert = null;
  if (['exit', 'loan'].includes(movement_type)) {
    deliveryStatusForInsert = 'pending_confirmation';
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const newMovementResult = await client.query(
      `INSERT INTO asset_movements (
         movement_type, responsible_user_id, recipient_person_id, purpose, 
         expected_return_date, notes, destination_unit_id, 
         request_channel_type, request_channel_details, delivery_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        movement_type, responsible_user_id, recipient_person_id || null, purpose || null,
        expected_return_date || null, notes || null, destination_unit_id || null,
        request_channel_type || null, request_channel_details || null,
        deliveryStatusForInsert
      ]
    );
    const newMovementId = newMovementResult.rows[0].id;

    let newAssetStatus;

    for (const asset_id of asset_ids) {
      const assetResult = await client.query('SELECT status FROM assets WHERE id = $1', [asset_id]);
      if (assetResult.rows.length === 0) throw new Error(`Ativo com ID ${asset_id} não encontrado.`);
      const currentAssetStatus = assetResult.rows[0].status;
      newAssetStatus = currentAssetStatus;

      switch (movement_type) {
        case 'entry':
          newAssetStatus = 'available';
          await client.query(
            `UPDATE assets SET status = $1, current_unit_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_unit_id || null, asset_id]
          );
          break;
        case 'exit':
          if (currentAssetStatus !== 'available') throw new Error(`Ativo ${asset_id} não pode ter saída. Status atual: ${currentAssetStatus}.`);
          newAssetStatus = 'in_use';
          await client.query(
            `UPDATE assets SET status = $1, current_unit_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_unit_id || null, asset_id]
          );
          break;
        case 'loan':
          if (currentAssetStatus !== 'available') throw new Error(`Ativo ${asset_id} não pode ser emprestado. Status atual: ${currentAssetStatus}.`);
          if (!expected_return_date) throw new Error('Data de devolução esperada é obrigatória para empréstimos.');
          newAssetStatus = 'loaned';
          await client.query(
            `UPDATE assets SET status = $1, current_unit_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_unit_id || null, asset_id]
          );
          break;
        case 'return':
          if (!['loaned', 'in_use', 'maintenance'].includes(currentAssetStatus)) throw new Error(`Ativo ${asset_id} não pode ser devolvido. Status atual: ${currentAssetStatus}.`);
          newAssetStatus = 'available';

          // Verifica se a última movimentação de saída/empréstimo teve a entrega confirmada
          const lastOutgoingMovementResult = await client.query(
            `SELECT am.delivery_status
             FROM asset_movements am
             JOIN movement_assets ma ON am.id = ma.movement_id
             WHERE ma.asset_id = $1 AND am.movement_type IN ('exit', 'loan')
             ORDER BY am.movement_date DESC, am.id DESC
             LIMIT 1`,
            [asset_id]
          );

          if (lastOutgoingMovementResult.rows.length > 0 && lastOutgoingMovementResult.rows[0].delivery_status === 'pending_confirmation') {
            const assetInfo = await client.query('SELECT patrimonio_number FROM assets WHERE id = $1', [asset_id]);
            const patrimonio = assetInfo.rows[0]?.patrimonio_number || `ID ${asset_id}`;
            throw new Error(`O ativo (${patrimonio}) não pode ser devolvido pois sua entrega ainda está pendente de confirmação.`);
          }
          
          const infraUnitResult = await client.query(
            `SELECT id FROM units WHERE name = 'Almoxarifado - CETEC' LIMIT 1`
          );
          if (infraUnitResult.rows.length === 0) {
            throw new Error("Unidade padrão de devolução ('Almoxarifado - CETEC') não encontrada.");
          }
          const infraUnitId = infraUnitResult.rows[0].id;

          await client.query(
            `UPDATE assets SET status = $1, current_unit_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, infraUnitId, asset_id]
          );
          break;
        case 'maintenance':
          if (['retired', 'disposed'].includes(currentAssetStatus)) throw new Error(`Ativo ${asset_id} não pode ir para manutenção. Status atual: ${currentAssetStatus}.`);
          newAssetStatus = 'maintenance';
          await client.query(
            `UPDATE assets SET status = $1, current_unit_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newAssetStatus, req.body.destination_unit_id || null, asset_id]
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

    // SEÇÃO 1: Processa a SAÍDA de periféricos (para 'exit', 'loan', etc.)
    if (peripherals && Array.isArray(peripherals) && peripherals.length > 0) {
      for (const peripheral of peripherals) {
        await client.query(
          `INSERT INTO movement_peripherals (movement_id, peripheral_type, quantity, status) 
           VALUES ($1, $2, 1, 'out')`,
          [newMovementId, peripheral]
        );
      }
    }

    // SEÇÃO 2 (NOVA): Processa a DEVOLUÇÃO de periféricos (apenas para 'return')
    if (movement_type === 'return' && returned_peripherals && Array.isArray(returned_peripherals) && returned_peripherals.length > 0) {
      // Para cada periférico devolvido, criamos um novo registro com status 'in'
      for (const peripheral of returned_peripherals) {
         await client.query(
            `INSERT INTO movement_peripherals (movement_id, peripheral_type, quantity, status) 
             VALUES ($1, $2, $3, 'in')`,
            [newMovementId, peripheral.peripheral_type, peripheral.quantity]
        );
      }
    }

    await client.query('COMMIT'); // Confirma a transação
    await logAudit(responsible_user_id, `create_movement_${movement_type}`, 'asset_movement', newMovementId, { asset_ids, peripherals, movement_type, new_status: newAssetStatus }, ipAddress);
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

// >>> NOVA ROTA PARA DESCARTAR UM ATIVO <<<

app.put('/api/assets/:id/dispose', authenticateToken, authorizePermission('ACTION_DELETE'), async (req, res) => {
  const { id } = req.params;
  const { disposal_note } = req.body; // Nota de descarte
  const ipAddress = req.ip;

  if (!disposal_note) {
    return res.status(400).json({ message: 'A nota de descarte é obrigatória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assetResult = await client.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (assetResult.rows.length === 0) {
      throw new Error('Ativo não encontrado.');
    }
    const asset = assetResult.rows[0];

    // Regra de negócio: Só pode descartar ativos já baixados ('retired')
    if (asset.status !== 'retired') {
      throw new Error(`Apenas ativos com status 'Baixado' podem ser descartados. Status atual: ${asset.status}.`);
    }

    const finalNote = `\n[DESCARTADO EM ${new Date().toLocaleDateString('pt-BR')}]: ${disposal_note}`;
    const updatedNotes = (asset.notes || '') + finalNote;

    const updatedAsset = await client.query(
      `UPDATE assets SET status = 'disposed', notes = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [updatedNotes, id]
    );

    await client.query('COMMIT');

    await logAudit(req.user.id, 'dispose_asset', 'asset', id, { disposal_note, old_status: asset.status }, ipAddress);
    res.status(200).json({ message: 'Ativo descartado com sucesso!', asset: updatedAsset.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Erro ao descartar o ativo ${id}:`, error);
    res.status(500).json({ message: `Erro ao descartar o ativo: ${error.message}` });
  } finally {
    client.release();
  }
});

// >>> NOVA ROTA PARA DAR BAIXA EM UM ATIVO <<<

app.put('/api/assets/:id/retire', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // Motivo da baixa
  const ipAddress = req.ip;

  if (!reason) {
    return res.status(400).json({ message: 'O motivo da baixa é obrigatório.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Busca o ativo para validar seu status
    const assetResult = await client.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (assetResult.rows.length === 0) {
      throw new Error('Ativo não encontrado.');
    }
    const asset = assetResult.rows[0];

    // Aplica a regra de negócio
    if (!['available', 'maintenance'].includes(asset.status)) {
      throw new Error(`Ativos com status '${asset.status}' não podem ser baixados. É necessário primeiro registrar a devolução.`);
    }

    const retirementNote = `\n[BAIXADO EM ${new Date().toLocaleDateString('pt-BR')}]: ${reason}`;
    const updatedNotes = (asset.notes || '') + retirementNote;

    // Atualiza o status e as notas do ativo
    const updatedAsset = await client.query(
      `UPDATE assets SET status = 'retired', notes = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [updatedNotes, id]
    );

    await client.query('COMMIT');

    await logAudit(req.user.id, 'retire_asset', 'asset', id, { reason, old_status: asset.status }, ipAddress);
    res.status(200).json({ message: 'Ativo baixado com sucesso!', asset: updatedAsset.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Erro ao dar baixa no ativo ${id}:`, error);
    res.status(500).json({ message: `Erro ao dar baixa no ativo: ${error.message}` });
  } finally {
    client.release();
  }
});

// ROTA PARA SUBSTITUIÇÃO DE ATIVOS

app.post('/api/asset-movements/substitute', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  // A rota agora espera arrays de IDs e uma lista de periféricos
  const { oldAssetIds, newAssetIds, reason, peripherals } = req.body;
  const responsibleUserId = req.user.id;
  const ipAddress = req.ip;

  if (!oldAssetIds || !Array.isArray(oldAssetIds) || oldAssetIds.length === 0 || 
      !newAssetIds || !Array.isArray(newAssetIds) || newAssetIds.length === 0) {
    return res.status(400).json({ message: 'É necessário fornecer uma lista de ativos antigos e novos para a substituição.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- ETAPA 1: BUSCAR E VALIDAR TODOS OS DADOS ---
    
    // Busca a movimentação original baseada no primeiro ativo antigo para obter o contexto
    const lastMovementRes = await client.query(
      `SELECT recipient_person_id, destination_unit_id, movement_type, expected_return_date
       FROM asset_movements
       WHERE id IN (SELECT movement_id FROM movement_assets WHERE asset_id = $1)
       AND movement_type IN ('exit', 'loan')
       ORDER BY movement_date DESC, id DESC LIMIT 1`, [oldAssetIds[0]]
    );

    if (lastMovementRes.rows.length === 0) {
      throw new Error('Não foi possível encontrar a movimentação de saída original do ativo antigo.');
    }
    const { recipient_person_id, destination_unit_id, movement_type: originalMovementType, expected_return_date: originalReturnDate } = lastMovementRes.rows[0];

    const warehouseUnitRes = await client.query(`SELECT id FROM units WHERE name ILIKE '%Almoxarifado%' LIMIT 1`);
    const warehouseUnitId = warehouseUnitRes.rows.length > 0 ? warehouseUnitRes.rows[0].id : null;
    if (!warehouseUnitId) throw new Error('Unidade "Almoxarifado" não encontrada para devolução.');

    // --- ETAPA 2: PROCESSAR A DEVOLUÇÃO DE MÚLTIPLOS ATIVOS ANTIGOS ---
    
    const returnNote = `Devolvido como parte de um processo de substituição. Motivo: ${reason || 'Não especificado.'}`;
    const returnMovementRes = await client.query(
      `INSERT INTO asset_movements (movement_type, responsible_user_id, recipient_person_id, destination_unit_id, notes, delivery_status)
       VALUES ('return', $1, $2, $3, $4, 'confirmed') RETURNING id`,
      [responsibleUserId, recipient_person_id, warehouseUnitId, returnNote]
    );
    const returnMovementId = returnMovementRes.rows[0].id;

    for (const oldAssetId of oldAssetIds) {
      // Valida cada ativo antigo
      const oldAssetRes = await client.query('SELECT status FROM assets WHERE id = $1', [oldAssetId]);
      if (oldAssetRes.rows.length === 0 || !['loaned', 'in_use'].includes(oldAssetRes.rows[0].status)) {
        throw new Error(`Ativo antigo (ID: ${oldAssetId}) não está em um estado válido para devolução.`);
      }
      // Atualiza o status e vincula à movimentação de devolução
      await client.query('UPDATE assets SET status = $1, current_unit_id = $2 WHERE id = $3', ['available', warehouseUnitId, oldAssetId]);
      await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [returnMovementId, oldAssetId]);
    }
    
    // --- ETAPA 3: PROCESSAR A SAÍDA DE MÚLTIPLOS ATIVOS NOVOS ---

    const exitNote = `Entregue em substituição. Motivo: ${reason || 'Não especificado.'}`;
    const newAssetStatus = (originalMovementType === 'loan') ? 'loaned' : 'in_use';

    const exitMovementRes = await client.query(
      `INSERT INTO asset_movements (movement_type, responsible_user_id, recipient_person_id, destination_unit_id, notes, delivery_status, expected_return_date)
       VALUES ($1, $2, $3, $4, $5, 'pending_confirmation', $6) RETURNING id`,
      [originalMovementType, responsibleUserId, recipient_person_id, destination_unit_id, exitNote, originalReturnDate]
    );
    const exitMovementId = exitMovementRes.rows[0].id;

    for (const newAssetId of newAssetIds) {
      // Valida cada ativo novo
      const newAssetRes = await client.query('SELECT status FROM assets WHERE id = $1', [newAssetId]);
      if (newAssetRes.rows.length === 0 || newAssetRes.rows[0].status !== 'available') {
        throw new Error(`Ativo novo (ID: ${newAssetId}) não está disponível para saída.`);
      }
      // Atualiza o status e vincula à nova movimentação de saída
      await client.query('UPDATE assets SET status = $1, current_unit_id = $2 WHERE id = $3', [newAssetStatus, destination_unit_id, newAssetId]);
      await client.query('INSERT INTO movement_assets (movement_id, asset_id) VALUES ($1, $2)', [exitMovementId, newAssetId]);
    }

    // Processa os novos periféricos, se houver
    if (peripherals && Array.isArray(peripherals) && peripherals.length > 0) {
        for (const peripheral of peripherals) {
            await client.query(
                `INSERT INTO movement_peripherals (movement_id, peripheral_type, quantity, status) 
                 VALUES ($1, $2, 1, 'out')`,
                [exitMovementId, peripheral]
            );
        }
    }
    
    await client.query('COMMIT');

    await logAudit(responsibleUserId, 'asset_kit_substitution', 'asset_movement', exitMovementId, { oldAssetIds, newAssetIds, returnMovementId }, ipAddress);
    res.status(201).json({ message: 'Substituição de kit realizada com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao realizar substituição de kit de ativos:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: `Erro na substituição: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// >>> NOVA ROTA PARA BUSCAR ATIVOS EM USO <<<

app.get('/api/asset-movements/in-use-assets', authenticateToken, async (req, res) => {
  // A query agora inclui um JOIN com item_types para buscar o nome do tipo
  const query = `
    WITH LatestExitMovement AS (
      -- Para cada ativo que está "em uso", encontra o ID da sua movimentação de saída mais recente
      SELECT
        a.id as asset_id,
        (SELECT ma.movement_id
         FROM movement_assets ma
         JOIN asset_movements am_inner ON ma.movement_id = am_inner.id
         WHERE ma.asset_id = a.id AND am_inner.movement_type = 'exit'
         ORDER BY am_inner.created_at DESC, am_inner.id DESC
         LIMIT 1) as latest_movement_id
      FROM assets a
      WHERE a.status = 'in_use'
    )
    -- Agora, busca os detalhes completos usando os IDs encontrados
    SELECT
      am.id, am.movement_type, am.movement_date, am.delivery_status,
      p.full_name as recipient_display_name,
      a.id as asset_id, a.patrimonio_number, a.brand, a.model,
      it.name as item_type_name
    FROM asset_movements am
    JOIN people p ON am.recipient_person_id = p.id
    -- Junta os resultados para agrupar pela movimentação correta
    JOIN LatestExitMovement lem ON am.id = lem.latest_movement_id
    JOIN assets a ON lem.asset_id = a.id
    JOIN item_types it ON a.item_type_id = it.id
    ORDER BY am.movement_date DESC;
  `;

  try {
    const result = await pool.query(query);
    // Agrupamos os ativos por movimentação para a resposta
    const movements = result.rows.reduce((acc, row) => {
      let movement = acc.find(m => m.id === row.id);
      if (!movement) {
        movement = {
          id: row.id,
          movement_type: row.movement_type,
          movement_date: row.movement_date,
          delivery_status: row.delivery_status, // Adicionado para consistência
          recipient_display_name: row.recipient_display_name,
          assets: []
        };
        acc.push(movement);
      }
      movement.assets.push({
        id: row.asset_id,
        patrimonio_number: row.patrimonio_number,
        brand: row.brand,
        model: row.model,
        item_type_name: row.item_type_name // <<< CAMPO ADICIONADO AQUI
      });
      return acc;
    }, []);

    res.status(200).json(movements);
  } catch (error) {
    console.error('Erro ao buscar ativos em uso:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA CONFIRMAR A ENTREGA DE UMA MOVIMENTAÇÃO
app.post('/api/asset-movements/:id/confirm-delivery', 
    fetchMovementDetailsForUpload,     // 1º: Busca os detalhes para o nome do arquivo
    upload.single('receiptFile'),      // 2º: Processa o upload do arquivo
    authenticateToken,                 // 3º: Autentica o token (agora que a requisição foi processada)
    authorizePermission('ACTION_CREATE_EDIT'), // 4º: Autoriza a permissão
    async (req, res) => {              // 5º: Executa a lógica final
  const { id } = req.params;
  const { actual_delivery_date } = req.body;
  const ipAddress = req.ip;

  // 1. Validação da requisição
  if (!req.file) {
    return res.status(400).json({ message: 'O arquivo do recibo é obrigatório.' });
  }
  if (!actual_delivery_date) {
    // Se a data não for enviada, deleta o arquivo que foi salvo para não deixar lixo no servidor
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'A data de entrega efetiva é obrigatória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Busca a movimentação e verifica seu estado atual
    const movementResult = await client.query('SELECT * FROM asset_movements WHERE id = $1', [id]);
    if (movementResult.rows.length === 0) {
      throw new Error('Movimentação não encontrada.');
    }

    const movement = movementResult.rows[0];
    if (movement.delivery_status === 'confirmed') {
      throw new Error('Esta entrega já foi confirmada anteriormente.');
    }
    if (movement.delivery_status !== 'pending_confirmation') {
        throw new Error(`Apenas movimentações com status 'pending_confirmation' podem ser confirmadas. Status atual: ${movement.delivery_status}`);
    }

    // 3. Atualiza o banco de dados com as novas informações
    await client.query(
      `UPDATE asset_movements 
       SET delivery_status = 'confirmed', actual_delivery_date = $1, receipt_path = $2 
       WHERE id = $3`,
      [actual_delivery_date, req.file.path, id]
    );

    await client.query('COMMIT');

    // 4. Loga a auditoria e envia a resposta de sucesso
    await logAudit(req.user.id, 'confirm_delivery', 'asset_movement', id, { receipt_path: req.file.path }, ipAddress);
    res.status(200).json({ message: 'Entrega confirmada com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    // Se deu erro, remove o arquivo que foi feito upload
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    console.error('Erro ao confirmar entrega:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    await logAudit(req.user.id, 'confirm_delivery_error', 'asset_movement', id, { error: errorMessage }, ipAddress);
    res.status(500).json({ message: `Erro ao confirmar entrega: ${errorMessage}` });
  } finally {
    client.release();
  }
});

// >>> NOVA ROTA PARA RENOVAÇÃO DE EMPRÉSTIMO <<<

app.put('/api/asset-movements/:id/renew', authenticateToken, authorizePermission('ACTION_CREATE_EDIT'), async (req, res) => {
  const { id } = req.params;
  const { new_expected_return_date, renewal_note } = req.body;
  const ipAddress = req.ip;

  if (!new_expected_return_date) {
    return res.status(400).json({ message: 'A nova data de devolução é obrigatória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Busca a movimentação original para validar e obter dados antigos
    const movementResult = await client.query('SELECT * FROM asset_movements WHERE id = $1', [id]);
    if (movementResult.rows.length === 0) {
      throw new Error('Movimentação não encontrada.');
    }
    const movement = movementResult.rows[0];

    // 2. Valida se é um empréstimo
    if (movement.movement_type !== 'loan') {
      throw new Error('Apenas movimentações do tipo "empréstimo" podem ser renovadas.');
    }
    
    // 3. Prepara a nova nota, mantendo o histórico
    const oldDate = new Date(movement.expected_return_date).toLocaleDateString('pt-BR');
    const renewalLog = `\n[RENOVADO EM ${new Date().toLocaleDateString('pt-BR')}]: Vencimento alterado de ${oldDate} para ${new Date(new_expected_return_date).toLocaleDateString('pt-BR')}. Motivo: ${renewal_note || 'N/A'}.`;
    const updatedNotes = (movement.notes || '') + renewalLog;

    // 4. Atualiza o registro no banco de dados
    await client.query(
      `UPDATE asset_movements 
       SET expected_return_date = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [new_expected_return_date, updatedNotes, id]
    );

    await client.query('COMMIT');

    await logAudit(req.user.id, 'renew_loan', 'asset_movement', id, { new_expected_return_date, renewal_note }, ipAddress);
    res.status(200).json({ message: 'Empréstimo renovado com sucesso!' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao renovar empréstimo:', error);
    res.status(500).json({ message: `Erro ao renovar empréstimo: ${error.message}` });
  } finally {
    client.release();
  }
});

// >>> ROTA PARA BUSCAR EMPRÉSTIMOS ATIVOS <<<

app.get('/api/asset-movements/active-loans', authenticateToken, async (req, res) => {
  const { solicitante } = req.query;

  try {
    // ESTA NOVA QUERY É MAIS SIMPLES E ROBUSTA
    const query = `
      WITH CurrentLoanedAssets AS (
        -- 1. Encontra todos os ativos que estão de fato emprestados
        SELECT
          a.id as asset_id,
          -- 2. Para cada um, encontra o ID da sua última movimentação de empréstimo
          (SELECT ma.movement_id
           FROM movement_assets ma
           JOIN asset_movements am_inner ON ma.movement_id = am_inner.id
           WHERE ma.asset_id = a.id AND am_inner.movement_type = 'loan'
           ORDER BY am_inner.movement_date DESC, am_inner.id DESC
           LIMIT 1) as latest_loan_movement_id
        FROM assets a
        WHERE a.status = 'loaned'
      )
      -- 3. Agrupa os ativos pela movimentação encontrada
      SELECT
        am.id,
        am.movement_type,
        am.movement_date,
        am.expected_return_date,
        am.delivery_status,
        p.full_name as recipient_display_name,
        p.id as recipient_person_id,
        -- Agrega os detalhes dos ativos em um array JSON
        json_agg(
          json_build_object(
            'id', cla.asset_id,
            'patrimonio_number', a.patrimonio_number,
            'item_type_name', it.name,
            'brand', a.brand,
            'model', a.model
          )
        ) as assets
      FROM asset_movements am
      JOIN people p ON am.recipient_person_id = p.id
      JOIN CurrentLoanedAssets cla ON am.id = cla.latest_loan_movement_id
      JOIN assets a ON cla.asset_id = a.id
      JOIN item_types it ON a.item_type_id = it.id
      WHERE ($1::text IS NULL OR p.full_name ILIKE $1)
      GROUP BY am.id, p.full_name, p.id
      ORDER BY am.expected_return_date ASC;
    `;
    
    const params = [solicitante ? `%${solicitante}%` : null];
    const result = await pool.query(query, params);
    
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erro ao buscar empréstimos ativos:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ROTA PARA BUSCAR MOVIMENTAÇÕES COM ENTREGA PENDENTE
app.get('/api/asset-movements/pending-delivery', authenticateToken, async (req, res) => {
  const { solicitante, patrimonio } = req.query;
  let query = `
    SELECT
      am.id, am.movement_type, am.movement_date,
      p.full_name as recipient_display_name
    FROM asset_movements am
    LEFT JOIN people p ON am.recipient_person_id = p.id
    WHERE am.delivery_status = 'pending_confirmation'
      AND am.movement_type IN ('exit', 'loan')
  `;
  const params = [];

  if (solicitante) {
    params.push(`%${solicitante}%`);
    query += ` AND p.full_name ILIKE $${params.length}`;
  }
  
  if (patrimonio) {
    query += ` AND EXISTS (
      SELECT 1 FROM movement_assets ma
      JOIN assets a ON ma.asset_id = a.id
      WHERE ma.movement_id = am.id AND a.patrimonio_number = $${params.length + 1}
    )`;
    params.push(patrimonio);
  }

  query += ' ORDER BY am.movement_date DESC';

  try {
    const result = await pool.query(query, params);
    // Para cada movimentação, busca os ativos associados
    const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
        const assetsResult = await pool.query(
          `SELECT a. id, a.sku, a.patrimonio_number, a.brand, a.model FROM movement_assets ma JOIN assets a ON ma.asset_id = a.id WHERE ma.movement_id = $1`,
          [movement.id]
        );
        return { ...movement, assets: assetsResult.rows };
      }));
    res.status(200).json(movementsWithAssets);
  } catch (error) {
    console.error('Erro ao buscar movimentações pendentes:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// >>> NOVA ROTA PARA BUSCAR MOVIMENTAÇÕES POR PESSOA <<<

app.get('/api/asset-movements/by-person/:personId', authenticateToken, async (req, res) => {
  const { personId } = req.params;
  // Filtros de data opcionais
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT
        am.id,
        am.movement_date,
        am.movement_type,
        am.delivery_status,
        u.full_name AS responsible_full_name
      FROM asset_movements am
      JOIN users u ON am.responsible_user_id = u.id
      WHERE am.recipient_person_id = $1
    `;
    const params = [personId];

    if (startDate) {
      params.push(startDate);
      query += ` AND am.movement_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND am.movement_date <= $${params.length}`;
    }

    query += ' ORDER BY am.movement_date DESC, am.id DESC';

    const result = await pool.query(query, params);

    // Para cada movimentação, buscar os ativos associados
    const movementsWithAssets = await Promise.all(result.rows.map(async (movement) => {
      const assetsResult = await pool.query(
        `SELECT a.id, a.patrimonio_number, a.brand, a.model, a.sku 
         FROM movement_assets ma 
         JOIN assets a ON ma.asset_id = a.id 
         WHERE ma.movement_id = $1`,
        [movement.id]
      );
      return { ...movement, assets: assetsResult.rows };
    }));

    res.status(200).json(movementsWithAssets);

  } catch (error) {
    console.error(`Erro ao buscar movimentações da pessoa ${personId}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Arquivo: backend/src/server.js

// >>> NOVA ROTA PARA BUSCAR MOVIMENTAÇÕES POR ATIVO <<<

app.get('/api/asset-movements/by-asset/:assetId', authenticateToken, async (req, res) => {
  const { assetId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT
        am.id,
        am.movement_date,
        am.movement_type,
        am.delivery_status,
        u.full_name AS responsible_full_name,
        p.full_name AS recipient_display_name
      FROM asset_movements am
      JOIN movement_assets ma ON am.id = ma.movement_id
      JOIN users u ON am.responsible_user_id = u.id
      LEFT JOIN people p ON am.recipient_person_id = p.id
      WHERE ma.asset_id = $1
    `;
    const params = [assetId];

    if (startDate) {
      params.push(startDate);
      query += ` AND am.movement_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND am.movement_date <= $${params.length}`;
    }

    query += ' ORDER BY am.movement_date ASC, am.id ASC'; // Ordem cronológica ascendente

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);

  } catch (error) {
    console.error(`Erro ao buscar movimentações do ativo ${assetId}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});



// >>> ENDPOINT DE LISTAR MOVIMENTAÇÕES  <<<
app.get('/api/asset-movements', authenticateToken, async (req, res) => {
  try {
    const movements = await getFilteredMovements(req.query);
    res.status(200).json(movements);
  } catch (error) {
    console.error('Erro ao listar movimentações de ativos:', error);
    await logAudit(req.user.id, 'list_movements_error', 'asset_movement', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar movimentações.' });
  }
});

// >>> NOVO ENDPOINT DE RELATÓRIO <<<

app.post('/api/reports/movements/pdf', authenticateToken, async (req, res) => {
  try {
    // A rota usa o CORPO da requisição (req.body) para os filtros
    const movements = await getFilteredMovements(req.body);

    if (movements.length === 0) {
      return res.status(404).json({ message: 'Nenhuma movimentação encontrada com os filtros especificados.' });
    }

    // Tradução dos tipos de movimentação para o relatório
    const translateMovementTypeForPDF = (type) => ({
      'entry': 'Entrada', 'exit': 'Saída', 'loan': 'Empréstimo', 'return': 'Devolução', 'maintenance': 'Manutenção'
    }[type] || type);

    const bodyData = movements.map(m => [
      m.assets.map(a => a.patrimonio_number || a.sku).join(', '),
      translateMovementTypeForPDF(m.movement_type),
      new Date(m.movement_date).toLocaleDateString('pt-BR'),
      m.responsible_full_name,
      m.recipient_display_name || 'N/A'
    ]);

    const docDefinition = {
      content: [
        { text: 'Relatório de Movimentações Filtrado', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              ['Ativos (Patrimônio)', 'Tipo', 'Data', 'Responsável', 'Solicitante'].map(h => ({ text: h, style: 'tableHeader' })),
              ...bodyData
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: { header: { fontSize: 18, bold: true }, tableHeader: { bold: true, fontSize: 10, color: 'black' }, footer: { fontSize: 10, italics: true } },
      defaultStyle: { font: 'Roboto', fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf');
      res.attachment('relatorio_movimentacoes.pdf');
      res.send(Buffer.concat(chunks));
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error('Erro ao gerar relatório de movimentações:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// --- RELATÓRIOS DE EMPRÉSTIMOS VENCIDOS ---

const getOverdueLoansData = async () => {
  // Query robusta que primeiro encontra as MOVIMENTAÇÕES de empréstimo realmente ativas e depois filtra as vencidas.
  const query = `
    SELECT
      am.id as movement_id,
      am.expected_return_date,
      am.movement_date AS loan_date,
      p.full_name AS recipient_name,
      p.cpf AS recipient_cpf,
      p.email AS recipient_email,
      u.name AS unit_name
    FROM asset_movements am
    JOIN people p ON am.recipient_person_id = p.id
    LEFT JOIN units u ON am.destination_unit_id = u.id
    WHERE am.movement_type = 'loan'
      AND am.expected_return_date < CURRENT_DATE
      AND NOT EXISTS ( -- Garante que não existe uma devolução posterior para os ativos deste empréstimo
        SELECT 1
        FROM asset_movements am_return
        JOIN movement_assets ma_return ON am_return.id = ma_return.movement_id
        WHERE am_return.movement_type = 'return'
          AND ma_return.asset_id IN (SELECT asset_id FROM movement_assets WHERE movement_id = am.id)
          AND am_return.created_at > am.created_at
      );
  `;
  const movementsResult = await pool.query(query);
  if (movementsResult.rows.length === 0) {
    return [];
  }

  // Para cada movimentação vencida, buscamos TODOS os seus ativos
  const fullReportData = await Promise.all(movementsResult.rows.map(async (movement) => {
    const assetsResult = await pool.query(
      `SELECT patrimonio_number FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       WHERE ma.movement_id = $1`,
      [movement.movement_id]
    );
    
    const expectedDate = new Date(movement.expected_return_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expectedDate.setHours(0, 0, 0, 0);
    const diffTime = today - expectedDate;
    const overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      ...movement,
      assets: assetsResult.rows, // Array de ativos
      overdue_days: overdue_days > 0 ? overdue_days : 0 // Garante que não haja dias negativos
    };
  }));

  return fullReportData;
};

// Rota para PDF (com as novas colunas)

// server.js -> SUBSTITUA A ROTA DE PDF DE VENCIDOS PELA VERSÃO ABAIXO

app.get('/api/reports/overdue-loans/pdf', authenticateToken, async (req, res) => {
  const ipAddress = req.ip;
  try {
    const reportData = await getOverdueLoansData();
    
    // Carrega a imagem do brasão para o PDF
    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    if (reportData.length === 0) {
      const docDefinitionEmpty = { 
        content: [{ text: 'Nenhum empréstimo vencido encontrado no momento.', style: 'header', alignment: 'center' }],
        styles: { header: { fontSize: 18, bold: true, font: 'Roboto' } }
      };
      const pdfDocEmpty = printer.createPdfKitDocument(docDefinitionEmpty);
      res.header('Content-Type', 'application/pdf');
      pdfDocEmpty.pipe(res);
      pdfDocEmpty.end();
      return;
    }

    const bodyData = reportData.map(item => [
      item.recipient_name || 'N/A',
      item.assets.map(a => a.patrimonio_number).join(', ') || 'N/A',
      item.unit_name || 'N/A',
      new Date(item.expected_return_date).toLocaleDateString('pt-BR'),
      { text: `${item.overdue_days} dia(s)`, bold: true, color: 'red' } // Destaca o atraso
    ]);

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [ 40, 100, 40, 60 ],
      
      header: {
        columns: [
          { image: `data:image/png;base64,${logoBase64}`, width: 70, margin: [40, 20, 10, 0] },
          {
            stack: [
              'PREFEITURA DO RECIFE',
              'SECRETARIA DE EDUCAÇÃO',
              'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA'
            ],
            style: 'headerText',
            margin: [10, 30, 40, 0]
          }
        ]
      },
      
      footer: {
        stack: [
          { text: 'Sistema de Gestão de Ativos - SGA', alignment: 'center' },
          { text: 'Av. Oliveira Lima, 824 - Soledade | FONE: 3355-5471', alignment: 'center', fontSize: 8 },
        ],
        style: 'footer'
      },

      content: [
          { text: 'Relatório de Empréstimos Vencidos', style: 'docTitle', alignment: 'center' },
          { text: `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, style: 'body', alignment: 'right', margin: [0, 0, 0, 20] },
          {
              table: {
                  headerRows: 1,
                  widths: ['*', 'auto', '*', 'auto', 'auto'],
                  body: [
                      ['Solicitante', 'Patrimônio(s)', 'Unidade', 'Vencimento', 'Atraso'].map(h => ({ text: h, style: 'tableHeader' })),
                      ...bodyData
                  ]
              },
              layout: 'lightHorizontalLines'
          },
          { text: `\nTotal de Empréstimos Vencidos: ${reportData.length}`, alignment: 'right', style: 'body', bold: true }
      ],
      styles: {
        headerText: { fontSize: 9, bold: true, alignment: 'center', color: '#333' },
        docTitle: { fontSize: 18, bold: true, margin: [0, 20, 0, 20] },
        tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#ffc107' },
        body: { fontSize: 9 },
        footer: { fontSize: 8, color: 'gray', margin: [40, 10, 40, 0] }
      },
      defaultStyle: { font: 'Roboto' }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => { 
      res.header('Content-Type', 'application/pdf').attachment('relatorio_emprestimos_vencidos.pdf').send(Buffer.concat(chunks));
      logAudit(req.user.id, 'generate_report', 'overdue_loans_report_pdf', null, { count: reportData.length }, ipAddress);
    });
    pdfDoc.end();
  } catch (error) { 
      console.error("Erro ao gerar relatório de vencidos:", error);
      res.status(500).json({ message: 'Erro ao gerar relatório PDF.' }); 
  }
});

// Rota para CSV (com as novas colunas)
app.get('/api/reports/overdue-loans/csv', authenticateToken, async (req, res) => {
  try {
    const overdueAssets = await getOverdueLoansData();
    if (overdueAssets.length === 0) return res.status(404).json({ message: 'Nenhum empréstimo vencido encontrado.' });

    const headers = ['Solicitante', 'CPF', 'Email', 'Telefone da Unidade', 'Nome da Unidade', 'Tipo da Unidade', 'Patrimônio', 'Ativo', 'Data do Empréstimo', 'Vencimento', 'Dias de Atraso'];
    const csvRows = [headers.join(';')];

    for (const item of overdueAssets) {
      const row = [
        item.recipient_name,
        item.recipient_cpf,
        item.recipient_email,
        item.unit_phone,
        item.unit_name,
        item.unit_type,
        item.patrimonio_number,
        `${item.brand} ${item.model}`,
        new Date(item.loan_date).toLocaleDateString('pt-BR'),
        new Date(item.expected_return_date).toLocaleDateString('pt-BR'),
        item.overdue_days
      ];
      csvRows.push(row.map(field => `"${field || ''}"`).join(';'));
    }
    res.header('Content-Type', 'text/csv; charset=utf-8').attachment('relatorio_vencidos.csv').send(csvRows.join('\n'));
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório CSV.' }); }
});

// Rota para XLSX (com as novas colunas)
app.get('/api/reports/overdue-loans/xlsx', authenticateToken, async (req, res) => {
  try {
    const overdueAssets = await getOverdueLoansData();
    if (overdueAssets.length === 0) return res.status(404).json({ message: 'Nenhum empréstimo vencido encontrado.' });

    const dataForSheet = overdueAssets.map(item => ({
      'Solicitante': item.recipient_name,
      'CPF': item.recipient_cpf,
      'Email Solicitante': item.recipient_email,
      'Telefone da Unidade': item.unit_phone,
      'Nome da Unidade': item.unit_name,
      'Tipo da Unidade': item.unit_type,
      'Patrimônio': item.patrimonio_number,
      'Ativo': `${item.brand} ${item.model}`,
      'Data do Empréstimo': new Date(item.loan_date).toLocaleDateString('pt-BR'),
      'Vencimento': new Date(item.expected_return_date).toLocaleDateString('pt-BR'),
      'Dias de Atraso': item.overdue_days
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vencidos');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('relatorio_vencidos.xlsx').send(buffer);
  } catch (error) { res.status(500).json({ message: 'Erro ao gerar relatório XLSX.' }); }
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
         a.id as asset_id,
         a.brand,
         a.model,
         am.id as movement_id,
         am.expected_return_date,
         p.full_name AS recipient_full_name
       FROM asset_movements am
       JOIN movement_assets ma ON am.id = ma.movement_id
       JOIN assets a ON ma.asset_id = a.id
       JOIN people p ON am.recipient_person_id = p.id
       WHERE am.movement_type = 'loan'
         AND a.status = 'loaned'
         AND am.expected_return_date < (CURRENT_DATE + INTERVAL '8 days')
         AND NOT EXISTS (
           SELECT 1 FROM asset_movements am_return
           JOIN movement_assets ma_return ON am_return.id = ma_return.movement_id
           WHERE am_return.movement_type = 'return'
             AND ma_return.asset_id = a.id
             AND am_return.created_at > am.created_at
         )
       ORDER BY am.expected_return_date ASC
       LIMIT 5`
    );
    const pendingAlerts = pendingAlertsResult.rows.map(row => {
        const dueDate = new Date(row.expected_return_date);
        const today = new Date();
        today.setHours(0,0,0,0);
        dueDate.setHours(0,0,0,0);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let message;
        if (diffDays < 0) {
            message = `Devolução de "${row.brand} ${row.model}" está ATRASADA.`
        } else if (diffDays === 0) {
            message = `Devolução de "${row.brand} ${row.model}" vence HOJE.`
        } else {
            message = `Devolução de "${row.brand} ${row.model}" vence em ${diffDays} dia(s).`
        }

        return {
          id: row.movement_id, // Usar o ID da movimentação como chave
          message: message,
          asset: `${row.brand} ${row.model} (com ${row.recipient_full_name || 'N/A'})`,
          dueDate: new Date(row.expected_return_date).toLocaleDateString('pt-BR')
        };
    });


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

// Obter Movimentação por ID (com detalhes completos)

app.get('/api/asset-movements/:id/details', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Busca a movimentação principal (sem alteração)
    const movementResult = await pool.query(
      `SELECT 
         am.*, 
         p.full_name AS recipient_display_name,
         p.id as recipient_person_id
       FROM asset_movements am
       LEFT JOIN people p ON am.recipient_person_id = p.id
       WHERE am.id = $1`,
      [id]
    );

    if (movementResult.rows.length === 0) {
      return res.status(404).json({ message: 'Movimentação não encontrada.' });
    }
    const movement = movementResult.rows[0];

    // Busca os ativos associados (sem alteração)
    const assetsResult = await pool.query(
      `SELECT a.id, a.brand, a.model, a.patrimonio_number 
       FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       WHERE ma.movement_id = $1`,
      [id]
    );
    movement.assets = assetsResult.rows;

    // *** CÓDIGO ADICIONADO AQUI ***
    // Busca os periféricos associados a essa movimentação
    const peripheralsResult = await pool.query(
      `SELECT peripheral_type, quantity, status 
       FROM movement_peripherals 
       WHERE movement_id = $1 AND status = 'out'`, // Pega apenas os que saíram
      [id]
    );
    // Adiciona a lista de periféricos ao objeto de movimentação
    movement.peripherals = peripheralsResult.rows;
    // *** FIM DO CÓDIGO ADICIONADO ***

    res.status(200).json(movement);

  } catch (error) {
    console.error(`Erro ao buscar detalhes da movimentação ${id}:`, error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Gerar Recibo PDF 
app.get('/api/asset-movements/:id/receipt-pdf', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;
  try {
    // 1. A query agora busca 'ds.contact_phone' em vez de 'p.contact_phone'
    const movementResult = await pool.query(
      `SELECT
        am.*,
        u.full_name AS responsible_user_full_name,
        p.full_name AS recipient_display_name,
        p.cpf AS recipient_person_cpf,
        p.email AS recipient_person_email,
        p.registration_number AS recipient_person_registration,
        ds.name AS destination_unit_name,
        ds.contact_phone AS destination_unit_phone
      FROM asset_movements am
      JOIN users u ON am.responsible_user_id = u.id
      LEFT JOIN people p ON am.recipient_person_id = p.id
      LEFT JOIN units ds ON am.destination_unit_id = ds.id
      WHERE am.id = $1`,
      [id]
    );

    if (movementResult.rows.length === 0) return res.status(404).json({ message: 'Movimentação não encontrada.' });
    const movement = movementResult.rows[0];

    // 2. Busca todos os ativos associados à movimentação
    const assetsResult = await pool.query(
      `SELECT a.brand, a.model, a.serial_number, a.patrimonio_number, it.name AS item_type_name
       FROM movement_assets ma
       JOIN assets a ON ma.asset_id = a.id
       JOIN item_types it ON a.item_type_id = it.id
       WHERE ma.movement_id = $1`,
      [movement.id]
    );
    const assets = assetsResult.rows;
    if (assets.length === 0) return res.status(404).json({ message: 'Nenhum ativo encontrado.' });
    const peripheralsResult = await pool.query(
        `SELECT peripheral_type, quantity FROM movement_peripherals WHERE movement_id = $1`,
        [id]
    );
    const peripherals = peripheralsResult.rows;

    // 3. Carrega a imagem do brasão para o PDF
    const logoPath = path.join(__dirname, '../assets/brasao-recife.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    // 4. Monta a tabela de equipamentos para o PDF
    const equipmentTableBody = [
      ['QTD', 'EQUIPAMENTO / ACESSÓRIO', 'SÉRIE', 'TOMBO'].map(h => ({ text: h, style: 'tableHeader' }))
    ];
     // Adiciona os ativos principais e seus periféricos associados
    assets.forEach(asset => {
      // Adiciona a linha do ativo principal (em negrito)
      equipmentTableBody.push([
        { text: '1', style: 'tableCell' },
        { text: `${asset.item_type_name} ${asset.brand} ${asset.model}`, style: 'tableCell', bold: true },
        { text: asset.serial_number || 'N/A', style: 'tableCell' },
        { text: asset.patrimonio_number || 'N/A', style: 'tableCell' }
      ]);

      // Se o ativo for um Desktop ou Notebook, procura e adiciona os periféricos abaixo dele
      if (['notebook', 'desktop'].includes(asset.item_type_name.toLowerCase())) {
        peripherals.forEach(p => {
          equipmentTableBody.push([
            { text: p.quantity.toString(), style: 'tableCell' },
            { text: `↳ ${p.peripheral_type}`, style: 'tableCell', italics: true, margin: [10, 0, 0, 0] }, // Adiciona indentação e formatação
            { text: 'N/A', style: 'tableCell' },
            { text: 'N/A', style: 'tableCell' }
          ]);
        });
      }
    });

    // <<< Calcula o total unificado de itens >>>
    const totalPeripherals = peripherals.reduce((sum, p) => sum + p.quantity, 0);
    const totalItems = assets.length + totalPeripherals;

    // LÓGICA PARA CRIAR A OBSERVAÇÃO DINÂMICA >>>
    let observationText = 'Em atendimento à solicitação.'; // Texto padrão
    if (movement.request_channel_type === 'Email') {
      observationText = 'Em atendimento à solicitação via e-mail para a Gerência de Infraestrutura de Tecnologia.';
    } else if (movement.request_channel_type === 'SEI' && movement.request_channel_details) {
      observationText = `Em atendimento à solicitação via processo SEI nº ${movement.request_channel_details}.`;
    } else if (movement.request_channel_type === 'Ordem Direta' && movement.request_channel_details) {
      observationText = `Em atendimento à solicitação por Ordem Direta da Secretaria Executiva, por ${movement.request_channel_details}.`;
    }
    // Se houver notas manuais, elas são adicionadas à observação automática.
    if (movement.notes) {
        observationText += `\nNotas Adicionais: ${movement.notes}`;
    }
    const accessoriesSection = [];
    if (peripherals.length > 0) {
        accessoriesSection.push({ text: 'Acessórios Inclusos:', style: 'body', bold: true, margin: [0, 10, 0, 5] });
        const peripheralList = peripherals.map(p => `${p.quantity}x ${p.peripheral_type}`);
        accessoriesSection.push({
            ul: peripheralList,
            style: 'body',
            margin: [20, 0, 0, 10]
        });
    }

    // 5. Define textos e números formatados
    const isLoan = movement.movement_type === 'loan';
    const docTitle = isLoan ? 'RECIBO DE EMPRÉSTIMO' : 'RECIBO DE ENTREGA';
    const termTitle = isLoan ? '(X) EMPRÉSTIMO' : '(X) ENTREGA';
    const currentYear = new Date().getFullYear();
    const receiptNumber = `${currentYear} / ${movement.id.toString().padStart(6, '0')}`;

    // 6. Estrutura do Documento PDF (seguindo seu modelo)
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [ 40, 100, 40, 60 ], // [esquerda, topo, direita, baixo] - Aumentado o topo para dar espaço ao header
      
      // Ponto 1: Cabeçalho com Logo e Texto
      header: {
        columns: [
          { image: `data:image/png;base64,${logoBase64}`, width: 70, margin: [40, 20, 10, 0] },
          {
            stack: [
              'PREFEITURA DO RECIFE',
              'SECRETARIA DE EDUCAÇÃO',
              'SECRETARIA EXECUTIVA DE PROJETOS, TECNOLOGIA E INOVAÇÃO',
              'GERÊNCIA DE INFRAESTRUTURA DE TECNOLOGIA'
            ],
            style: 'headerText',
            margin: [10, 25, 40, 0]
          }
        ]
      },
      // Definição do Rodapé - Repete em todas as páginas
       footer: {
        stack: [
          { text: 'Gerência de Infraestrutura de Tecnologia' },
          { text: 'Av. Oliveira Lima, 824 - Soledade CEP: 50050-390  |  FONE: 3355-5471' },
        ],
        style: 'footer'
      },

      // Conteúdo principal do documento
      content: [
        // ---------- PÁGINA 1: RECIBO ----------
        { text: docTitle, style: 'docTitle' },
        // Ponto 2 e 3: Número do Recibo centralizado e formatado
        { text: receiptNumber, style: 'receiptNumber' },
        
        { text: `Estamos entregando, por meio da GIT/DIT – Gerência de Infraestrutura de Tecnologia / Divisão de Infraestrutura em Tecnologia, os equipamentos especificados abaixo, para utilização em ${movement.destination_unit_name || 'Unidade não informada'}.`, style: 'body' },
        
        // Ponto 7: Tabela com estilo profissional
        { table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto'], body: equipmentTableBody }, layout: 'lightHorizontalLines', margin: [0, 15, 0, 15] },

        { text: `Total: ${totalItems} item(ns) sendo ${assets.length} ativo(s) com patrimônio.`, style: 'body' },

        //{ text: `Total de itens com patrimônio: ${assets.length}.`, style: 'body' },

        //{ text: `Total: ${assets.length} equipamento(s).`, style: 'body' },
        // Ponto 4: Espaçamento adicionado com a propriedade 'margin'
        { text: `Obs.: ${observationText}`, style: 'body', margin: [0, 10, 0, 20] },
        
        { text: `Recife, ${new Date(movement.movement_date).toLocaleDateString('pt-BR')}.`, alignment: 'right', margin: [0, 20, 0, 40] },
        
        // Ponto 5 e 6: Blocos de Assinatura empilhados (um abaixo do outro)
        {
          stack: [
            { text: 'Responsável pela Liberação:', style: 'signatureLabel' },
            { text: '______________________________________', margin: [0, 20, 0, 5] },
            { text: 'Alberto Dantas', bold: true },
            { text: 'Gerente de Infraestrutura de Tecnologia', style: 'label' },
            { text: 'Matrícula: 123.738-1', style: 'label' }
          ], alignment: 'center', unbreakable: true
        },
        { text: '', margin: [0, 25, 0, 0] }, 
        {
          stack: [
            { text: 'Responsável pelo Recebimento:', style: 'signatureLabel', margin: [0, 25, 0, 0] },
            { text: '______________________________________', margin: [0, 20, 0, 5] },
            { text: movement.recipient_display_name || '________________', bold: true },
            { text: `Matrícula: ${movement.recipient_person_registration || '___________'}`, style: 'label' }
          ], alignment: 'center', unbreakable: true
        },
        { text: `Telefone: ${movement.recipient_person_phone || '___________'}     E-mail: ${movement.recipient_person_email || '___________'}`, style: 'label', margin: [0, 5, 0, 0] },

        // ---------- PÁGINA 2: TERMO DE RESPONSABILIDADE ----------
        { text: '', pageBreak: 'before' },
        { text: 'TERMO DE RESPONSABILIDADE', style: 'docTitle', margin: [0, 50, 0, 20] },
        { text: `Reconheço que recebi o(s) equipamento(s) descrito(s) no recibo constante no verso deste termo, por meio da GIT – Gerência de Infraestrutura de Tecnologia, a título de:`, style: 'body', margin: [0, 15] },
        { text: termTitle, style: 'body', bold: true, margin: [20, 10, 0, 15] },
        {
          ol: [
            'Caso o(s) equipamento(s) não esteja(m) tombado(s), me comprometo em facilitar o acesso do profissional do Setor de Patrimônio às instalações na qual o(s) equipamento(s) se encontrava(m).',
            'Mediante rescisão de contrato, exoneração, aposentadoria ou transferência, comprometo-me a devolver à GIT – Gerência de Infraestrutura de Tecnologia, todos os equipamentos e acessórios que se encontrarem sob minha responsabilidade...',
            { text: ['Comprometo-me a ', { text: 'NÃO', bold: true, decoration: 'underline' }, ' repassar a outra pessoa OU remanejar para outro departamento/setor o(s) equipamento(s) constante(s) neste recibo, sem a prévia autorização da GIT.'] },
            { text: 'Estou ciente que se o(s) equipamento(s) for(em) extraviado(s), furtado(s) ou roubado(s), terei que tomar as providências URGENTES abaixo:',
              ol: [
                'Registrar um Boletim de Ocorrência (B.O.) ... contendo número de TOMBO do patrimônio e número de SÉRIE.',
                'Enviar um ofício citando o ocorrido com cópia anexa do Boletim de Ocorrência para a Gerência de Tecnologia...'
              ],
              margin: [20, 5, 0, 0], type: 'lower-alpha'
            }
          ], style: 'body'
        },
        { text: `Recebido em: ___/___/______`, margin: [0, 40, 0, 0] },
        { text: '_________________________________________________', alignment: 'center', margin: [0, 30, 0, 5] },
        { text: `${movement.recipient_display_name || ''}\nCPF: ${movement.recipient_person_cpf || '___________'}     Matrícula: ${movement.recipient_person_registration || '___________'}`, alignment: 'center', style: 'label', fontSize: 10 }
      ],
      styles: {
        headerText: { fontSize: 9, bold: true, alignment: 'center', color: '#333' },
        docTitle: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 70, 0, 10] }, // Aumentado margin-top
        receiptNumber: { fontSize: 10, alignment: 'center', color: 'gray', margin: [0, 0, 0, 20] },
        body: { fontSize: 10, alignment: 'justify', lineHeight: 1.3 },
        tableHeader: { bold: true, fontSize: 9, color: 'black', fillColor: '#dedede' }, // Fundo cinza para destaque
        label: { fontSize: 8, color: 'gray' },
        signatureLabel: { fontSize: 10, bold: true },
        footer: { fontSize: 8, color: 'gray', alignment: 'center', margin: [0, 10, 0, 20] }

      },
      defaultStyle: { font: 'Roboto' }
    };
    
    // Geração e envio do PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      res.header('Content-Type', 'application/pdf').attachment(`recibo_${movement.movement_type}_${id}.pdf`).send(Buffer.concat(chunks));
    });
    pdfDoc.end();
    await logAudit(req.user.id, 'generate_receipt_pdf', 'asset_movement', movement.id, null, ipAddress);

  } catch (error) {
    console.error('Erro ao gerar recibo PDF:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao gerar recibo.' });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
