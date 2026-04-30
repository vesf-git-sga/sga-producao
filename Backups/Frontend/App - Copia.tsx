import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import InputMask from 'react-input-mask';
import {
  Mail, Lock, LogIn, Menu, X, LayoutDashboard, HardDrive, BarChart2, Bell, Settings, LogOut,
  Box, CornerDownRight, CornerUpLeft, Calendar, List, PlusCircle, UploadCloud, Edit, Trash2,
  CheckCircle, XCircle, Info, AlertTriangle as AlertTriangleIcon, Repeat, FileText, Users, Search, Archive, ArrowRightLeft, ChevronDown, History, UserCircle  // Adicionado Users e Search para pessoas e busca
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios, { AxiosError } from 'axios';
import logoSGA from './assets/images/logo-sga-azul.png'; // Ajuste o caminho se necessário

// =====================================================================================
// Definições de Tipos TypeScript (Interfaces)
// =====================================================================================

// Interface para o objeto de usuário
interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'basic';
  must_change_password?: boolean;
}

// Interface para o contexto de autenticação
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  API_URL: string;
}

// Interface para os dados do Dashboard (ATUALIZADA)
interface DashboardData {
  totalAssets: number;
  availableAssets: number;
  inUseAssets: number;
  loanedAssets: number;
  maintenanceAssets: number;
  assetsByCategory: { name: string; value: number }[];
  recentMovements: { id: number | string; asset: string; type: string; date: string; user: string }[];
  pendingAlerts: { id: string; message: string; asset: string; dueDate: string }[];
}

// Interface para Tipos de Itens
interface ItemType {
  id: number;
  code: string;
  name: string;
  description?: string;
}

// Interface para Setores
interface Sector {
  id: number;
  code: string;
  secretariat: string;
  executive?: string;
  sector_name: string;
  address?: string;
  contact_phone?: string;
}

// Interface para Ativos (ATUALIZADA com campos para consulta)
interface Asset {
  id: number;
  sku: string;
  item_type_id: number;
  brand: string;
  model: string;
  description?: string;
  serial_number?: string;
  patrimonio_number?: string;
  unit_of_measure?: string;
  status: string;
  current_sector_id?: number;
  acquisition_date?: string;
  warranty_end_date?: string;
  notes?: string;
  item_type_name: string;
  current_sector_name?: string;
  current_sector_secretariat?: string;
}

// Interface para Pessoas
interface Person {
  id: number;
  full_name: string;
  secretariat?: string;
  executive?: string;
  sector_id?: number;
  sector_name?: string;
  registration_number?: string;
  cpf: string;
  email: string;
}

// Interface para Movimentações (ATUALIZADA com campos de pessoa e novos campos)
interface Movement {
  id: number;
  asset_ids?: number[]; // AGORA É UM ARRAY DE IDS
  assets?: Asset[]; // Para exibir os ativos associados à movimentação
  movement_type: 'entry' | 'exit' | 'loan' | 'return' | 'maintenance';
  movement_date: string; // ISO date string
  responsible_user_id: number;
  recipient_person_id?: number;
  recipient_name?: string;
  recipient_document?: string;
  purpose?: string;
  expected_return_date?: string; // ISO date string
  actual_return_date?: string; // ISO date string
  notes?: string;
  created_at: string;
  updated_at: string;
  sku?: string; // Pode não existir se for multi-ativo
  brand?: string; // Pode não existir se for multi-ativo
  model?: string; // Pode não existir se for multi-ativo
  responsible_username: string;
  responsible_full_name?: string;
  recipient_person_full_name?: string;
  recipient_person_cpf?: string;
  recipient_person_registration?: string;
  destination_sector_id?: number; // NOVO
  destination_secretariat?: string; // NOVO (do JOIN)
  destination_executive?: string; // NOVO (do JOIN)
  destination_sector_name?: string; // NOVO (do JOIN)
  request_channel_type?: 'Email' | 'SEI' | 'Ordem Direta'; // NOVO
  request_channel_details?: string; // NOVO
  total_assets_moved?: number; // Para o totalizador
  recipient_display_name?: string;
}

// Interface para a estrutura de resposta de erro do backend
interface BackendErrorResponse {
  message?: string;
  [key: string]: any;
}

// Interfaces para o sistema de Toast
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

// Interface para o log de auditoria no topo do arquivo
interface AuditLog {
  id: number;
  action_type: string;
  target_entity: string;
  details: any;
  ip_address: string;
  created_at: string;
  user_name: string;
  username: string;
}

// =====================================================================================
// Contexto e Provedor de Toast
// =====================================================================================

const ToastContext = createContext<ToastContextType | null>(null);

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        removeToast(toasts[0].id);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-4 right-4 z-[2000] space-y-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, removeToast }: { toast: Toast; removeToast: (id: string) => void }) => {
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  }[toast.type];

  const Icon = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangleIcon,
  }[toast.type];

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 transition-all duration-300 ease-out transform translate-x-0 opacity-100`}
      role="alert"
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      <span className="text-sm font-medium flex-grow">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="ml-auto p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-150">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};


// =====================================================================================
// Contexto e Provedor de Autenticação
// =====================================================================================

const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/auth/verify-token`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.isValid) {
            setUser(response.data.user as User);
          } else {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            addToast('Sua sessão expirou ou é inválida. Por favor, faça login novamente.', 'warning');
          }
        } catch (error: unknown) {
          console.error('Erro ao verificar token:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          addToast('Erro ao verificar sessão. Por favor, faça login novamente.', 'error');
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, [token, API_URL, addToast]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData as User);
      addToast('Login bem-sucedido!', 'success');
      return { success: true, message: 'Login bem-sucedido!' };
    } catch (error: unknown) {
      console.error('Erro no login:', error);
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
        ? axiosError.response.data.message
        : 'Erro ao fazer login.';
      addToast(errorMessage, 'error');
      return { success: false, message: errorMessage };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Logout realizado com sucesso.', 'info');
    } catch (error: unknown) {
      console.error('Erro ao registrar logout no backend:', error);
      addToast('Erro ao fazer logout.', 'error');
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(config => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    }, error => {
      return Promise.reject(error);
    });

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

// Componente da Página de Login
const LoginPage = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { login } = useContext(AuthContext) as AuthContextType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center font-sans text-gray-800">
      <div className="bg-white p-8 md:p-12 rounded-xl shadow-2xl w-full max-w-md mx-4 sm:mx-6 md:mx-auto transition-all duration-300 ease-in-out transform hover:scale-105">
        <div className="flex justify-center mb-6">
          <img
            src={logoSGA}
            alt="Logo Prefeitura do Recife"
            className="h-36 w-auto rounded-lg shadow-md"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/150x80/007bff/ffffff?text=Logo'; }}
          />
        </div>

        <h2 className="text-3xl font-extrabold text-center text-blue-900 mb-8 tracking-tight">
          SGA - Sistema de Gestão de Ativos
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="inline-block w-4 h-4 mr-2 text-blue-600" /> Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 ease-in-out"
              placeholder="seu.email@recife.pe.gov.br"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              <Lock className="inline-block w-4 h-4 mr-2 text-blue-600" /> Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 ease-in-out"
              placeholder="••••••••"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-lg font-semibold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition duration-300 ease-in-out transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Entrar
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Acesso restrito. Solicite seu cadastro via e-mail:</p>
          <a href="mailto:relacionamentosepti@educ.rec.br" className="font-medium text-blue-700 hover:text-blue-900 transition-colors duration-200">
            relacionamentosepti@educ.rec.br
          </a>
        </div>
      </div>
    </div>
  );
};

// Arquivo: App.tsx

// >>> Componente de página Configurações
interface SettingsPageProps {
  users: User[];
  onAddUser: () => void;
  onDeleteUser: (userId: number) => void;
  onEditUser: (user: User) => void;
}

