// backend/src/server.js
// Arquivo principal do servidor Express

// Carrega as variáveis de ambiente do arquivo .env
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
app.post('/api/users/register', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { username, email, password, full_name, role } = req.body;
  const ipAddress = req.ip;

  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existingUser.rows.length > 0) {
      await logAudit(req.user.id, 'user_creation_failed', 'user', null, { reason: 'User/Email already exists', attempted_email: email, attempted_username: username }, ipAddress);
      return res.status(409).json({ message: 'Usuário ou email já cadastrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role`,
      [username, email, passwordHash, full_name, role]
    );

    await logAudit(req.user.id, 'user_created', 'user', newUser.rows[0].id, { new_user_email: email, new_user_role: role }, ipAddress);
    res.status(201).json({ message: 'Usuário registrado com sucesso.', user: newUser.rows[0] });

  } catch (error) {
    console.error('Erro ao registrar novo usuário:', error);
    await logAudit(req.user.id, 'user_creation_error', 'user', null, { error: error.message, attempted_email: email }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor.' });
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

    // 3. Obter a maior sequência numérica existente para esta combinação de prefixo e tipo
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
    // NOVO: Gerar código de setor usando a nova função
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

    // Ao atualizar, o código do setor não deve ser alterado, a menos que a lógica de negócio exija.
    // Manter o código existente para evitar complexidade desnecessária e duplicação de SKUs.
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
app.delete('/api/sectors/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem ativos associados a este setor
    const assetsCount = await pool.query('SELECT COUNT(*) FROM assets WHERE current_sector_id = $1', [id]);
    if (parseInt(assetsCount.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Não é possível deletar este setor, pois existem ativos associados a ele.' });
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
// Rotas para Ativos (Assets)
// ======================================

// Criar um novo Ativo (Cadastro Manual)
app.post('/api/assets', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
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
    await logAudit(req.user.id, 'update_asset_error', 'asset', id, { error: error.message, id }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar ativo.' });
  }
});

// Deletar Ativo
app.delete('/api/assets/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    // Verificar se existem movimentações associadas a este ativo
    const movementsCount = await pool.query('SELECT COUNT(*) FROM asset_movements WHERE asset_id = $1', [id]);
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
    res.attachment('relatorio_ativos.pdf');
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

    // Cria o PDF e o envia como buffer
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

    // Adiciona tratamento de erro para o documento PDF
    pdfDoc.on('error', (err) => {
      console.error('Erro durante a geração do PDF:', err);
      // Evita enviar headers novamente se já foram enviados
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
// Rotas para Movimentações de Ativos (Asset Movements) - FASE 3
// ======================================

// Registrar uma nova movimentação de ativo (Entrada, Saída, Empréstimo, Devolução, Manutenção)
app.post('/api/asset-movements', authenticateToken, authorizeRole(['admin', 'manager']), async (req, res) => {
  const {
    asset_id,
    movement_type,
    recipient_name,
    recipient_document,
    purpose,
    expected_return_date,
    notes
  } = req.body;
  const responsible_user_id = req.user.id; // Usuário autenticado é o responsável
  const ipAddress = req.ip;

  if (!asset_id || !movement_type || !responsible_user_id) {
    return res.status(400).json({ message: 'ID do ativo, tipo de movimentação e usuário responsável são obrigatórios.' });
  }

  try {
    // 1. Verificar se o ativo existe e obter seu status atual
    const assetResult = await pool.query('SELECT status FROM assets WHERE id = $1', [asset_id]);
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ativo não encontrado.' });
    }
    const currentAssetStatus = assetResult.rows[0].status;
    let newAssetStatus = currentAssetStatus;

    // 2. Validar a movimentação com base no status atual do ativo
    switch (movement_type) {
      case 'entry':
        // Uma entrada geralmente significa que o ativo está disponível
        newAssetStatus = 'available';
        break;
      case 'exit':
        // Ativos só podem ter saída se estiverem disponíveis
        if (currentAssetStatus !== 'available') {
          return res.status(400).json({ message: `Ativo não pode ter saída. Status atual: ${currentAssetStatus}.` });
        }
        newAssetStatus = 'in_use'; // Assumindo que 'exit' significa 'em uso'
        break;
      case 'loan':
        // Ativos só podem ser emprestados se estiverem disponíveis
        if (currentAssetStatus !== 'available') {
          return res.status(400).json({ message: `Ativo não pode ser emprestado. Status atual: ${currentAssetStatus}.` });
        }
        if (!expected_return_date) {
          return res.status(400).json({ message: 'Data de devolução esperada é obrigatória para empréstimos.' });
        }
        newAssetStatus = 'loaned';
        break;
      case 'return':
        // Ativos só podem ser devolvidos se estiverem emprestados, em uso ou em manutenção
        if (!['loaned', 'in_use', 'maintenance'].includes(currentAssetStatus)) {
          return res.status(400).json({ message: `Ativo não pode ser devolvido. Status atual: ${currentAssetStatus}.` });
        }
        newAssetStatus = 'available'; // Após devolução, volta a ficar disponível
        break;
      case 'maintenance':
        // Ativos podem ir para manutenção de qualquer status que não seja 'retired' ou 'disposed'
        if (['retired', 'disposed'].includes(currentAssetStatus)) {
             return res.status(400).json({ message: `Ativo não pode ir para manutenção. Status atual: ${currentAssetStatus}.` });
        }
        newAssetStatus = 'maintenance';
        break;
      default:
        return res.status(400).json({ message: 'Tipo de movimentação inválido.' });
    }

    // 3. Inserir a nova movimentação
    const newMovement = await pool.query(
      `INSERT INTO asset_movements (asset_id, movement_type, responsible_user_id, recipient_name, recipient_document, purpose, expected_return_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [asset_id, movement_type, responsible_user_id, recipient_name, recipient_document, purpose, expected_return_date, notes]
    );

    // 4. Atualizar o status do ativo
    await pool.query(
      `UPDATE assets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newAssetStatus, asset_id]
    );

    await logAudit(responsible_user_id, `create_movement_${movement_type}`, 'asset_movement', newMovement.rows[0].id, { asset_id, movement_type, new_status: newAssetStatus }, ipAddress);
    res.status(201).json({ message: `Movimentação de ${movement_type} registrada com sucesso.`, movement: newMovement.rows[0] });

  } catch (error) {
    console.error('Erro ao registrar movimentação de ativo:', error);
    await logAudit(responsible_user_id, `create_movement_error_${movement_type}`, 'asset_movement', null, { error: error.message, asset_id, movement_type }, ipAddress);
    res.status(500).json({ message: 'Erro interno do servidor ao registrar movimentação.' });
  }
});

// Listar todas as movimentações de ativos (com filtros, se necessário)
app.get('/api/asset-movements', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         am.*,
         a.sku,
         a.brand,
         a.model,
         u.username AS responsible_username,
         u.full_name AS responsible_full_name
       FROM asset_movements am
       JOIN assets a ON am.asset_id = a.id
       JOIN users u ON am.responsible_user_id = u.id
       ORDER BY am.movement_date DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao listar movimentações de ativos:', error);
    await logAudit(req.user.id, 'list_movements_error', 'asset_movement', null, { error: error.message }, req.ip);
    res.status(500).json({ message: 'Erro interno do servidor ao listar movimentações.' });
  }
});

// NOVO: Rota para gerar Recibo PDF para uma Movimentação Específica - FASE 4
app.get('/api/asset-movements/:id/receipt-pdf', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip;

  try {
    const movementResult = await pool.query(
      `SELECT
         am.*,
         a.sku,
         a.brand,
         a.model,
         a.serial_number,
         a.patrimonio_number,
         it.name AS item_type_name,
         u.full_name AS responsible_user_full_name,
         u.email AS responsible_user_email
       FROM asset_movements am
       JOIN assets a ON am.asset_id = a.id
       JOIN item_types it ON a.item_type_id = it.id
       JOIN users u ON am.responsible_user_id = u.id
       WHERE am.id = $1`,
      [id]
    );

    const movement = movementResult.rows[0];

    if (!movement) {
      return res.status(404).json({ message: 'Movimentação não encontrada.' });
    }

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
            movement.recipient_name ? `Recebedor: ${movement.recipient_name}` : null,
            movement.recipient_document ? `Documento Recebedor: ${movement.recipient_document}` : null,
            movement.purpose ? `Finalidade: ${movement.purpose}` : null,
            movement.expected_return_date ? `Data de Devolução Esperada: ${new Date(movement.expected_return_date).toLocaleDateString('pt-BR')}` : null,
            movement.actual_return_date ? `Data de Devolução Real: ${new Date(movement.actual_return_date).toLocaleDateString('pt-BR')}` : null,
            movement.notes ? `Observações: ${movement.notes}` : null,
          ].filter(Boolean), // Filtra itens nulos
          margin: [0, 5]
        },
        { text: '\n\n' },

        { text: 'Detalhes do Ativo:', style: 'sectionHeader' },
        {
          ul: [
            `SKU: ${movement.sku}`,
            `Tipo de Item: ${movement.item_type_name}`,
            `Marca: ${movement.brand}`,
            `Modelo: ${movement.model}`,
            `Número de Série: ${movement.serial_number || 'N/A'}`,
            `Número de Patrimônio: ${movement.patrimonio_number || 'N/A'}`,
            `Status Atual do Ativo: ${movement.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          ],
          margin: [0, 5]
        },
        { text: '\n\n' },

        { text: '________________________________________', alignment: 'center', margin: [0, 40, 0, 5] },
        { text: `${movement.recipient_name || movement.responsible_user_full_name}`, alignment: 'center' },
        { text: 'Assinatura do Recebedor / Responsável', alignment: 'center', fontSize: 9 }
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
        documentTitle: { fontSize: 18, bold: true, margin: [0, 10, 0, 10], decoration: 'underline' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5], color: '#0056b3' },
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
         a.sku,
         a.brand,
         a.model,
         am.movement_type,
         am.movement_date,
         u.full_name AS responsible_user_name,
         am.recipient_name
       FROM asset_movements am
       JOIN assets a ON am.asset_id = a.id
       JOIN users u ON am.responsible_user_id = u.id
       ORDER BY am.movement_date DESC
       LIMIT 5`
    );
    const recentMovements = recentMovementsResult.rows.map(row => ({
      id: row.id,
      asset: `${row.brand} ${row.model} (${row.sku})`,
      type: row.movement_type,
      date: new Date(row.movement_date).toLocaleDateString('pt-BR'),
      user: row.responsible_user_name || row.recipient_name || 'N/A'
    }));

    // Alertas Pendentes (empréstimos próximos do vencimento ou vencidos)
    const pendingAlertsResult = await pool.query(
      `SELECT
         a.sku,
         a.brand,
         a.model,
         am.expected_return_date
       FROM asset_movements am
       JOIN assets a ON am.asset_id = a.id
       WHERE am.movement_type = 'loan'
         AND am.actual_return_date IS NULL -- Ainda não devolvido
         AND am.expected_return_date IS NOT NULL
         AND am.expected_return_date <= CURRENT_DATE + INTERVAL '7 days' -- Vence em 7 dias ou já venceu
       ORDER BY am.expected_return_date ASC`
    );
    const pendingAlerts = pendingAlertsResult.rows.map(row => ({
      id: row.sku, // Usando SKU como ID temporário para o alerta
      message: `Devolução do "${row.brand} ${row.model} (${row.sku})" ${new Date(row.expected_return_date) <= new Date() ? 'atrasada' : 'próxima'} do prazo.`,
      asset: `${row.brand} ${row.model}`,
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


// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});