const SettingsPage = ({ users, onAddUser, onDeleteUser, onEditUser }: SettingsPageProps) => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Usuários</h1>
      <div className="flex">
        <button
          onClick={onAddUser}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center transition-colors duration-200"
        >
          <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Novo Usuário
        </button>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Usuários do Sistema</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">Nome Completo</th>
                <th scope="col" className="px-6 py-3">Username</th>
                <th scope="col" className="px-6 py-3">Email</th>
                <th scope="col" className="px-6 py-3">Perfil de Acesso</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                  <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{user.full_name}</th>
                  <td className="px-6 py-4">{user.username}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${
                      user.role === 'admin' ? 'bg-red-100 text-red-700' :
                      user.role === 'manager' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  {/* CÉLULA DE AÇÕES CORRIGIDA */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {/* Botão de Edição único e funcional */}
                    <button
                      onClick={() => onEditUser(user)}
                      className="font-medium text-blue-600 hover:underline mr-4"
                      title="Editar Usuário"
                    >
                      <Edit className="w-5 h-5"/>
                    </button>
                    {/* Botão de Exclusão único e funcional */}
                    <button
                      onClick={() => onDeleteUser(user.id)}
                      className="font-medium text-red-600 hover:underline"
                      title="Remover Usuário"
                    >
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Componente do Dashboard
const DashboardPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [openMenu, setOpenMenu] = useState<string | null>('cadastros'); // Inicia com o menu 'cadastros' aberto
  const { user, logout, API_URL, loading: authLoading } = useContext(AuthContext) as AuthContextType;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [people, setPeople] = useState<Person[]>([]); // NOVO: Estado para pessoas
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [showItemTypeModal, setShowItemTypeModal] = useState<boolean>(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [showSectorModal, setShowSectorModal] = useState<boolean>(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showPeopleModal, setShowPeopleModal] = useState<boolean>(false); // NOVO: Estado para modal de pessoas
  const [editingPerson, setEditingPerson] = useState<Person | null>(null); // NOVO: Estado para pessoa em edição
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showReturnByAssetModal, setShowReturnByAssetModal] = useState<boolean>(false);
  const [showReturnByUserModal, setShowReturnByUserModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [patrimonioFilter, setPatrimonioFilter] = useState('');
  const [responsibleUserIdFilter, setResponsibleUserIdFilter] = useState('');
  const [solicitanteIdFilter, setSolicitanteIdFilter] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { addToast } = useToast();
  const ROLES = {
      ADMIN: 'admin',
      MANAGER: 'manager',
      BASIC: 'basic'
  };
  const PERMISSIONS = {
      USER_MANAGE: [ROLES.ADMIN],
      DATA_MANAGE: [ROLES.ADMIN, ROLES.MANAGER],
      DATA_DELETE: [ROLES.ADMIN],
      DATA_VIEW: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],
      AUDIT_VIEW: [ROLES.ADMIN], // A nova permissão que acabamos de criar
  };

  const can = (permission: keyof typeof PERMISSIONS): boolean => {
    const userRole = user?.role;
    if (!userRole) {
      // Se não houver um usuário logado ou ele não tiver um perfil, não tem permissão.
      return false;
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      // Se a permissão não foi definida na nossa estrutura, nega por segurança.
      console.warn(`A permissão "${permission}" não foi definida.`);
      return false;
    }
    
    // Retorna true se o perfil do usuário estiver na lista de perfis permitidos para a ação.
    return allowedRoles.includes(userRole);
  };

  const translateStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      available: 'Disponível',
      in_use: 'Em Uso',
      loaned: 'Emprestado',
      maintenance: 'Em Manutenção',
      retired: 'Baixado',
      disposed: 'Descartado'
    };
    // Retorna o status traduzido, ou o original caso não encontre uma tradução
    return statusMap[status] || status; 
  };

   const translateMovementType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      entry: 'Entrada',
      exit: 'Saída',
      loan: 'Empréstimo',
      return: 'Devolução',
      maintenance: 'Manutenção'
    };
    return typeMap[type] || type;
  };

  const COLORS = ['#007bff', '#ffc107', '#6c757d', '#28a745', '#dc3545', '#17a2b8'];

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await axios.get<DashboardData>(`${API_URL}/dashboard/summary`);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      addToast('Erro ao carregar dados do dashboard.', 'error');
      // Dados mockados para desenvolvimento/erro
      setDashboardData({
        totalAssets: 1250,
        availableAssets: 800,
        inUseAssets: 350,
        loanedAssets: 100,
        maintenanceAssets: 0,
        assetsByCategory: [
          { name: 'Notebooks', value: 500 },
          { name: 'Monitores', value: 400 },
          { name: 'Impressoras', value: 150 },
          { name: 'Projetores', value: 100 },
          { name: 'Outros', value: 100 },
        ],
        recentMovements: [
          { id: 'mock1', asset: 'Notebook Dell XZ123', type: 'Empréstimo', date: '2025-06-25', user: 'Maria Souza' },
          { id: 'mock2', asset: 'Monitor LG UltraWide', type: 'Devolução', date: '2025-06-24', user: 'Carlos Mendes' },
          { id: 'mock3', asset: 'Impressora Epson L3150', type: 'Entrada', date: '2025-06-23', user: 'Sistema' },
          { id: 'mock4', asset: 'Notebook HP Pavilion', type: 'Saída', date: '2025-06-22', user: 'Pedro Costa' },
        ],
        pendingAlerts: [
          { id: 'alert1', message: 'Devolução do "Projetor BenQ" em 2 dias.', asset: 'Projetor BenQ', dueDate: '2025-06-28' },
          { id: 'alert2', message: 'Devolução do "Tablet Samsung" atrasada em 5 dias.', asset: 'Tablet Samsung', dueDate: '2025-06-20' },
        ]
      });
    }
  }, [API_URL, addToast]);

  const fetchItemTypes = useCallback(async () => {
    console.log('Fetching item types...');
    try {
      const response = await axios.get<ItemType[]>(`${API_URL}/item-types`);
      setItemTypes(response.data);
    } catch (error) {
      console.error('Erro ao buscar tipos de itens:', error);
      addToast('Erro ao carregar tipos de itens.', 'error');
      setItemTypes([]);
    }
  }, [API_URL, addToast]);

  const fetchSectors = useCallback(async () => {
    console.log('Fetching sectors...');
    try {
      const response = await axios.get<Sector[]>(`${API_URL}/sectors`);
      setSectors(response.data);
    } catch (error) {
      console.error('Erro ao buscar setores:', error);
      addToast('Erro ao carregar setores.', 'error');
      setSectors([]);
    }
  }, [API_URL, addToast]);

  const fetchAssets = useCallback(async () => {
    console.log('Fetching assets...');
    try {
      const response = await axios.get<Asset[]>(`${API_URL}/assets`);
      setAssets(response.data);
    } catch (error) {
      console.error('Erro ao buscar ativos:', error);
      addToast('Erro ao carregar ativos.', 'error');
      setAssets([]);
    }
  }, [API_URL, addToast]);

  const fetchMovements = useCallback(async (filters: { startDate?: string, endDate?: string, patrimonio?: string, responsibleUserId?: string, solicitanteId?: string } = {}) => {
  console.log('Fetching movements with filters:', filters);
  try {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.patrimonio) params.append('patrimonio', filters.patrimonio);
    if (filters.responsibleUserId) params.append('responsibleUserId', filters.responsibleUserId);
    if (filters.solicitanteId) params.append('solicitanteId', filters.solicitanteId);
    
    const queryString = params.toString();
    const url = `${API_URL}/asset-movements${queryString ? `?${queryString}` : ''}`;
    
    const response = await axios.get<Movement[]>(url);
    setMovements(response.data);
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    addToast('Erro ao carregar movimentações.', 'error');
    setMovements([]);
  }
}, [API_URL, addToast]);

  // NOVO: Função para buscar pessoas
  const fetchPeople = useCallback(async () => {
    console.log('Fetching people...');
    try {
      const response = await axios.get<Person[]>(`${API_URL}/people`);
      setPeople(response.data);
    } catch (error) {
      console.error('Erro ao buscar pessoas:', error);
      addToast('Erro ao carregar pessoas.', 'error');
      setPeople([]);
    }
  }, [API_URL, addToast]);

  // >>> NOVA FUNÇÃO DE BUSCA - USER<<<
  const fetchUsers = useCallback(async () => {
  if (user?.role !== 'admin') return; // Apenas admin pode buscar usuários
  console.log('Fetching users...');
  try {
    const response = await axios.get<User[]>(`${API_URL}/users`);
    setUsers(response.data);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    addToast('Erro ao carregar a lista de usuários.', 'error');
    setUsers([]);
  }
}, [API_URL, addToast, user?.role]);

// >>> NOVA FUNÇÃO DE BUSCA - AUDITORIA <<<
const fetchAuditLogs = useCallback(async () => {
  if (user?.role !== 'admin') return;
  try {
    const response = await axios.get<AuditLog[]>(`${API_URL}/audit-logs`);
    setAuditLogs(response.data);
  } catch (error) {
    console.error('Erro ao buscar logs de auditoria:', error);
    addToast('Erro ao carregar logs de auditoria.', 'error');
  }
}, [API_URL, user?.role, addToast]);

  useEffect(() => {
    if (user && !authLoading) {
      console.log('User authenticated, fetching dashboard data...');
      fetchDashboardData();
      fetchItemTypes();
      fetchSectors();
      fetchAssets();
      fetchMovements();
      fetchPeople(); // NOVO: Carrega pessoas ao iniciar
      fetchUsers();
      fetchAuditLogs();
    }
  }, [user, authLoading, fetchAssets, fetchItemTypes, fetchSectors, fetchDashboardData, fetchMovements, fetchPeople, fetchUsers]);

  const Card = ({ title, value, icon: Icon, colorClass }: { title: string; value: number; icon: React.ElementType; colorClass: string }) => (
    <div className={`bg-white p-6 rounded-xl shadow-md flex items-center justify-between transition-all duration-300 ease-in-out transform hover:scale-105 ${colorClass}`}>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className="text-3xl font-bold text-gray-800 mt-1">{value}</span>
      </div>
      {Icon && <Icon className="w-12 h-12 opacity-20" />}
    </div>
  );

  const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
  {
    name: 'Cadastros',
    icon: Archive,
    id: 'cadastros',
    subMenus: [
      { name: 'Tipos de Itens', icon: List, id: 'item-types', roles: ['admin', 'manager'] },
      { name: 'Setores', icon: List, id: 'sectors', roles: ['admin', 'manager'] },
      { name: 'Pessoas', icon: Users, id: 'people', roles: ['admin', 'manager'] },
      { name: 'Ativos', icon: HardDrive, id: 'assets', roles: ['admin', 'manager', 'basic'] },
    ]
  },
  {
    name: 'Movimentações',
    icon: ArrowRightLeft,
    id: 'movimentacoes',
    subMenus: [
      { name: 'Registrar Movimentação', icon: Repeat, id: 'movements', roles: ['admin', 'manager'] },
      { name: 'Devoluções', icon: CornerUpLeft, id: 'returns', roles: ['admin', 'manager'] },
    ]
  },
  { name: 'Relatórios', icon: BarChart2, id: 'reports' },
  { name: 'Auditoria', icon: History, id: 'audit', roles: ['admin'] },
  { name: 'Alertas', icon: Bell, id: 'alerts' }, // Garantido que só existe um
  { name: 'Configurações', icon: Settings, id: 'settings', roles: ['admin'] },
];

  const canAccess = (roles: string[]): boolean => {
  // Se a lista de 'roles' não for definida ou estiver vazia, permite o acesso.
  if (!roles || roles.length === 0) {
    return true;
  }
  // Caso contrário, verifica se o cargo do usuário está na lista.
  return roles.includes(user?.role || '');
};

  // Funções de manipulação para Tipos de Itens
  const handleEditItemType = (itemType: ItemType) => {
    setEditingItemType(itemType);
    setShowItemTypeModal(true);
  };

  //nova função para abrir o modal em modo de edição
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDeleteItemType = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este tipo de item?')) {
      try {
        await axios.delete(`${API_URL}/item-types/${id}`);
        addToast('Tipo de item excluído com sucesso!', 'success');
        fetchItemTypes(); // Recarrega a lista
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir tipo de item.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir tipo de item:', axiosError);
      }
    }
  };

  // Funções de manipulação para Setores
  const handleEditSector = (sector: Sector) => {
    setEditingSector(sector);
    setShowSectorModal(true);
  };

  const handleDeleteSector = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este setor?')) {
      try {
        await axios.delete(`${API_URL}/sectors/${id}`);
        addToast('Setor excluído com sucesso!', 'success');
        fetchSectors(); // Recarrega a lista
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir setor.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir setor:', axiosError);
      }
    }
  };

  // Funções de manipulação para Ativos
  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setShowAssetModal(true);
  };

  const handleDeleteAsset = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este ativo?')) {
      try {
        await axios.delete(`${API_URL}/assets/${id}`);
        addToast('Ativo excluído com sucesso!', 'success');
        fetchAssets(); // Recarrega a lista
        fetchDashboardData(); // Atualiza o dashboard
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir ativo.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir ativo:', axiosError);
      }
    }
  };

  // Funções de manipulação para Pessoas
  const handleEditPerson = (person: Person) => {
    setEditingPerson(person);
    setShowPeopleModal(true);
  };

  const handleDeletePerson = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
      try {
        await axios.delete(`${API_URL}/people/${id}`);
        addToast('Pessoa excluída com sucesso!', 'success');
        fetchPeople(); // Recarrega a lista de pessoas
        fetchMovements(); // Recarrega movimentações, pois a pessoa pode estar associada
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir pessoa.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir pessoa:', axiosError);
      }
    }
  };

  const handleDeleteUser = async (userId: number) => {
  // Pede uma confirmação antes de uma ação destrutiva
  if (window.confirm('Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.')) {
    try {
      await axios.delete(`${API_URL}/users/${userId}`);
      addToast('Usuário removido com sucesso!', 'success');
      fetchUsers(); // Atualiza a lista de usuários na tela
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Erro ao remover usuário.';
      addToast(errorMessage, 'error');
      console.error('Erro ao remover usuário:', error);
    }
  }
};

  // Função para gerar Recibo PDF para Movimentação
  const handleGenerateMovementReceipt = async (movementId: number) => {
    try {
      addToast('Gerando recibo PDF...', 'info');
      const response = await axios.get(`${API_URL}/asset-movements/${movementId}/receipt-pdf`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_movimentacao_${movementId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast('Recibo PDF gerado com sucesso!', 'success');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
        ? axiosError.response.data.message
        : 'Erro ao gerar recibo PDF.';
      console.error(`Erro ao gerar recibo PDF para movimentação ${movementId}:`, axiosError.response?.data || axiosError);
      addToast(`Erro: ${errorMessage}`, 'error');
    }
  };


  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Mobile */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-75 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <div className={`fixed top-0 left-0 h-full bg-blue-900 text-white w-64 p-5 z-50 transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="flex items-center justify-between mb-8">
          <a
            href="#dashboard"
            className="cursor-pointer" // Adiciona o cursor de "mãozinha" para indicar que é clicável
            onClick={(e) => {
              e.preventDefault(); // Evita que a página mude a URL de forma padrão
              setActiveMenu('dashboard'); // Define o menu ativo para o dashboard
              setSidebarOpen(false); // Fecha a sidebar (importante para o mobile)
            }}
          >
            <img
              src={logoSGA}
              alt="Logo SGA - Voltar ao Dashboard"
              className="h-36 w-auto" // Ajuste a altura (h-12) conforme necessário
              //onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/180x60/0056b3/ffffff?text=Logo'; }}
            />
          </a>
        </div>

        <nav className="space-y-2 flex-1 overflow-y-auto pb-4 scrollbar-thin scrollbar-track-blue-900 scrollbar-thumb-blue-700 hover:scrollbar-thumb-blue-500 scrollbar-thumb-rounded-full">
          {menuItems.map((item) => (
            // >>> LÓGICA CORRIGIDA AQUI <<<
            // Agora, canAccess sempre recebe um array, nunca undefined.
            (canAccess(item.roles || [])) ? (
              // Se o item tiver submenus, cria um grupo expansível
              item.subMenus ? (
                <div key={item.id}>
                  <button
                    onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-800 transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-300 ${openMenu === item.id ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {/* Mostra os submenus se o menu principal estiver aberto */}
                  {openMenu === item.id && (
                    <div className="pl-6 mt-1 space-y-1">
                      {item.subMenus.map((subMenu) => (
                        (canAccess(subMenu.roles || [])) && (
                          <a
                            key={subMenu.id}
                            href={`#${subMenu.id}`}
                            onClick={() => { setActiveMenu(subMenu.id); setSidebarOpen(false); }}
                            className={`flex items-center p-2 rounded-lg transition-colors duration-200 text-sm ${
                              activeMenu === subMenu.id ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'
                            }`}
                          >
                            <subMenu.icon className="w-4 h-4 mr-3" />
                            <span>{subMenu.name}</span>
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Se não tiver submenus, cria um item de menu normal
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => { setActiveMenu(item.id); setSidebarOpen(false); }}
                  className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                    activeMenu === item.id ? 'bg-blue-700 text-yellow-300 shadow-md' : 'hover:bg-blue-800'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.name}</span>
                </a>
              )
            ) : null
          ))}
          <a
            href="#logout"
            onClick={logout}
            className="flex items-center p-3 rounded-lg transition-colors duration-200 hover:bg-red-700 text-red-300"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-medium">Sair</span>
          </a>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-64 transition-all duration-300 ease-in-out">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 flex items-center justify-between lg:justify-end">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-blue-800 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          <div className="relative">
            {/* Botão que abre o dropdown */}
            <button onClick={() => setSidebarOpen(p => !p)} className="flex items-center space-x-2 cursor-pointer">
              <div className="text-right hidden sm:block">
                <span className="block text-sm font-medium text-gray-700">{user?.full_name || user?.username}</span>
                <span className="block text-xs text-gray-500">{user?.role}</span>
              </div>
              <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>

            {/* O menu dropdown que aparece ao clicar */}
            {sidebarOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border"
                  // Adicionado para fechar o menu se clicar fora (opcional, mas bom UX)
                  onMouseLeave={() => setSidebarOpen(false)} 
                >
                    <button
                        onClick={() => {
                            setShowProfileModal(true);
                            setSidebarOpen(false); // Fecha o dropdown
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                        <UserCircle className="w-4 h-4 mr-2" /> Meu Perfil
                    </button>
                    <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                        <LogOut className="w-4 h-4 mr-2" /> Sair
                    </button>
                </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">
          {activeMenu === 'dashboard' && dashboardData && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Dashboard do SGA</h1>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Ativos Totais" value={dashboardData.totalAssets} icon={Box} colorClass="bg-blue-100 text-blue-800" />
                <Card title="Ativos Disponíveis" value={dashboardData.availableAssets} icon={CornerDownRight} colorClass="bg-green-100 text-green-800" />
                <Card title="Ativos em Uso" value={dashboardData.inUseAssets} icon={CornerUpLeft} colorClass="bg-yellow-100 text-yellow-800" />
                <Card title="Ativos Emprestados" value={dashboardData.loanedAssets} icon={Calendar} colorClass="bg-purple-100 text-purple-800" />
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Ativos por Categoria</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dashboardData.assetsByCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {dashboardData.assetsByCategory.map((entry: { name: string; value: number }, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Status dos Ativos</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { name: 'Disponíveis', value: dashboardData.availableAssets },
                        { name: 'Em Uso', value: dashboardData.inUseAssets },
                        { name: 'Emprestados', value: dashboardData.loanedAssets },
                        { name: 'Manutenção', value: dashboardData.maintenanceAssets },
                      ]}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#007bff" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Atividades Recentes e Alertas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Atividades Recentes */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Movimentações Recentes</h3>
                  <ul className="divide-y divide-gray-200">
                    {dashboardData.recentMovements.map((movement: { id: number | string; asset: string; type: string; date: string; user: string }) => (
                      <li key={movement.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-gray-700 font-medium">{movement.asset}</p>
                          <p className="text-sm text-gray-500">{movement.type} por {movement.user}</p>
                        </div>
                        <span className="text-xs text-gray-400">{movement.date}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Alertas Pendentes */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center">
                    <AlertTriangleIcon className="w-5 h-5 mr-2 text-red-600" /> Alertas Pendentes
                  </h3>
                  {dashboardData.pendingAlerts.length > 0 ? (
                    <ul className="space-y-3">
                      {dashboardData.pendingAlerts.map((alert: { id: string; message: string; asset: string; dueDate: string }) => (
                        <li key={alert.id} className="p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm font-medium text-red-800">{alert.message}</p>
                          <p className="text-xs text-red-600 mt-1">Ativo: {alert.asset} | Vencimento: {alert.dueDate}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Nenhum alerta pendente no momento.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'item-types' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Tipos de Itens</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => { setEditingItemType(null); setShowItemTypeModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Tipo de Item
                  </button>
                  <input
                    type="file"
                    id="itemTypeFileInput"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'item-types')}
                  />
                  <label htmlFor="itemTypeFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Tipos (XLSX/CSV)
                  </label>
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Tipos de Itens</h3>
                {itemTypes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                          {canAccess(['admin', 'manager']) && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {itemTypes.map((type: ItemType) => (
                          <tr key={type.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{type.code}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{type.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{type.description || 'N/A'}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEditItemType(type)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <Edit className="inline-block w-4 h-4" /> Editar
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeleteItemType(type.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="inline-block w-4 h-4" /> Excluir
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum tipo de item cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'sectors' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Setores</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => { setEditingSector(null); setShowSectorModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Setor
                  </button>
                  <input
                    type="file"
                    id="sectorFileInput"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'sectors')}
                  />
                  <label htmlFor="sectorFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Setores (XLSX/CSV)
                  </label>
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Setores Cadastrados</h3>
                {sectors.length > 0 ? (
                  // A classe 'overflow-x-auto' garante a responsividade em telas muito pequenas
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          {/* Colunas Atualizadas */}
                          <th scope="col" className="px-6 py-3">Secretaria</th>
                          <th scope="col" className="px-6 py-3">Secretaria Executiva</th>
                          <th scope="col" className="px-6 py-3">Setor</th>
                          <th scope="col" className="px-6 py-3">Telefone</th>
                          {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sectors.map((sector: Sector) => (
                          <tr key={sector.id} className="bg-white border-b hover:bg-gray-50">
                            {/* Dados correspondentes às novas colunas */}
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {sector.secretariat}
                            </th>
                            <td className="px-6 py-4">
                              {sector.executive || 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              {sector.sector_name}
                            </td>
                            <td className="px-6 py-4">
                              {sector.contact_phone || 'N/A'}
                            </td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleEditSector(sector)}
                                  className="font-medium text-blue-600 hover:underline mr-4"
                                  title="Editar Setor"
                                >
                                  <Edit className="inline-block w-5 h-5" />
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeleteSector(sector.id)}
                                    className="font-medium text-red-600 hover:underline"
                                    title="Excluir Setor"
                                  >
                                    <Trash2 className="inline-block w-5 h-5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum setor cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'people' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Pessoas</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => { setEditingPerson(null); setShowPeopleModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Pessoa
                  </button>
                  {/* NOVO BOTÃO DE IMPORTAÇÃO */}
                  <input
                    type="file"
                    id="personFileInput"
                    className="hidden"
                    accept=".xlsx, .csv"
                    // A função handleImport existente é reutilizada, passando 'people' como tipo
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'people')}
                  />
                  <label htmlFor="personFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Pessoas (XLSX/CSV)
                  </label>
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Pessoas Cadastradas</h3>
                {people.length > 0 ? (
                  <div className="overflow-x-auto">
                    {/* Tabela com a nova formatação */}
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Nome Completo</th>
                          <th scope="col" className="px-6 py-3">Setor</th>
                          <th scope="col" className="px-6 py-3">Matrícula</th>
                          <th scope="col" className="px-6 py-3">CPF</th>
                          <th scope="col" className="px-6 py-3">Email</th>
                          {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((person: Person) => (
                          <tr key={person.id} className="bg-white border-b hover:bg-gray-50">
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {person.full_name}
                            </th>
                            <td className="px-6 py-4">
                              {/* Exibe 'Secretaria - Setor' para mais contexto, se disponível */}
                              {person.sector_name ? `${person.secretariat || ''} - ${person.sector_name}` : 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              {person.registration_number || 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              {person.cpf}
                            </td>
                            <td className="px-6 py-4">
                              {person.email}
                            </td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleEditPerson(person)}
                                  className="font-medium text-blue-600 hover:underline mr-4"
                                  title="Editar Pessoa"
                                >
                                  <Edit className="inline-block w-5 h-5" />
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeletePerson(person.id)}
                                    className="font-medium text-red-600 hover:underline"
                                    title="Excluir Pessoa"
                                  >
                                    <Trash2 className="inline-block w-5 h-5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhuma pessoa cadastrada.</p>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'assets' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Ativos</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => {
                      console.log('Botão Adicionar Ativo clicado. Abrindo modal...');
                      setEditingAsset(null);
                      setShowAssetModal(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Ativo
                  </button>
                  <input
                    type="file"
                    id="assetFileInput"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'assets')}
                  />
                  <label htmlFor="assetFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Ativos (XLSX/CSV)
                  </label>
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Ativos Cadastrados</h3>
                {assets.length > 0 ? (
                  <div className="overflow-x-auto">
                    {/* Tabela com a nova formatação e colunas */}
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Patrimônio</th>
                          <th scope="col" className="px-6 py-3">Tipo</th>
                          <th scope="col" className="px-6 py-3">Marca / Modelo</th>
                          <th scope="col" className="px-6 py-3">Status</th>
                          <th scope="col" className="px-6 py-3">Setor Atual</th>
                          {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {assets.map((asset: Asset) => (
                          <tr key={asset.id} className="bg-white border-b hover:bg-gray-50">
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {asset.patrimonio_number || 'N/A'}
                            </th>
                            <td className="px-6 py-4">
                              {asset.item_type_name}
                            </td>
                            <td className="px-6 py-4">
                              {`${asset.brand} / ${asset.model}`}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${
                                asset.status === 'available' ? 'bg-green-100 text-green-700' :
                                asset.status === 'in_use' ? 'bg-blue-100 text-blue-700' :
                                asset.status === 'loaned' ? 'bg-yellow-100 text-yellow-700' :
                                asset.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {/* >>> A TRADUÇÃO ACONTECE AQUI <<< */}
                                {translateStatus(asset.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {asset.current_sector_name || 'N/A'}
                            </td>
                            {/* ...célula de ações... */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum ativo cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'movements' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Movimentações</h1>

              {/* Barra de Filtros Completa e Corrigida */}
              <div className="bg-white p-4 rounded-xl shadow-md space-y-4">
                {/* Grade de Filtros 2x2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data de Início</label>
                    <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Data de Fim</label>
                    <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label htmlFor="patrimonioFilter" className="block text-sm font-medium text-gray-700">Nº de Patrimônio</label>
                    <input type="text" id="patrimonioFilter" placeholder="Digite o patrimônio..." value={patrimonioFilter} onChange={e => setPatrimonioFilter(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label htmlFor="solicitanteFilter" className="block text-sm font-medium text-gray-700">Solicitante</label>
                    <select id="solicitanteFilter" value={solicitanteIdFilter} onChange={e => setSolicitanteIdFilter(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Todos</option>
                      {people.map(person => (
                        <option key={person.id} value={person.id}>{person.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="responsibleUserFilter" className="block text-sm font-medium text-gray-700">Responsável (Operador)</label>
                    <select id="responsibleUserFilter" value={responsibleUserIdFilter} onChange={e => setResponsibleUserIdFilter(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Todos</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Botões de Ação */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => fetchMovements({ startDate, endDate, patrimonio: patrimonioFilter, responsibleUserId: responsibleUserIdFilter, solicitanteId: solicitanteIdFilter })}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700"
                  >
                    Filtrar
                  </button>
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setPatrimonioFilter('');
                      setResponsibleUserIdFilter('');
                      setSolicitanteIdFilter('');
                      fetchMovements();
                    }}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg shadow-md hover:bg-gray-400"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>

              {/* Botão de Adicionar Movimentação */}
              {can('DATA_MANAGE') && (
                <div className="flex">
                  <button
                    onClick={() => setShowMovementModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Registrar Movimentação
                  </button>
                </div>
              )}

              {/* Tabela de Histórico de Movimentações */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico de Movimentações</h3>
                {movements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      {/* ... o restante da sua tabela de movimentações ... */}
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Ativos Movimentados (Patrimônio)</th>
                          <th scope="col" className="px-6 py-3">Tipo de Movimentação</th>
                          <th scope="col" className="px-6 py-3">Data</th>
                          <th scope="col" className="px-6 py-3">Responsável (Operador)</th>
                          <th scope="col" className="px-6 py-3">Solicitante</th>
                          <th scope="col" className="px-6 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((movement: Movement) => (
                          <tr key={movement.id} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {movement.assets && movement.assets.length > 0
                                ? movement.assets.map(asset => asset.patrimonio_number || asset.sku).join(', ')
                                : 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${
                                movement.movement_type === 'entry' ? 'bg-green-100 text-green-700' :
                                movement.movement_type === 'exit' ? 'bg-red-100 text-red-700' :
                                movement.movement_type === 'loan' ? 'bg-yellow-100 text-yellow-700' :
                                movement.movement_type === 'return' ? 'bg-blue-100 text-blue-700' :
                                movement.movement_type === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {translateMovementType(movement.movement_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-6 py-4">{movement.responsible_full_name || movement.responsible_username}</td>
                            <td className="px-6 py-4">{movement.recipient_display_name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleGenerateMovementReceipt(movement.id)}
                                  className="font-medium text-purple-600 hover:underline"
                                  title="Gerar Recibo PDF"
                                >
                                  <FileText className="inline-block w-5 h-5" />
                                </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhuma movimentação registrada.</p>
                )}
              </div>
            </div>
          )}

          {/* >>> ADICIONE ESTA NOVA SEÇÃO AQUI <<< */}
          {activeMenu === 'returns' && (
            <ReturnsPage
             onStartReturnByUser={() => setShowReturnByUserModal(true)}
            onStartReturnByAsset={() => setShowReturnByAssetModal(true)}
            />
          )}

          {activeMenu === 'settings' && (
  // Apenas usuários com o perfil 'admin' podem ver esta página
  canAccess(['admin']) ? (
    <SettingsPage
      users={users}
      onAddUser={() => {
        setEditingUser(null); // Garante que não há usuário em edição
        setShowUserModal(true);
      }}
      onDeleteUser={handleDeleteUser}
      onEditUser={handleEditUser} // <<< PASSA A NOVA FUNÇÃO
    />
  ) : (
    // Mensagem de Acesso Negado para outros perfis
    <div className="text-center py-20 text-red-600">
      <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
      <p>Você não tem permissão para acessar esta área.</p>
    </div>
  )
)}

          {activeMenu === 'reports' && (
  <div className="space-y-8">
    <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Geração de Relatórios</h1>
    
    {/* Bloco de Relatórios de Ativos (já existente e corrigido) */}
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Relatórios de Ativos</h3>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => handleDownloadReport('assets', 'csv')}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-colors duration-200"
        >
          <FileText className="w-5 h-5 mr-2" /> Exportar Ativos (CSV)
        </button>
        <button
          onClick={() => handleDownloadReport('assets', 'xlsx')}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-colors duration-200"
        >
          <FileText className="w-5 h-5 mr-2" /> Exportar Ativos (XLSX)
        </button>
        <button
          onClick={() => handleDownloadReport('assets', 'pdf')}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-colors duration-200"
        >
          <FileText className="w-5 h-5 mr-2" /> Exportar Ativos (PDF)
        </button>
      </div>
    </div>

    {/* NOVO BLOCO DE RELATÓRIOS CADASTRAIS */}
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Relatórios Cadastrais</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Relatório de Pessoas */}
        <div className="border p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center"><Users className="w-5 h-5 mr-2" /> Pessoas</h4>
          <div className="flex gap-2">
            <button onClick={() => handleDownloadReport('people', 'csv')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">CSV</button>
            <button onClick={() => handleDownloadReport('people', 'xlsx')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">XLSX</button>
            <button onClick={() => handleDownloadReport('people', 'pdf')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">PDF</button>
          </div>
        </div>
        
        {/* Espaços para futuros relatórios */}
         {/* Relatório de Setores */}
    <div className="border p-4 rounded-lg">
      <h4 className="font-semibold mb-2 flex items-center"><List className="w-5 h-5 mr-2" /> Setores</h4>
      <div className="flex gap-2">
        <button onClick={() => handleDownloadReport('sectors', 'csv')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">CSV</button>
        <button onClick={() => handleDownloadReport('sectors', 'xlsx')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">XLSX</button>
        <button onClick={() => handleDownloadReport('sectors', 'pdf')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">PDF</button>
      </div>
    </div>
    
    {/* Relatório de Tipos de Itens */}
    <div className="border p-4 rounded-lg">
      <h4 className="font-semibold mb-2 flex items-center"><List className="w-5 h-5 mr-2" /> Tipos de Itens</h4>
      <div className="flex gap-2">
        <button onClick={() => handleDownloadReport('item-types', 'csv')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">CSV</button>
        <button onClick={() => handleDownloadReport('item-types', 'xlsx')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">XLSX</button>
        <button onClick={() => handleDownloadReport('item-types', 'pdf')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">PDF</button>
      </div>
    </div>
      </div>
    </div>
  </div>
)}
        </main>
      </div>

      {/* Modais de Gerenciamento */}
      {showMovementModal && (
        <MovementModal
          onClose={() => setShowMovementModal(false)}
          onSave={async (newMovementData) => {
            try {
              const response = await axios.post(`${API_URL}/asset-movements`, newMovementData);
              addToast('Movimentação registrada com sucesso!', 'success');
              fetchMovements();
              fetchAssets();
              fetchDashboardData();
              // Retorna o ID da movimentação para o componente pai
              return { success: true, movementId: response.data.movement_id, message: 'Movimentação registrada com sucesso!' };
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao registrar movimentação.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao registrar movimentação:', axiosError);
              return { success: false, message: errorMessage };
            }
          }}
          assets={assets}
          people={people}
          sectors={sectors} // Passa a lista de setores
          handleGenerateMovementReceipt={handleGenerateMovementReceipt} // Passa a função para o modal
        />
      )}

      {/* RENDERIZAÇÃO DO NOVO MODAL */}
      {showReturnByAssetModal && (
        <ReturnByAssetModal
          onClose={() => setShowReturnByAssetModal(false)}
          onSave={async (newMovementData) => {
            try {
              const response = await axios.post(`${API_URL}/asset-movements`, newMovementData);
              // Esta função de 'onSave' é a mesma do modal principal.
              // Ela é genérica o suficiente para ser reutilizada aqui.
              fetchMovements();
              fetchAssets();
              fetchDashboardData();
              return { success: true, movementId: response.data.movement_id, message: 'Movimentação registrada com sucesso!' };
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao registrar movimentação.';
              console.error('Erro ao registrar movimentação:', axiosError);
              return { success: false, message: errorMessage };
            }
          }}
          handleGenerateMovementReceipt={handleGenerateMovementReceipt}
        />
      )}

      {showReturnByUserModal && (
  <ReturnByUserModal
    onClose={() => setShowReturnByUserModal(false)}
    people={people} // Passando a lista de pessoas que já está no estado
    onSave={async (newMovementData) => {
      // A função onSave é a mesma para todos os modais de movimentação.
      // Você pode copiar e colar este bloco de código.
      try {
        const response = await axios.post(`${API_URL}/asset-movements`, newMovementData);
        fetchMovements();
        fetchAssets();
        fetchDashboardData();
        return { success: true, movementId: response.data.movement_id, message: 'Movimentação registrada com sucesso!' };
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao registrar movimentação.';
        console.error('Erro ao registrar movimentação:', axiosError);
        return { success: false, message: errorMessage };
      }
    }}
    handleGenerateMovementReceipt={handleGenerateMovementReceipt}
  />
)}

      {showItemTypeModal && (
        <ItemTypeModal
          onClose={() => { setShowItemTypeModal(false); setEditingItemType(null); }}
          onSave={async (itemTypeData) => {
            try {
              if (editingItemType) {
                await axios.put(`${API_URL}/item-types/${editingItemType.id}`, itemTypeData);
                addToast('Tipo de item atualizado com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/item-types`, itemTypeData);
                addToast('Tipo de item adicionado com sucesso!', 'success');
              }
              fetchItemTypes();
              setShowItemTypeModal(false);
              setEditingItemType(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao salvar tipo de item.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar tipo de item:', axiosError);
            }
          }}
          itemType={editingItemType}
        />
      )}

      {showSectorModal && (
        <SectorModal
          onClose={() => { setShowSectorModal(false); setEditingSector(null); }}
          onSave={async (sectorData) => {
            try {
              if (editingSector) {
                await axios.put(`${API_URL}/sectors/${editingSector.id}`, sectorData);
                addToast('Setor atualizado com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/sectors`, sectorData);
                addToast('Setor adicionado com sucesso!', 'success');
              }
              fetchSectors();
              fetchPeople();
              setShowSectorModal(false);
              setEditingSector(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao salvar setor.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar setor:', axiosError);
            }
          }}
          sector={editingSector}
        />
      )}

      {showAssetModal && (
        <AssetModal
          onClose={() => { setShowAssetModal(false); setEditingAsset(null); }}
          onSave={async (assetData) => {
            try {
              if (editingAsset) {
                await axios.put(`${API_URL}/assets/${editingAsset.id}`, assetData);
                addToast('Ativo atualizado com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/assets`, assetData);
                addToast('Ativo adicionado com sucesso!', 'success');
              }
              fetchAssets();
              fetchDashboardData();
              setShowAssetModal(false);
              setEditingAsset(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao salvar ativo.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar ativo:', axiosError);
            }
          }}
          asset={editingAsset}
          itemTypes={itemTypes}
          sectors={sectors}
        />
      )}

      {/* NOVO: Modal de Pessoas */}
      {showPeopleModal && (
        <PeopleModal
          onClose={() => { setShowPeopleModal(false); setEditingPerson(null); }}
          onSave={async (personData) => {
            try {
              if (editingPerson) {
                await axios.put(`${API_URL}/people/${editingPerson.id}`, personData);
                addToast('Pessoa atualizada com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/people`, personData);
                addToast('Pessoa adicionada com sucesso!', 'success');
              }
              fetchPeople();
              fetchMovements();
              setShowPeopleModal(false);
              setEditingPerson(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao salvar pessoa.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar pessoa:', axiosError);
            }
          }}
          person={editingPerson}
          sectors={sectors}
        />
      )}

      {showUserModal && (
          <UserModal
            userToEdit={editingUser}
            onClose={() => { /* ... */ }}
            // >>> ATUALIZE A LÓGICA DESTA FUNÇÃO onSave <<<
            onSave={async (userData, userId) => {
              try {
                if (userId) {
                  // Lógica de Edição (permanece a mesma)
                  await axios.put(`${API_URL}/users/${userId}`, userData);
                  addToast('Usuário atualizado com sucesso!', 'success');
                } else {
                  // Lógica de Criação (atualizada)
                  const response = await axios.post(`${API_URL}/users/register`, userData);
                  addToast('Usuário registrado com sucesso!', 'success');

                  // Verifica se uma senha foi gerada e a exibe para o admin
                  if (response.data.generatedPassword) {
                    alert(
                      `Usuário criado!\n\nSenha Temporária: ${response.data.generatedPassword}\n\nPor favor, copie esta senha e a envie de forma segura para o novo usuário.`
                    );
                  }
                }
                fetchUsers();
                setShowUserModal(false);
                setEditingUser(null);
              } catch (error: unknown) {
                const axiosError = error as AxiosError<BackendErrorResponse>;
                const errorMessage = axiosError.response?.data?.message || 'Erro ao salvar usuário.';
                addToast(errorMessage, 'error');
              }
            }}
          />
        )}
        {/* Modal para editar o perfil do usuário */}
      {showProfileModal && (
        <ProfileModal
          currentUser={user}
          onClose={() => setShowProfileModal(false)}
          onChangePasswordClick={() => {
            setShowProfileModal(false); // Fecha o modal de perfil
            setShowChangePasswordModal(true); // Abre o modal de senha
          }}
          onSave={async (profileData) => {
            try {
              const response = await axios.put(`${API_URL}/users/me`, profileData);
              addToast('Perfil atualizado com sucesso!', 'success');
              
              const { token: newToken } = response.data;
              localStorage.setItem('token', newToken);

              setShowProfileModal(false);
              window.location.reload();

            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao atualizar o perfil.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      )}
      {/* Modal para alterar a senha do usuário */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowChangePasswordModal(false)}
          onSave={async (passwordData) => {
            try {
              await axios.post(`${API_URL}/users/me/change-password`, passwordData);
              addToast('Senha alterada com sucesso!', 'success');
              setShowChangePasswordModal(false);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao alterar a senha.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      )}

    </div>
  );

  async function handleImport(file: File | null, type: 'item-types' | 'sectors' | 'assets' | 'people') {
  if (!file) {
    addToast('Por favor, selecione um arquivo para importar.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  addToast(`Importando ${type}... Isso pode levar um momento.`, 'info');

  try {
    const response = await axios.post(`${API_URL}/${type}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    addToast(response.data.message || 'Importação concluída com sucesso!', 'success');
    
    // Mostra os erros, se houver
    if(response.data.errors && response.data.errors.length > 0) {
        addToast(`${response.data.errors.length} erros durante a importação. Verifique o console para detalhes.`, 'warning');
        console.warn('Erros de importação:', response.data.errors);
    }
    
    // Atualiza a lista correspondente
    if (type === 'item-types') fetchItemTypes();
    if (type === 'sectors') fetchSectors();
    if (type === 'assets') fetchAssets();
    if (type === 'people') fetchPeople(); // Garanta que esta linha exista

  } catch (error: unknown) {
    const axiosError = error as AxiosError<BackendErrorResponse>;
    const errorMessage = axiosError.response?.data?.message || axiosError.message;
    console.error(`Erro ao importar ${type}:`, axiosError.response?.data || axiosError);
    addToast(`Erro ao importar ${type}: ${errorMessage}`, 'error');
  }
}

  async function handleDownloadReport(reportType: 'assets' | 'people' | 'sectors' | 'item-types', format: string) {
  addToast(`Gerando relatório de ${reportType}...`, 'info');
  try {
    const response = await axios.get(`${API_URL}/reports/${reportType}/${format}`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_${reportType}.${format}`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
    addToast(`Relatório de ${reportType} (${format.toUpperCase()}) gerado com sucesso!`, 'success');
  } catch (error: unknown) {
    const axiosError = error as AxiosError<BackendErrorResponse>;
    const errorMessage = axiosError.response?.data?.message || 'Erro ao gerar relatório.';
    console.error(`Erro ao baixar relatório ${reportType} ${format}:`, axiosError.response?.data || axiosError);
    addToast(`Erro: ${errorMessage}`, 'error');
  }
}
};

// =====================================================================================
// VERSÃO FINAL E COMPLETA: Componente Modal de Movimentação
// =====================================================================================
interface MovementModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<{ success: boolean; movementId?: number; message: string }>;
  assets: Asset[];
  people: Person[];
  sectors: Sector[];
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

// =====================================================================================
// NOVO: Componente Modal de Tipo de Item (FALTANDO)
// =====================================================================================

interface ItemTypeModalProps {
  onClose: () => void;
  onSave: (itemTypeData: { name: string; description?: string }, id?: number) => Promise<void>;
  itemType: ItemType | null; // Se for null, é adição; se for ItemType, é edição
}

const ItemTypeModal = ({ onClose, onSave, itemType }: ItemTypeModalProps) => {
  const [name, setName] = useState<string>(itemType?.name || '');
  const [description, setDescription] = useState<string>(itemType?.description || '');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(
      {
        name,
        description: description || undefined,
      },
      itemType?.id
    );
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {itemType ? 'Editar Tipo de Item' : 'Adicionar Novo Tipo de Item'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome do Tipo</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <div className="border-t pt-4 mt-4">
            <button
              type="button"
              onClick={() => {
                onClose(); // Fecha o modal de perfil
                // Precisamos de uma forma de abrir o modal de senha
                // Vamos passar uma nova função como prop para isso
                (onClose as any).openChangePasswordModal();
              }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Alterar minha senha
            </button>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            {/* ... botões de Cancelar e Salvar ... */}
          </div>
        </form>
      </div>
    </div>
  );
};

const MovementModal = ({ onClose, onSave, assets, people, sectors, handleGenerateMovementReceipt }: MovementModalProps) => {
  // Estados do formulário
  const [movementType, setMovementType] = useState<Movement['movement_type']>('loan');
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [requestChannelType, setRequestChannelType] = useState<'Email' | 'SEI' | 'Ordem Direta' | ''>('');
  const [requestChannelDetails, setRequestChannelDetails] = useState<string>('');
  
  // Estados de busca
  const [patrimonioSearchTerm, setPatrimonioSearchTerm] = useState<string>('');
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [solicitanteSearchTerm, setSolicitanteSearchTerm] = useState<string>('');
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [sectorSearchTerm, setSectorSearchTerm] = useState<string>('');
  const [filteredSectors, setFilteredSectors] = useState<Sector[]>([]);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  
  // Estados de controle do fluxo
  const [loading, setLoading] = useState<boolean>(false);
  const [patrimonioLoading, setPatrimonioLoading] = useState<boolean>(false);
  const [lastMovementId, setLastMovementId] = useState<number | null>(null);
  const [isLockedAfterSave, setIsLockedAfterSave] = useState<boolean>(false);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState<boolean>(false);
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  const canReturnAssets = assets.some(asset => ['in_use', 'loaned', 'maintenance'].includes(asset.status));

  // Função para limpar e resetar o formulário
  const resetForm = () => {
    setMovementType('loan');
    setPurpose('');
    setNotes('');
    setExpectedReturnDate('');
    setRequestChannelType('');
    setRequestChannelDetails('');
    setPatrimonioSearchTerm('');
    setFoundAsset(null);
    setSelectedAssets([]);
    setSolicitanteSearchTerm('');
    setFilteredPeople([]);
    setSelectedPerson(null);
    setSectorSearchTerm('');
    setFilteredSectors([]);
    setSelectedSector(null);
    setLoading(false);
    setLastMovementId(null);
    setIsLockedAfterSave(false);
    addToast('Formulário limpo. Pronto para um novo registro.', 'info');
  };

  // Função que trava o formulário e inicia a etapa de confirmação
  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssets.length === 0) {
      addToast('Adicione ao menos um ativo à movimentação.', 'warning');
      return;
    }
    // Adicione outras validações se necessário (ex: solicitante selecionado)
    if (!selectedPerson) {
      addToast('Por favor, selecione um solicitante.', 'warning');
      return;
    }

    setIsAwaitingConfirmation(true); // Trava o formulário e muda os botões
    addToast('Por favor, confirme os dados antes de registrar.', 'info');
  };

  // Função que executa o salvamento definitivo no backend
  const handleConfirmAndSave = async () => {
    setLoading(true);
    const movementData = {
      asset_ids: selectedAssets.map(asset => asset.id),
      movement_type: movementType,
      recipient_person_id: selectedPerson?.id,
      destination_sector_id: selectedSector?.id,
      purpose: purpose || undefined,
      notes: notes || undefined,
      expected_return_date: expectedReturnDate || undefined,
      request_channel_type: requestChannelType || undefined,
      request_channel_details: requestChannelDetails || undefined,
    };

    const result = await onSave(movementData);
    if (result.success && result.movementId) {
      setLastMovementId(result.movementId);
      // setIsLockedAfterSave(true); // Se você estiver usando este estado
    }
    
    // Sai do modo de confirmação, mesmo se der erro, para permitir nova edição.
    setIsAwaitingConfirmation(false); 
    setLoading(false);
  };
  
  // Função que destrava o formulário para voltar à edição
  const handleEditAgain = () => {
    setIsAwaitingConfirmation(false);
  };

  // Função para travar o formulário
  const handleLockForm = () => {
    setIsLockedAfterSave(true);
    addToast('Edição finalizada. O formulário está travado.', 'success');
  }

  // Função principal de submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (selectedAssets.length === 0) {
      addToast('Adicione ao menos um ativo à movimentação.', 'warning');
      setLoading(false);
      return;
    }
    // ...outras validações...

    const movementData = {
      asset_ids: selectedAssets.map(asset => asset.id),
      movement_type: movementType,
      recipient_person_id: selectedPerson?.id,
      destination_sector_id: selectedSector?.id,
      purpose: purpose || undefined,
      notes: notes || undefined,
      expected_return_date: expectedReturnDate || undefined,
      request_channel_type: requestChannelType || undefined,
      request_channel_details: requestChannelDetails || undefined,
    };

    const result = await onSave(movementData);
    if (result.success && result.movementId) {
      setLastMovementId(result.movementId);
      setIsLockedAfterSave(false);
    }
    setLoading(false);
  };
  
  // Demais funções de manipulação
  const handleSelectPerson = (person: Person) => { setSelectedPerson(person); setSolicitanteSearchTerm(person.full_name); setFilteredPeople([]); };
  const handleSelectSector = (sector: Sector) => { setSelectedSector(sector); setSectorSearchTerm(`${sector.secretariat} - ${sector.sector_name}`); setFilteredSectors([]); };
  const handleSearchAssetByPatrimonio = async () => {
    if (!patrimonioSearchTerm) { addToast('Por favor, insira um número de patrimônio.', 'warning'); return; }
    setPatrimonioLoading(true);
    setFoundAsset(null);
    try {
      const response = await axios.post<Asset>(`${API_URL}/assets/validate-for-movement`, { patrimonio_number: patrimonioSearchTerm, movement_type: movementType });
      setFoundAsset(response.data);
      addToast('Ativo verificado e pronto para inclusão!', 'success');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = axiosError.response?.data?.message ?? 'Erro ao consultar o ativo.';
      addToast(errorMessage, 'error');
      setFoundAsset(null);
    } finally {
      setPatrimonioLoading(false);
    }
  };
  const handleAddAssetToMovement = () => {
    if (foundAsset) {
      if (selectedAssets.some(asset => asset.id === foundAsset.id)) { addToast('Este ativo já foi adicionado.', 'warning'); return; }
      setSelectedAssets((prevAssets) => [...prevAssets, foundAsset]);
      setPatrimonioSearchTerm('');
      setFoundAsset(null);
    } else {
      addToast('Nenhum ativo para adicionar. Consulte um ativo primeiro.', 'warning');
    }
  };
  const handleRemoveAssetFromMovement = (assetId: number) => { setSelectedAssets((prevAssets) => prevAssets.filter((asset) => asset.id !== assetId)); };

  // Efeitos para filtrar listas
  useEffect(() => {
    if (solicitanteSearchTerm.length > 2) { setFilteredPeople( people.filter(p => p.full_name.toLowerCase().includes(solicitanteSearchTerm.toLowerCase()) || p.cpf.includes(solicitanteSearchTerm) || (p.registration_number && p.registration_number.includes(solicitanteSearchTerm))) ); } else { setFilteredPeople([]); }
  }, [solicitanteSearchTerm, people]);
  useEffect(() => {
    if (sectorSearchTerm.length > 2) { setFilteredSectors( sectors.filter(s => s.secretariat.toLowerCase().includes(sectorSearchTerm.toLowerCase()) || s.sector_name.toLowerCase().includes(sectorSearchTerm.toLowerCase())) ); } else { setFilteredSectors([]); }
  }, [sectorSearchTerm, sectors]);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"> <X className="w-6 h-6" /> </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Registrar Nova Movimentação</h2>

        <form onSubmit={handleProceedToConfirmation} className="space-y-6">
          <fieldset disabled={isAwaitingConfirmation || isLockedAfterSave || !!lastMovementId}>
            
            {/* Tipo de Movimentação */}
            <div>
              <label htmlFor="movementType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
              <select id="movementType" value={movementType} onChange={(e) => setMovementType(e.target.value as Movement['movement_type'])} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required>
                <option value="loan">Empréstimo</option>
                <option value="exit">Saída</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </div>

            {/* Dados do Solicitante - SEMPRE VISÍVEL */}
            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Dados do Solicitante</h3>
              <div className="relative">
                <label htmlFor="solicitanteSearch" className="block text-sm font-medium text-gray-700 mb-1">Solicitante (Nome, CPF ou Matrícula)</label>
                <div className="flex">
                  <input type="text" id="solicitanteSearch" value={solicitanteSearchTerm} onChange={(e) => { setSolicitanteSearchTerm(e.target.value); setSelectedPerson(null); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm disabled:bg-gray-100" placeholder="Digite para buscar..." autoComplete="off" />
                  <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-r-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"> <Search className="w-5 h-5" /> </button>
                </div>
                {filteredPeople.length > 0 && ( <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg"> {filteredPeople.map((person) => ( <li key={person.id} onClick={() => handleSelectPerson(person)} className="px-3 py-2 cursor-pointer hover:bg-blue-50">{person.full_name} ({person.cpf})</li> ))} </ul> )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-gray-700">CPF</label><input type="text" value={selectedPerson?.cpf || ''} className="w-full bg-gray-100 p-2 border rounded-md" readOnly /></div>
                <div><label className="text-sm font-medium text-gray-700">E-mail</label><input type="text" value={selectedPerson?.email || ''} className="w-full bg-gray-100 p-2 border rounded-md" readOnly /></div>
                <div><label className="text-sm font-medium text-gray-700">Matrícula</label><input type="text" value={selectedPerson?.registration_number || ''} className="w-full bg-gray-100 p-2 border rounded-md" readOnly /></div>
                <div><label className="text-sm font-medium text-gray-700">Contato</label><input type="text" value={selectedPerson?.email || ''} className="w-full bg-gray-100 p-2 border rounded-md" readOnly /></div>
              </div>
            </div>

            {/* Ativos para Movimentar - SEMPRE VISÍVEL */}
            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Ativos para Movimentar</h3>
              <div>
                <label htmlFor="patrimonioSearchTerm" className="block text-sm font-medium text-gray-700 mb-1">Patrimônio</label>
                <div className="flex space-x-2">
                  <input type="text" id="patrimonioSearchTerm" placeholder="Número de Patrimônio" value={patrimonioSearchTerm} onChange={(e) => setPatrimonioSearchTerm(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                  <button type="button" onClick={handleSearchAssetByPatrimonio} disabled={patrimonioLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 flex items-center disabled:bg-gray-400"> <Search className="w-5 h-5 mr-2" /> {patrimonioLoading ? 'Buscando...' : 'Consultar'} </button>
                  <button type="button" onClick={handleAddAssetToMovement} disabled={!foundAsset} className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400"> Incluir Ativo </button>
                </div>
              </div>
              <h4 className="text-md font-semibold text-gray-700">Ativos na Movimentação ({selectedAssets.length})</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs">Qtd</th><th className="px-4 py-2 text-left text-xs">Tipo</th><th className="px-4 py-2 text-left text-xs">Marca</th><th className="px-4 py-2 text-left text-xs">Modelo</th><th className="px-4 py-2 text-left text-xs">Nº Série</th><th className="px-4 py-2 text-left text-xs">Patrimônio</th><th className="px-4 py-2 text-left text-xs">Ações</th></tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedAssets.length > 0 ? ( selectedAssets.map((asset) => (<tr key={asset.id}><td className="px-4 py-2 text-sm">1</td><td className="px-4 py-2 text-sm">{asset.item_type_name}</td><td className="px-4 py-2 text-sm">{asset.brand}</td><td className="px-4 py-2 text-sm">{asset.model}</td><td className="px-4 py-2 text-sm">{asset.serial_number || 'N/A'}</td><td className="px-4 py-2 text-sm">{asset.patrimonio_number}</td><td className="px-4 py-2 text-sm"><button type="button" onClick={() => handleRemoveAssetFromMovement(asset.id)} className="text-red-600 hover:text-red-800 disabled:text-gray-400"><Trash2 className="w-4 h-4" /></button></td></tr>))
                    ) : (<tr><td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-500">Nenhum ativo adicionado.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CAMPOS CONDICIONAIS */}
            {movementType === 'return' ? (
              // LAYOUT SIMPLIFICADO PARA DEVOLUÇÃO
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="actualReturnDate" className="block text-sm font-medium text-gray-700">Data da Devolução</label>
                    <input type="date" id="actualReturnDate" value={new Date().toISOString().split('T')[0]} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100" readOnly/>
                  </div>
                 <div className="md:col-span-2">
                    <label htmlFor="notesReturn" className="block text-sm font-medium text-gray-700 mb-1">Observação (Opcional)</label>
                    <textarea id="notesReturn" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea>
                 </div>
              </div>
            ) : (
              // LAYOUT COMPLETO PARA OUTRAS MOVIMENTAÇÕES
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Setor de Destino</label>
                    <div className="relative">
                      <div className="flex">
                        <input type="text" value={sectorSearchTerm} onChange={(e) => { setSectorSearchTerm(e.target.value); setSelectedSector(null); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm disabled:bg-gray-100" placeholder="Buscar Secretaria ou Setor..." autoComplete="off" />
                        <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-r-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"> <Search className="w-5 h-5" /> </button>
                      </div>
                      {filteredSectors.length > 0 && (<ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">{filteredSectors.map((sector) => (<li key={sector.id} onClick={() => handleSelectSector(sector)} className="px-3 py-2 cursor-pointer hover:bg-blue-50">{sector.secretariat} - {sector.sector_name}</li>))}</ul>)}
                    </div>
                    {selectedSector && (<div className="mt-2 p-2 bg-gray-100 border rounded-md text-sm"><p><b>Secretaria:</b> {selectedSector.secretariat}</p><p><b>Executiva:</b> {selectedSector.executive || 'N/A'}</p></div>)}
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="requestChannelType" className="block text-sm font-medium text-gray-700">Canal de Solicitação</label>
                      <select id="requestChannelType" value={requestChannelType} onChange={(e) => { setRequestChannelType(e.target.value as any); setRequestChannelDetails(''); }} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"> <option value="">Selecione...</option> <option value="Email">E-mail</option> <option value="SEI">SEI</option> <option value="Ordem Direta">Ordem Direta</option> </select>
                      {requestChannelType === 'SEI' ? (<InputMask mask="99.999999/9999-99" value={requestChannelDetails} onChange={(e) => setRequestChannelDetails(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" placeholder="Número do SEI" className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required />}</InputMask>) : requestChannelType === 'Ordem Direta' && (<input type="text" placeholder="Nome e Cargo" value={requestChannelDetails} onChange={(e) => setRequestChannelDetails(e.target.value)} className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required />)}
                    </div>
                    <div>
                      <label htmlFor="expectedReturnDate" className="block text-sm font-medium text-gray-700">Data Prevista Para Devolução</label>
                      <input type="date" id="expectedReturnDate" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required={movementType === 'loan'} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">Finalidade</label><textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea></div>
                  <div><label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observação</label><textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea></div>
                </div>
              </>
            )}
          </fieldset>

          {/* DIV DE BOTÕES */}
          <div className="flex justify-end space-x-3 pt-4">
            
            {/* Estado 1: Edição Inicial (antes da revisão) */}
            {!isAwaitingConfirmation && !lastMovementId && (
              <>
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Cancelar</button>
                <button 
                  type="submit" // Este submit aciona o onSubmit do form, que chama handleProceedToConfirmation
                  className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800"
                >
                  Revisar para Registrar
                </button>
              </>
            )}

            {/* Estado 2: Aguardando Confirmação (tela de revisão) */}
            {isAwaitingConfirmation && !lastMovementId && (
              <>
                <button 
                  type="button" 
                  onClick={handleEditAgain} // Conecta à função de voltar para edição
                  disabled={loading} 
                  className="px-6 py-2 bg-yellow-500 text-white rounded-lg shadow-sm hover:bg-yellow-600 disabled:opacity-50"
                >
                  <Edit className="w-5 h-5 mr-2 inline-block" /> Editar
                </button>
                <button 
                  type="button" 
                  onClick={handleConfirmAndSave} // Conecta à função de salvamento definitivo
                  disabled={loading} 
                  className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Registrando...' : <><CheckCircle className="w-5 h-5 mr-2 inline-block" /> Confirmar e Registrar</>}
                </button>
              </>
            )}
            
            {/* Estado 3: Registro Concluído (após o salvamento) */}
            {lastMovementId && (
              <>
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Fechar</button>
                <button 
                  type="button" 
                  onClick={() => handleGenerateMovementReceipt(lastMovementId)} 
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center"
                >
                  <FileText className="w-5 h-5 mr-2" /> Gerar Recibo
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// Componente Modal de Setor (Mantido)
// =====================================================================================

interface SectorModalProps {
  onClose: () => void;
  onSave: (sectorData: { secretariat: string; executive?: string; sector_name: string; address?: string; contact_phone?: string }, id?: number) => Promise<void>;
  sector: Sector | null; // Se for null, é adição; se for Sector, é edição
}

const SectorModal = ({ onClose, onSave, sector }: SectorModalProps) => {
  const [secretariat, setSecretariat] = useState<string>(sector?.secretariat || '');
  const [executive, setExecutive] = useState<string>(sector?.executive || '');
  const [sectorName, setSectorName] = useState<string>(sector?.sector_name || '');
  const [address, setAddress] = useState<string>(sector?.address || '');
  const [contactPhone, setContactPhone] = useState<string>(sector?.contact_phone || '');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(
      {
        secretariat,
        executive: executive || undefined,
        sector_name: sectorName,
        address: address || undefined,
        contact_phone: contactPhone || undefined,
      },
      sector?.id
    );
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {sector ? 'Editar Setor' : 'Adicionar Novo Setor'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="secretariat" className="block text-sm font-medium text-gray-700 mb-1">Secretaria</label>
            <input
              type="text"
              id="secretariat"
              value={secretariat}
              onChange={(e) => setSecretariat(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="executive" className="block text-sm font-medium text-gray-700 mb-1">Executiva (Opcional)</label>
            <input
              type="text"
              id="executive"
              value={executive}
              onChange={(e) => setExecutive(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="sectorName" className="block text-sm font-medium text-gray-700 mb-1">Nome do Setor</label>
            <input
              type="text"
              id="sectorName"
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Endereço (Opcional)</label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>
          <div>
            <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">Telefone de Contato (Opcional)</label>
            <input
              type="text"
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// Componente Modal de Ativo (Mantido)
// =====================================================================================

interface AssetModalProps {
  onClose: () => void;
  onSave: (assetData: Omit<Asset, 'id' | 'sku' | 'item_type_name' | 'current_sector_name' | 'current_sector_secretariat' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  asset: Asset | null; // Se for null, é adição; se for Asset, é edição
  itemTypes: ItemType[]; // Lista de tipos de itens para o dropdown
  sectors: Sector[]; // Lista de setores para o dropdown
}

const AssetModal = ({ onClose, onSave, asset, itemTypes, sectors }: AssetModalProps) => {
  const [itemTypeId, setItemTypeId] = useState<string>(asset?.item_type_id?.toString() || '');
  const [brand, setBrand] = useState<string>(asset?.brand || '');
  const [model, setModel] = useState<string>(asset?.model || '');
  const [description, setDescription] = useState<string>(asset?.description || '');
  const [serialNumber, setSerialNumber] = useState<string>(asset?.serial_number || '');
  const [patrimonioNumber, setPatrimonioNumber] = useState<string>(asset?.patrimonio_number || '');
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>(asset?.unit_of_measure || '');
  const [status, setStatus] = useState<string>(asset?.status || 'available');
  const [currentSectorId, setCurrentSectorId] = useState<string>(asset?.current_sector_id?.toString() || '');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(asset?.acquisition_date || '');
  const [warrantyEndDate, setWarrantyEndDate] = useState<string>(asset?.warranty_end_date || '');
  const [notes, setNotes] = useState<string>(asset?.notes || '');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const assetData = {
      item_type_id: parseInt(itemTypeId),
      brand,
      model,
      description: description || undefined,
      serial_number: serialNumber || undefined,
      patrimonio_number: patrimonioNumber || undefined,
      unit_of_measure: unitOfMeasure || undefined,
      status,
      current_sector_id: currentSectorId ? parseInt(currentSectorId) : undefined,
      acquisition_date: acquisitionDate || undefined,
      warranty_end_date: warrantyEndDate || undefined,
      notes: notes || undefined,
    };

    await onSave(assetData, asset?.id);
    setLoading(false);
  };

  const assetStatuses = ['available', 'in_use', 'loaned', 'maintenance', 'retired', 'disposed'];

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {asset ? 'Editar Ativo' : 'Adicionar Novo Ativo'}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="itemTypeId" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Item</label>
            <select
              id="itemTypeId"
              value={itemTypeId}
              onChange={(e) => setItemTypeId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Selecione um tipo de item</option>
              {itemTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <input
              type="text"
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
            <input
              type="text"
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              {assetStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} {/* Formata para leitura */}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>
          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">Número de Série</label>
            <input
              type="text"
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="patrimonioNumber" className="block text-sm font-medium text-gray-700 mb-1">Número de Patrimônio</label>
            <input
              type="text"
              id="patrimonioNumber"
              value={patrimonioNumber}
              onChange={(e) => setPatrimonioNumber(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="unitOfMeasure" className="block text-sm font-medium text-gray-700 mb-1">Unidade de Medida</label>
            <input
              type="text"
              id="unitOfMeasure"
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="currentSectorId" className="block text-sm font-medium text-gray-700 mb-1">Setor Atual (Opcional)</label>
            <select
              id="currentSectorId"
              value={currentSectorId}
              onChange={(e) => setCurrentSectorId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Selecione um setor</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.secretariat} - {sector.sector_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acquisitionDate" className="block text-sm font-medium text-gray-700 mb-1">Data de Aquisição (Opcional)</label>
            <input
              type="date"
              id="acquisitionDate"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="warrantyEndDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim da Garantia (Opcional)</label>
            <input
              type="date"
              id="warrantyEndDate"
              value={warrantyEndDate}
              onChange={(e) => setWarrantyEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>

          <div className="md:col-span-2 flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Ativo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// ATUALIZADO: Componente Modal de Usuários
// =====================================================================================

interface UserModalProps {
  onClose: () => void;
  onSave: (userData: any, userId?: number) => Promise<void>;
  userToEdit: User | null;
}

const UserModal = ({ onClose, onSave, userToEdit }: UserModalProps) => {
  const { addToast } = useToast();
  const [username, setUsername] = useState(userToEdit?.username || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [fullName, setFullName] = useState(userToEdit?.full_name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'basic'>(userToEdit?.role || 'basic');
  const [loading, setLoading] = useState(false);

  const isEditing = !!userToEdit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A verificação de senha agora é feita no backend
    setLoading(true);
    const userData = {
        username,
        email,
        full_name: fullName,
        role,
        ...(password && { password }),
    };
    await onSave(userData, userToEdit?.id);
    setLoading(false);
  };

  // >>> CORREÇÃO: Adicionando a declaração 'return' <<<
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {isEditing ? 'Editar Usuário' : 'Adicionar Novo Usuário'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Senha {isEditing ? <span className="text-xs text-gray-500">(Deixe em branco para não alterar)</span> : <span className="text-xs text-gray-500">(Opcional, será gerada se vazia)</span>}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Perfil de Acesso</label>
            <select value={role} onChange={e => setRole(e.target.value as any)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
              <option value="basic">Básico</option>
              <option value="manager">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// ATUALIZADO: Componente Modal de Auditoria
// =====================================================================================

const AuditLogPage = ({ logs }: { logs: AuditLog[] }) => {
  const formatJsonDetails = (details: any) => {
    if (!details) return 'N/A';
    // Formata o JSON para ser mais legível
    return JSON.stringify(details, null, 2);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Logs de Auditoria do Sistema</h1>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Últimas Ações Registradas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">Data e Hora</th>
                <th scope="col" className="px-6 py-3">Usuário</th>
                <th scope="col" className="px-6 py-3">Ação</th>
                <th scope="col" className="px-6 py-3">Entidade</th>
                <th scope="col" className="px-6 py-3">Endereço IP</th>
                <th scope="col" className="px-6 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4">{log.user_name || log.username || 'Sistema'}</td>
                  <td className="px-6 py-4">{log.action_type.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4">{log.target_entity || 'N/A'}</td>
                  <td className="px-6 py-4">{log.ip_address}</td>
                  <td className="px-6 py-4">
                    <pre className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap break-all">
                      {formatJsonDetails(log.details)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =====================================================================================
// ATUALIZADO: Componente Modal de Pessoa
// =====================================================================================
interface PeopleModalProps {
  onClose: () => void;
  onSave: (personData: Omit<Person, 'id' | 'secretariat' | 'executive' | 'sector_name' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  person: Person | null;
  sectors: Sector[];
}

const PeopleModal = ({ onClose, onSave, person, sectors }: PeopleModalProps) => {
  const [fullName, setFullName] = useState<string>(person?.full_name || '');
  const [sectorId, setSectorId] = useState<string>(person?.sector_id?.toString() || '');
  const [registrationNumber, setRegistrationNumber] = useState<string>(person?.registration_number || '');
  const [cpf, setCpf] = useState<string>(person?.cpf || '');
  const [email, setEmail] = useState<string>(person?.email || '');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const personData = {
      full_name: fullName,
      sector_id: sectorId ? parseInt(sectorId) : undefined,
      registration_number: registrationNumber || undefined,
      cpf,
      email,
    };

    await onSave(personData, person?.id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {person ? 'Editar Pessoa' : 'Adicionar Nova Pessoa'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ... (Campos Nome, CPF, Email permanecem os mesmos) ... */}
           <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <input
              type="text"
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          
          {/* ATUALIZADO: Campo Matrícula com máscara */}
          <div>
            <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Opcional)</label>
            <InputMask
                mask="999.999-99"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
            >
                {(inputProps: any) => <input {...inputProps} type="text" id="registrationNumber" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />}
            </InputMask>
          </div>

          {/* ... (Campo Setor e botões permanecem os mesmos) ... */}
           <div>
            <label htmlFor="sectorId" className="block text-sm font-medium text-gray-700 mb-1">Setor (Opcional)</label>
            <select
              id="sectorId"
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Selecione um setor</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.secretariat} - {sector.sector_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Pessoa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Arquivo: App.tsx

// =====================================================================================
// NOVO: Componente Modal de Devolução por Ativo
// =====================================================================================
interface ReturnByAssetModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<{ success: boolean; movementId?: number; message: string }>;
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

const ReturnByAssetModal = ({ onClose, onSave, handleGenerateMovementReceipt }: ReturnByAssetModalProps) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ asset: Asset; person: Person } | null>(null);
  const [isReturned, setIsReturned] = useState(false);
  const [movementId, setMovementId] = useState<number | null>(null);
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  const handleSearch = async () => {
    if (!identifier) {
      setError('Por favor, insira um número de patrimônio ou série.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await axios.post(`${API_URL}/assets/find-for-return`, { identifier });
      setResult(response.data);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<BackendErrorResponse>;
      const errorMessage = axiosError.response?.data?.message ?? 'Ocorreu um erro desconhecido.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!result) return;
    setLoading(true);

    const movementData = {
      asset_ids: [result.asset.id],
      movement_type: 'return',
      recipient_person_id: result.person.id,
      notes: `Devolução realizada via consulta de ativo (${identifier}).`
    };

    const saveResult = await onSave(movementData);
    if (saveResult.success && saveResult.movementId) {
      addToast('Devolução registrada com sucesso!', 'success');
      setIsReturned(true);
      setMovementId(saveResult.movementId);
    } else {
      addToast(saveResult.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" disabled={loading}>
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Devolução por Ativo</h2>

        {!isReturned ? (
          <>
            <div className="space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">Patrimônio ou Nº de Série</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="Digite o identificador do ativo"
                  />
                  <button onClick={handleSearch} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 flex items-center disabled:opacity-50">
                    <Search className="w-5 h-5 mr-2" /> {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </div>

              {result && (
                <div className="mt-6 border-t pt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Ativo Encontrado</h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg border grid grid-cols-2 gap-4">
                      <p><strong className="text-gray-600">Patrimônio:</strong> {result.asset.patrimonio_number}</p>
                      <p><strong className="text-gray-600">Nº Série:</strong> {result.asset.serial_number}</p>
                      <p><strong className="text-gray-600">Tipo:</strong> {result.asset.item_type_name}</p>
                      <p><strong className="text-gray-600">Marca/Modelo:</strong> {result.asset.brand} {result.asset.model}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Responsável Atual</h3>
                    <div className="mt-2 p-4 bg-yellow-50 rounded-lg border border-yellow-200 grid grid-cols-2 gap-4">
                      <p><strong className="text-gray-600">Nome:</strong> {result.person.full_name}</p>
                      <p><strong className="text-gray-600">CPF:</strong> {result.person.cpf}</p>
                      <p className="col-span-2"><strong className="text-gray-600">Email:</strong> {result.person.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button onClick={onClose} disabled={loading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                Cancelar
              </button>
              <button onClick={handleConfirmReturn} disabled={!result || loading} className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Processando...' : 'Confirmar Devolução'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">Devolução Registrada!</h3>
            <p className="text-gray-600 mt-2">O ativo foi devolvido com sucesso e já está disponível no almoxarifado.</p>
            <div className="flex justify-center space-x-3 mt-8">
               <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                Fechar
              </button>
              {movementId && (
                <button onClick={() => handleGenerateMovementReceipt(movementId)} className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center">
                  <FileText className="w-5 h-5 mr-2" /> Gerar Recibo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================================================
// NOVO: Componente Modal de Devolução por Usuário
// =====================================================================================
interface ReturnByUserModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<{ success: boolean; movementId?: number; message: string }>;
  people: Person[];
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

const ReturnByUserModal = ({ onClose, onSave, people, handleGenerateMovementReceipt }: ReturnByUserModalProps) => {
  const [solicitanteSearchTerm, setSolicitanteSearchTerm] = useState<string>('');
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [assetsOfPerson, setAssetsOfPerson] = useState<Asset[]>([]);
  const [personAssetsLoading, setPersonAssetsLoading] = useState<boolean>(false);
  const [selectedReturnAssetIds, setSelectedReturnAssetIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [lastMovementId, setLastMovementId] = useState<number | null>(null);
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  const fetchAssetsOfPerson = useCallback(async (personId: number) => {
    setPersonAssetsLoading(true);
    setAssetsOfPerson([]);
    try {
      const response = await axios.get<Asset[]>(`${API_URL}/people/${personId}/assets`);
      setAssetsOfPerson(response.data);
      if (response.data.length === 0) {
        addToast('Este solicitante não possui ativos pendentes de devolução.', 'info');
      }
    } catch (error) {
      addToast('Erro ao buscar os ativos do solicitante.', 'error');
    } finally {
      setPersonAssetsLoading(false);
    }
  }, [API_URL, addToast]);

  useEffect(() => {
    if (selectedPerson) {
      fetchAssetsOfPerson(selectedPerson.id);
    } else {
      setAssetsOfPerson([]);
    }
  }, [selectedPerson, fetchAssetsOfPerson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const assetIdsToMove = Array.from(selectedReturnAssetIds);
    if (assetIdsToMove.length === 0) {
      addToast('Selecione ao menos um ativo para devolver.', 'warning');
      setLoading(false);
      return;
    }
    const movementData = {
      asset_ids: assetIdsToMove,
      movement_type: 'return',
      recipient_person_id: selectedPerson?.id,
    };
    const result = await onSave(movementData);
    if (result.success && result.movementId) {
      setLastMovementId(result.movementId);
    }
    setLoading(false);
  };

  const handleToggleReturnAsset = (assetId: number) => {
    setSelectedReturnAssetIds(prev => {
      const newSet = new Set(prev);
      newSet.has(assetId) ? newSet.delete(assetId) : newSet.add(assetId);
      return newSet;
    });
  };

  const handleToggleSelectAllReturnAssets = () => {
    if (selectedReturnAssetIds.size === assetsOfPerson.length) {
      setSelectedReturnAssetIds(new Set());
    } else {
      setSelectedReturnAssetIds(new Set(assetsOfPerson.map(asset => asset.id)));
    }
  };

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    setSolicitanteSearchTerm(person.full_name);
    setFilteredPeople([]);
  };

  useEffect(() => {
    if (solicitanteSearchTerm.length > 2) {
      setFilteredPeople(people.filter(p => p.full_name.toLowerCase().includes(solicitanteSearchTerm.toLowerCase()) || p.cpf.includes(solicitanteSearchTerm) || (p.registration_number && p.registration_number.includes(solicitanteSearchTerm))));
    } else {
      setFilteredPeople([]);
    }
  }, [solicitanteSearchTerm, people]);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" disabled={loading}>
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Devolução por Usuário</h2>
        
        {!lastMovementId ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label htmlFor="solicitanteSearch" className="block text-sm font-medium text-gray-700 mb-1">Buscar Solicitante (Nome, CPF ou Matrícula)</label>
              <input type="text" id="solicitanteSearch" value={solicitanteSearchTerm} onChange={(e) => { setSolicitanteSearchTerm(e.target.value); setSelectedPerson(null); }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="Digite para buscar..." autoComplete="off" />
              {filteredPeople.length > 0 && (<ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">{filteredPeople.map((person) => (<li key={person.id} onClick={() => handleSelectPerson(person)} className="px-3 py-2 cursor-pointer hover:bg-blue-50">{person.full_name} ({person.cpf})</li>))}</ul>)}
            </div>

            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Ativos do Solicitante</h3>
              {personAssetsLoading && <p className="text-center text-blue-600">Buscando ativos...</p>}
              {!personAssetsLoading && assetsOfPerson.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs"><input type="checkbox" className="rounded" checked={assetsOfPerson.length > 0 && selectedReturnAssetIds.size === assetsOfPerson.length} onChange={handleToggleSelectAllReturnAssets} /></th>
                        <th className="px-4 py-2 text-left text-xs">SKU</th>
                        <th className="px-4 py-2 text-left text-xs">Tipo</th>
                        <th className="px-4 py-2 text-left text-xs">Marca/Modelo</th>
                        <th className="px-4 py-2 text-left text-xs">Patrimônio</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assetsOfPerson.map((asset) => (
                        <tr key={asset.id} className={selectedReturnAssetIds.has(asset.id) ? 'bg-blue-50' : ''}>
                          <td className="px-4 py-2 text-sm"><input type="checkbox" className="rounded" checked={selectedReturnAssetIds.has(asset.id)} onChange={() => handleToggleReturnAsset(asset.id)} /></td>
                          <td className="px-4 py-2 text-sm">{asset.sku}</td>
                          <td className="px-4 py-2 text-sm">{asset.item_type_name}</td>
                          <td className="px-4 py-2 text-sm">{asset.brand} {asset.model}</td>
                          <td className="px-4 py-2 text-sm">{asset.patrimonio_number || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!personAssetsLoading && !selectedPerson && (<p className="text-center text-gray-500 py-4">Selecione um solicitante para listar os ativos.</p>)}
              {!personAssetsLoading && selectedPerson && assetsOfPerson.length === 0 && (<p className="text-center text-gray-500 py-4">Nenhum ativo pendente encontrado para este solicitante.</p>)}
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
              <button type="submit" disabled={loading || selectedReturnAssetIds.size === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Processando...' : `Devolver ${selectedReturnAssetIds.size} Iten(s)`}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">Devolução Registrada!</h3>
            <p className="text-gray-600 mt-2">Os itens foram devolvidos com sucesso.</p>
            <div className="flex justify-center space-x-3 mt-8">
              <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Fechar</button>
              {lastMovementId && (<button onClick={() => handleGenerateMovementReceipt(lastMovementId)} className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center"><FileText className="w-5 h-5 mr-2" /> Gerar Recibo</button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================================================
// NOVO: Componente da Página de Devoluções
// =====================================================================================
interface ReturnsPageProps {
  onStartReturnByUser: () => void;
  onStartReturnByAsset: () => void;
}

const ReturnsPage = ({ onStartReturnByUser, onStartReturnByAsset }: ReturnsPageProps) => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Central de Devoluções</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Opção 1: Devolução por Usuário */}
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 flex flex-col items-center text-center">
          <Users className="w-16 h-16 text-blue-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Devolução por Usuário</h2>
          <p className="text-gray-600 mt-2 mb-6">
            Ideal para quando o solicitante está presente. Busque pelo nome, CPF ou matrícula para ver e devolver todos os seus ativos.
          </p>
          <button
            onClick={onStartReturnByUser}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
          >
            <Search className="w-5 h-5 mr-2" /> Iniciar Devolução por Usuário
          </button>
        </div>

        {/* Opção 2: Devolução por Ativo */}
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 flex flex-col items-center text-center">
          <HardDrive className="w-16 h-16 text-teal-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Devolução por Ativo</h2>
          <p className="text-gray-600 mt-2 mb-6">
            Use esta opção quando você tem o equipamento em mãos, mas não sabe quem é o responsável. Consulte pelo patrimônio ou nº de série.
          </p>
          <button
            onClick={onStartReturnByAsset}
            className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-teal-700 flex items-center justify-center transition-colors duration-200"
          >
            <CornerUpLeft className="w-5 h-5 mr-2" /> Iniciar Devolução por Ativo
          </button>
        </div>
      </div>
    </div>
  );
};

// >>> NOVO COMPONENTE DE MODAL ALTERAÇÃO DE SENHA <<<
interface ChangePasswordModalProps {
  onClose: () => void;
  onSave: (passwordData: any) => Promise<void>;
}

const ChangePasswordModal = ({ onClose, onSave }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('A nova senha e a confirmação não correspondem.', 'error');
      return;
    }
    setLoading(true);
    await onSave({ currentPassword, newPassword, confirmPassword });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1002] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Alterar Senha</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha Atual</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nova Senha</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// >>> COMPONENTE DE MODAL PROFILE <<<
interface ProfileModalProps {
  onClose: () => void;
  onSave: (profileData: any) => Promise<void>;
  currentUser: User | null;
  onChangePasswordClick: () => void; // Nova prop para chamar o modal de senha
}

const ProfileModal = ({ onClose, onSave, currentUser, onChangePasswordClick }: ProfileModalProps) => {
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({ full_name: fullName, username, email });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Meu Perfil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          
          {/* Botão para abrir o modal de alterar senha */}
          <div className="border-t pt-4 mt-4">
            <button
              type="button"
              onClick={onChangePasswordClick}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Alterar minha senha
            </button>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// Arquivo: App.tsx

// >>>  NOVO COMPONENTE DE PÁGINA - Tela de Troca Obrigatória de Senha <<<
const ForcedChangePasswordPage = () => {
  // Pegamos as funções que precisamos do contexto
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Alteração de Senha Obrigatória</h1>
        <p className="text-gray-600">Por segurança, você precisa definir uma nova senha para continuar.</p>
      </div>
      {/* Reutilizamos o modal de troca de senha, mas sem o botão de fechar */}
      <div className="w-full max-w-md">
        <ChangePasswordModal
          onClose={() => {}} // Não faz nada, impedindo o fechamento
          onSave={async (passwordData) => {
            try {
              await axios.post(`${API_URL}/users/me/change-password`, passwordData);
              addToast('Senha alterada com sucesso! Você será redirecionado.', 'success');
              // Recarrega a aplicação após 2 segundos
              setTimeout(() => window.location.reload(), 2000);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao alterar a senha.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      </div>
    </div>
  );
};

// Componente principal da aplicação
const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

const AppContent = () => {
  const { user, loading } = useContext(AuthContext) as AuthContextType;

  if (loading) {
    // ... (tela de loading permanece a mesma)
  }

  // Se o usuário está logado E precisa trocar a senha, mostra a página de troca obrigatória
  if (user && user.must_change_password) {
    return <ForcedChangePasswordPage />;
  }

  // Se o usuário está logado E não precisa trocar a senha, mostra o Dashboard
  if (user) {
    return <DashboardPage />;
  }

  // Se não há usuário, mostra a página de Login
  return <LoginPage />;
};

export default App;

