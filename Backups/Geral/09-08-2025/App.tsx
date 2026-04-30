import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import InputMask from 'react-input-mask';
import {
  Mail, Lock, LogIn, Menu, X, LayoutDashboard, HardDrive, BarChart2, Bell, Settings, LogOut,
  Box, CornerDownRight, CornerUpLeft, Calendar, List, PlusCircle, UploadCloud, Edit, Trash2,
  CheckCircle, XCircle, Info, AlertTriangle as AlertTriangleIcon, Repeat, FileText, Users, 
  Search, Archive, ArrowRightLeft, ChevronDown, History, UserCircle, Save, ArrowDownCircle // Adicionado Users e Search para pessoas e busca
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios, { AxiosError } from 'axios';
import logoSGA from './assets/images/logo-sga-azul.png'; // Ajuste o caminho se necessário
import MovementQueryPage from './components/MovementQueryPage'; // Importa o novo componente
import DeliveryConfirmationPage from './components/DeliveryConfirmationPage';
import ConfirmationModal from './components/ConfirmationModal';
import ImportResultModal from './components/ImportResultModal';
import LoanRenewalModal from './components/LoanRenewalModal';
import LoanRenewalPage from './components/LoanRenewalPage';
import SubstitutionModal from './components/SubstitutionModal';
import ReturnConfirmationModal from './components/ReturnConfirmationModal';
import RetireAssetModal from './components/RetireAssetModal';
import DisposeAssetModal from './components/DisposeAssetModal';
import AssetManagementPage from './components/AssetManagementPage';
import RetirementAndDisposalPage from './components/RetirementAndDisposalPage';
import QueryHubPage from './components/QueryHubPage';
import UnitForm from './components/UnitForm';
import ParentUnitModal from './components/ParentUnitModal';
import Select from 'react-select';

const translateActionType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      // Ações de Autenticação
      'login_success': 'Login Bem-Sucedido',
      'login_failed': 'Falha no Login',
      'logout': 'Logout',
      
      // Ações de Usuário
      'user_created': 'Criação de Usuário',
      'update_user_success': 'Atualização de Usuário',
      'delete_user_success': 'Exclusão de Usuário',
      'password_change_success': 'Alteração de Senha',

      // Ações de Movimentação
      'create_movement_loan': 'Criação de Empréstimo',
      'create_movement_exit': 'Criação de Saída',
      'create_movement_return': 'Criação de Devolução',
      'confirm_delivery': 'Confirmação de Entrega',
      'renew_loan': 'Renovação de Empréstimo',
      'asset_substitution': 'Substituição de Ativo',
      'asset_kit_substitution': 'Substituição de Kit',

      // Ações de Ativos
      'create_asset': 'Criação de Ativo',
      'update_asset': 'Atualização de Ativo',
      'delete_asset': 'Exclusão de Ativo',
      'retire_asset': 'Baixa de Ativo',
      'dispose_asset': 'Descarte de Ativo',
      'import_assets': 'Importação de Ativos',

      // Ações de Baixa/Descarte (Processo Novo)
      'request_retirement': 'Solicitação de Baixa',
      'approve_retirement': 'Aprovação de Baixa',
      'reject_retirement': 'Rejeição de Baixa',

      // Ações Genéricas
      'unauthorized_access': 'Acesso Não Autorizado',
      'generate_report': 'Geração de Relatório',
    };
    return typeMap[type] || type.replace(/_/g, ' '); // Se não encontrar, formata o original
  };


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
  is_active?: boolean;
}

// Interface para os dados da unidade, para ajudar com o TypeScript
interface UnitData {
    type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA' | '';
    name: string;
    code?: string;
    parent_id?: number | null;
    status: string;
    address?: string;
    contact_phone?: string;
    contact_email?: string;
    notes?: string;
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
  expiringWarranties: { count: number; description: string; endDate: string; daysRemaining: number }[];
}

// Interface para Tipos de Itens
interface ItemType {
  id: number;
  code: string;
  name: string;
  description?: string;
  sku_code?: string;
}

// Interface para Unidades
export interface Unit {
  id: number;
  type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA';
  name: string;
  code?: string;
  parent_id?: number | null;
  status: string; 
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
  current_assets_count?: number;
}

// Interface para Ativos (ATUALIZADA com campos para consulta)
export interface Asset {
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
  current_unit_id?: number; // Renomeado
  acquisition_date?: string;
  warranty_end_date?: string;
  notes?: string;
  item_type_name: string;
  current_unit_name?: string; // Renomeado
}

// Interface para Pessoas
export interface Person {
  id: number;
  full_name: string;
  unit_id?: number; // Renomeado
  registration_number?: string;
  cpf: string;
  email: string;
  contact_phone?: string;
  unit_name?: string; // Adicionado para clareza (nome da unidade da pessoa)
  current_assets_count?: number;
  job_title?: string;
}

// Interface para Movimentações (ATUALIZADA com campos de pessoa e novos campos)
export interface Movement {
  id: number;
  movement_id?: number;
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
  destination_unit_id?: number; // Renomeado
  destination_unit_name?: string; // Renomeado (do JOIN)
  request_channel_type?: 'Email' | 'SEI' | 'Ordem Direta'; // NOVO
  request_channel_details?: string; // NOVO
  total_assets_moved?: number; // Para o totalizador
  recipient_display_name?: string;
  delivery_status?: 'pending_confirmation' | 'confirmed';
  peripherals?: Peripheral[];
}

export interface Peripheral {
  peripheral_type: string;
  quantity: number;
  status: 'out' | 'returned' | 'in';
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

export const useToast = () => {
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

export const AuthContext = createContext<AuthContextType | null>(null);

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
            className="h-40 w-auto rounded-lg shadow-md"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/150x80/007bff/ffffff?text=Logo'; }}
          />
        </div>

        <h2 className="text-3xl font-extrabold text-center text-blue-900 mt-8 mb-8 tracking-tight">
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
                <th scope="col" className="px-6 py-3">Email</th>
                <th scope="col" className="px-6 py-3">Perfil</th>
                <th scope="col" className="px-6 py-3">Status</th> {/* <<< NOVA COLUNA */}
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                  <td scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{user.full_name}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">{user.role}</td>
                  <td className="px-6 py-4">
                    {/* <<< TAG DE STATUS VISUAL >>> */}
                    <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEditUser(user)}
                      className="font-medium text-blue-600 hover:underline mr-4"
                      title="Editar Usuário"
                    >
                      <Edit className="w-5 h-5"/>
                    </button>
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
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prevKey => prevKey + 1);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [openMenu, setOpenMenu] = useState<string | null>('cadastros'); // Inicia com o menu 'cadastros' aberto
  const { user, logout, API_URL, loading: authLoading } = useContext(AuthContext) as AuthContextType;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<Movement[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]); // NOVO: Estado para pessoas
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [showItemTypeModal, setShowItemTypeModal] = useState<boolean>(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState<boolean>(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isParentUnitModalOpen, setIsParentUnitModalOpen] = useState(false);
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
  const [filters, setFilters] = useState({ solicitante: '', patrimonio: '', cpf: '', matricula: '', movementType: '', startDate: '', endDate: '' });
  const [isReportButtonEnabled, setIsReportButtonEnabled] = useState(false);
  const [lastAppliedFilters, setLastAppliedFilters] = useState({});
  const [selectedMovementForConfirmation, setSelectedMovementForConfirmation] = useState<Movement | null>(null);
  const [movementToRenew, setMovementToRenew] = useState<Movement | null>(null);
  const [movementToSubstitute, setMovementToSubstitute] = useState<Movement | null>(null);
  const [substitutionOldAssetId, setSubstitutionOldAssetId] = useState<number | null>(null);
  const [movementToReturn, setMovementToReturn] = useState<Movement | null>(null);
  const [detailedMovementToReturn, setDetailedMovementToReturn] = useState<Movement | null>(null);
  const [assetToRetire, setAssetToRetire] = useState<Asset | null>(null);
  const [assetToDispose, setAssetToDispose] = useState<Asset | null>(null);
  const [importResult, setImportResult] = useState<{ importedCount: number; errors: string[] } | null>(null);
  const [peopleFilter, setPeopleFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [expiringWarranties, setExpiringWarranties] = useState<{ count: number; description: string; endDate: string; daysRemaining: number }[]>([]);

  const fetchExpiringWarranties = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/reports/expiring-warranties`);
      setExpiringWarranties(response.data);
    } catch (error) {
      console.error('Erro ao buscar garantias a vencer:', error);
      // Não mostra toast de erro para não poluir a tela, apenas loga.
    }
  }, [API_URL]);

  const handleOpenReturnModal = async (movementId: number) => {
  if (!movementId) {
    addToast('ID da movimentação inválido.', 'error');
    return;
  }
  
  try {
    addToast('Buscando detalhes para devolução...', 'info');
    // Chama a nova rota que criamos no backend
    const response = await axios.get<Movement>(`${API_URL}/asset-movements/${movementId}/details`);
    
    // Armazena os dados completos no novo estado que criamos no passo 2.1
    setDetailedMovementToReturn(response.data);
    
  } catch (error) {
    console.error('Erro ao buscar detalhes da movimentação:', error);
    addToast('Não foi possível carregar os detalhes para devolução.', 'error');
  }
};

const handleOpenSubstitutionModal = (movement: Movement) => {
    setMovementToSubstitute(movement);
    setSubstitutionOldAssetId(null); // Limpa a seleção anterior ao abrir
  };

  const handleSubstitutionSelection = (id: number | null) => {
    console.log(`%c[App.tsx] Tentando definir o ID de seleção para: ${id}`, 'color: green; font-weight: bold;');
    setSubstitutionOldAssetId(id);
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  const handleDisposeAsset = async (assetId: number, disposalNote: string) => {
  try {
    await axios.put(`${API_URL}/assets/${assetId}/dispose`, { disposal_note: disposalNote });
    addToast('Ativo descartado com sucesso!', 'success');
    fetchAssets();
    fetchDashboardData();
  } catch (error: any) {
    addToast(error.response?.data?.message || 'Erro ao descartar ativo.', 'error');
    console.error('Erro ao descartar ativo:', error);
  }
};
  const handleRetireAsset = async (assetId: number, reason: string) => {
  try {
    await axios.put(`${API_URL}/assets/${assetId}/retire`, { reason });
    addToast('Ativo baixado com sucesso!', 'success');
    fetchAssets(); // Atualiza a lista de ativos
    fetchDashboardData(); // Atualiza os contadores do dashboard
  } catch (error: any) {
    addToast(error.response?.data?.message || 'Erro ao dar baixa no ativo.', 'error');
    console.error('Erro ao dar baixa no ativo:', error);
  }
};
  const handleConfirmReturn = async (notes: string, returnedPeripherals: Peripheral[]) => {
  if (!detailedMovementToReturn || !detailedMovementToReturn.assets || detailedMovementToReturn.assets.length === 0) {
    addToast('Erro: Movimentação detalhada ou ativos não encontrados para devolução.', 'error');
    return;
  }

  // Prepara os dados para a API - AGORA COM IDs GARANTIDOS
  const movementData = {
    asset_ids: detailedMovementToReturn.assets.map(a => a.id), // <-- Ponto principal da correção
    movement_type: 'return' as const,
    recipient_person_id: detailedMovementToReturn.recipient_person_id,
    notes: `Devolução referente à movimentação de saída/empréstimo #${detailedMovementToReturn.id}. ${notes}`,
    returned_peripherals: returnedPeripherals, // <-- ADICIONA OS PERIFÉRICOS
  };

  try {
    // A chamada para a API permanece a mesma, o backend agora saberá o que fazer
    await axios.post(`${API_URL}/asset-movements`, movementData);
    addToast('Devolução registrada com sucesso!', 'success');
    
    setDetailedMovementToReturn(null); // Fecha o modal limpando o novo estado
    triggerRefresh()
    
    // Atualiza os dados na tela
    fetchMovements();
    fetchAssets();
    fetchDashboardData();

  } catch (error: unknown) {
    const axiosError = error as AxiosError<BackendErrorResponse>;
    const errorMessage = axiosError.response?.data?.message || 'Erro ao registrar devolução.';
    addToast(`Falha ao registrar devolução: ${errorMessage}`, 'error'); // Mensagem de erro mais clara
    console.error("Falha ao registrar devolução", error);
  }
};

  const { addToast } = useToast();
  const ROLES = {
      ADMIN: 'admin',
      MANAGER: 'manager',
      BASIC: 'basic'
  };
  const PERMISSIONS = {
      // Permissões de Menu Principal
      MENU_DASHBOARD: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],
      MENU_CADASTROS: [ROLES.ADMIN, ROLES.MANAGER],
      MENU_OPERACOES: [ROLES.ADMIN, ROLES.MANAGER],
      MENU_CONSULTAS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC],
      MENU_RELATORIOS: [ROLES.ADMIN, ROLES.MANAGER],
      MENU_AUDITORIA: [ROLES.ADMIN],
      MENU_CONFIGURACOES: [ROLES.ADMIN],
      
      // Permissões de Submenus e Ações Específicas
      SUBMENU_TIPOS_ITENS: [ROLES.ADMIN, ROLES.MANAGER],
      SUBMENU_UNIDADES: [ROLES.ADMIN, ROLES.MANAGER],
      SUBMENU_PESSOAS: [ROLES.ADMIN, ROLES.MANAGER],
      SUBMENU_ATIVOS: [ROLES.ADMIN, ROLES.MANAGER],

      // Permissões para botões de criar/editar/importar dentro das páginas
      ACTION_CREATE_EDIT: [ROLES.ADMIN, ROLES.MANAGER],
      ACTION_DELETE: [ROLES.ADMIN], // Apenas admin pode excluir permanentemente
  };

  // Função `can` atualizada para usar as novas chaves
  const can = (permission: keyof typeof PERMISSIONS): boolean => {
    const userRole = user?.role;
    if (!userRole) return false;
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;
    return allowedRoles.includes(userRole);
  };

  const translateStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      available: 'Disponível',
      in_use: 'Em Uso',
      loaned: 'Emprestado',
      maintenance: 'Em Manutenção',
      pending_retirement: 'Pendente de Baixa',
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
        ],
        expiringWarranties: []
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

  const fetchUnits = useCallback(async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get<Unit[]>(`${API_URL}/units`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    setUnits(response.data);
  } catch (error) {
    console.error('Erro ao buscar unidades:', error);
    addToast('Erro ao carregar unidades.', 'error');
    setUnits([]); 
  }
}, [API_URL, addToast, setUnits]);

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

  const fetchMovements = useCallback(async (currentFilters = {}) => {
  console.log('Buscando movimentações com os filtros:', currentFilters);
  try {
    // Constrói a query string apenas com os filtros que têm valor
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(currentFilters)) {
      if (value) { // Adiciona o filtro apenas se não for vazio
        params.append(key, value as string);
      }
    }
    
    const queryString = params.toString();
    const url = `${API_URL}/asset-movements${queryString ? `?${queryString}` : ''}`;
    
    const response = await axios.get<Movement[]>(url);
    // IMPORTANTE: Decide se atualiza a lista principal ou a lista filtrada
    if (Object.keys(currentFilters).length > 0 && queryString) {
        setFilteredMovements(response.data);
    } else {
        setMovements(response.data);
        setFilteredMovements(null);
    }
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    addToast('Erro ao carregar movimentações.', 'error');
  }
}, [API_URL, addToast]); // Removido 'filters' da dependência para evitar re-renders

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
      fetchUnits();
      fetchAssets();
      fetchMovements();
      fetchPeople(); // NOVO: Carrega pessoas ao iniciar
      fetchUsers();
      fetchAuditLogs();
      fetchExpiringWarranties();
    }
  }, [user, authLoading, fetchAssets, fetchItemTypes, fetchUnits, fetchDashboardData, fetchMovements, fetchPeople, fetchUsers, fetchAuditLogs, refreshKey]);

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
    { name: 'Dashboard', icon: LayoutDashboard, id: 'dashboard', roles: PERMISSIONS.MENU_DASHBOARD },
    {
      name: 'Cadastros', icon: Archive, id: 'cadastros', roles: PERMISSIONS.MENU_CADASTROS,
      subMenus: [
        { name: 'Tipos de Itens', icon: List, id: 'item-types', roles: PERMISSIONS.SUBMENU_TIPOS_ITENS },
        { name: 'Unidades', icon: List, id: 'units', roles: PERMISSIONS.SUBMENU_UNIDADES },
        { name: 'Pessoas', icon: Users, id: 'people', roles: PERMISSIONS.SUBMENU_PESSOAS },
        { name: 'Ativos', icon: HardDrive, id: 'assets', roles: PERMISSIONS.SUBMENU_ATIVOS },
      ]
    },
    {
      name: 'Operações', icon: ArrowRightLeft, id: 'operacoes_grupo', roles: PERMISSIONS.MENU_OPERACOES,
      subMenus: [
        { name: 'Registrar Movimentação', icon: PlusCircle, id: 'action-register-movement', roles: PERMISSIONS.ACTION_CREATE_EDIT },
        { name: 'Gerenciar Ativos Externos', icon: Repeat, id: 'manage-external', roles: PERMISSIONS.ACTION_CREATE_EDIT },
        { name: 'Baixas e Descartes', icon: ArrowDownCircle, id: 'retire-dispose', roles: PERMISSIONS.ACTION_CREATE_EDIT },
      ]
    },
    { name: 'Consultas', icon: Search, id: 'queries', roles: PERMISSIONS.MENU_CONSULTAS },
    { name: 'Relatórios', icon: BarChart2, id: 'reports', roles: PERMISSIONS.MENU_RELATORIOS },
    { name: 'Auditoria', icon: History, id: 'audit', roles: PERMISSIONS.MENU_AUDITORIA },
    { name: 'Configurações', icon: Settings, id: 'settings', roles: PERMISSIONS.MENU_CONFIGURACOES },
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
        triggerRefresh();
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
  

  // Funções de manipulação para Unidades
  
  const handleEditUnit = (unit: Unit | null) => {
    // A função agora apenas precisa definir qual unidade está sendo editada
    // e abrir o modal. O UnitForm cuidará do resto.
    setEditingUnit(unit);
    setIsUnitModalOpen(true);
  };
  const handleDeleteUnit = async (id: number) => {
    // Adiciona uma confirmação antes de deletar
    if (window.confirm("Tem certeza que deseja deletar esta unidade? A ação não pode ser desfeita.")) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/units/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Atualiza a lista de unidades na tela, removendo a que foi deletada
        setUnits(units.filter(u => u.id !== id));
        addToast("Unidade deletada com sucesso!", "success");
        triggerRefresh();

      } catch (error: any) {
        addToast(error.response?.data?.message || "Ocorreu um erro ao deletar a unidade.", "error");
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
        triggerRefresh();
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
        triggerRefresh(); 
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

const handleGenerateFilteredReport = async () => {
  // O botão já está desabilitado se não houver filtros, mas adicionamos uma segurança extra.
  if (!isReportButtonEnabled || Object.keys(lastAppliedFilters).length === 0) {
    addToast('Por favor, realize uma consulta primeiro.', 'warning');
    return;
  }

  addToast('Gerando seu relatório PDF...', 'info');
  try {
    // Usamos o método POST para enviar o objeto complexo de filtros no corpo da requisição
    const response = await axios.post(
      `${API_URL}/reports/movements/pdf`, 
      lastAppliedFilters, // Envia o último conjunto de filtros aplicados
      { responseType: 'blob' }
    );

    // O restante do código é o mesmo para download de arquivos
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'relatorio_movimentacoes_filtrado.pdf');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao gerar relatório filtrado:", error);
    addToast('Erro ao gerar relatório.', 'error');
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

  const handleSaveRenewal = async (movementId: number, newDate: string, note: string) => {
  try {
    await axios.put(`${API_URL}/asset-movements/${movementId}/renew`, {
      new_expected_return_date: newDate,
      renewal_note: note,
    });
    addToast('Empréstimo renovado com sucesso!', 'success');
    triggerRefresh();
    fetchMovements(); // Atualiza a lista de movimentações
    fetchDashboardData(); // Atualiza os alertas do dashboard
  } catch (error: any) {
    addToast(error.response?.data?.message || 'Erro ao renovar empréstimo.', 'error');
    console.error('Erro ao renovar empréstimo:', error);
  }
};

console.log('%c[App.tsx] Renderizando. O valor ATUAL de substitutionOldAssetId é:', 'color: blue;', substitutionOldAssetId);


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
              className="h-38 w-auto" // Ajuste a altura (h-12) conforme necessário
              //onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/180x60/0056b3/ffffff?text=Logo'; }}
            />
          </a>
        </div>

        <nav className="space-y-2 flex-1 overflow-y-auto pb-4 scrollbar-thin scrollbar-track-blue-900 scrollbar-thumb-blue-700 hover:scrollbar-thumb-blue-500 scrollbar-thumb-rounded-full">
          {menuItems.map((item) => (
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
                            onClick={(e) => {
                              e.preventDefault(); // Previne a mudança na URL
                              if (subMenu.id === 'action-register-movement') {
                                // Se for a ação de registrar, apenas abre o modal
                                setShowMovementModal(true);
                              } else {
                                // Para todos os outros, define o menu ativo para trocar de página
                                setActiveMenu(subMenu.id);
                              }
                              setSidebarOpen(false);
                            }}
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
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Ativos por Tipo de Item</h3>
                  <p className="text-xs text-gray-500 mb-4">Distribuição do total de {dashboardData.totalAssets} ativos cadastrados.</p>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      layout="vertical" // <<< Define o gráfico como horizontal
                      data={dashboardData.assetsByCategory}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={80} // Ajuste a largura se os nomes forem longos
                        tick={{ fontSize: 12 }} 
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" name="Quantidade" fill="#007bff" radius={[0, 10, 10, 0]}>
                        {dashboardData.assetsByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
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
                      <Bar dataKey="value" name="Quantidade" fill="#007bff" radius={[10, 10, 0, 0]} />
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
                          <p className="text-sm text-gray-500">{translateMovementType(movement.type)} por {movement.user}</p>
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
              {/* <<< 3. RENDERIZA O NOVO CARD DE GARANTIAS >>> */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-orange-700 mb-4 flex items-center">
                  <AlertTriangleIcon className="w-5 h-5 mr-2 text-orange-600" /> Garantias a Vencer (90 dias)
                </h3>
                {expiringWarranties.length > 0 ? (
                  <ul className="space-y-3">
                    {expiringWarranties.map((item, index) => (
                      <li key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <p className="text-sm font-medium text-orange-800">
                          {item.count}x {item.description}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          Vence em <strong>{item.daysRemaining} dia(s)</strong> em {item.endDate}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhuma garantia próxima do vencimento.</p>
                )}
              </div>

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

          {activeMenu === 'units' && (
          <div className="space-y-8">
              {/* Título atualizado */}
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Unidades</h1>
              {canAccess(['admin', 'manager']) && (
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <button
                          /* Ação e texto do botão atualizados */
                          onClick={() => handleEditUnit(null)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center"
                      >
                          <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Unidade
                      </button>
                      <input
                          type="file"
                          /* ID do input atualizado */
                          id="unitFileInput"
                          className="hidden"
                          onChange={(e) => {
                              handleImport(e.target.files ? e.target.files[0] : null, 'units');
                              e.target.value = '';
                          }}
                      />
                      <label 
                          /* 'for' e texto da label atualizados */
                          htmlFor="unitFileInput" 
                          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer">
                          <UploadCloud className="w-5 h-5 mr-2" /> Importar Unidades
                      </label>
                  </div>
              )}

              {/* <<< CAMPO DE BUSCA INTELIGENTE ADICIONADO AQUI >>> */}
              <div className="bg-white p-4 rounded-xl shadow-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por Nome, Código ou Tipo..." /* Placeholder atualizado */
                    value={unitFilter} /* CORRIGIDO: Deve ser a variável, não a função */
                    onChange={(e) => setUnitFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Unidades/Setores Cadastrados</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3">Nome da Unidade</th>
                        <th scope="col" className="px-6 py-3">Tipo</th>
                        <th scope="col" className="px-6 py-3">Código/Sigla</th>
                        <th scope="col" className="px-6 py-3">Telefone</th>
                        {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Lógica de filtro e mapeamento para a nova estrutura de Unidades */}
                      {units
                          .filter(unit =>
                              unit.name.toLowerCase().includes(unitFilter.toLowerCase()) ||
                              (unit.code && unit.code.toLowerCase().includes(unitFilter.toLowerCase())) ||
                              unit.type.toLowerCase().includes(unitFilter.toLowerCase())
                          )
                          /* Mapeamento atualizado para usar 'unit: Unit' */
                          .map((unit: Unit) => (
                              <tr key={unit.id} className="bg-white border-b hover:bg-gray-50">
                                  {/* Colunas da tabela atualizadas para os campos de Unit */}
                                  <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{unit.name}</th>
                                  <td className="px-6 py-4">{unit.type}</td>
                                  <td className="px-6 py-4">{unit.code || 'N/A'}</td>
                                  <td className="px-6 py-4">{unit.contact_phone || 'N/A'}</td>
                                  {canAccess(['admin', 'manager']) && (
                                      <td className="px-6 py-4 text-right whitespace-nowrap">
                                          {/* Botões de ação atualizados */}
                                          <button onClick={() => handleEditUnit(unit)} className="font-medium text-blue-600 hover:underline mr-4" title="Editar Unidade"><Edit className="inline-block w-5 h-5" /></button>
                                          {canAccess(['admin']) && (<button onClick={() => handleDeleteUnit(unit.id)} className="font-medium text-red-600 hover:underline" title="Excluir Unidade"><Trash2 className="inline-block w-5 h-5" /></button>)}
                                      </td>
                                  )}
                              </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
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
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Pessoa
                  </button>
                  <input
                    type="file"
                    id="personFileInput"
                    className="hidden"
                    accept=".xlsx, .csv"
                    onChange={(e) => {
                      handleImport(e.target.files ? e.target.files[0] : null, 'people');
                      e.target.value = ''; // Limpa o input
                    }}
                  />
                  <label htmlFor="personFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Pessoas
                  </label>
                </div>
              )}

              {/* <<< CAMPO DE BUSCA INTELIGENTE ADICIONADO AQUI >>> */}
              <div className="bg-white p-4 rounded-xl shadow-md">
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                          type="text"
                          placeholder="Filtrar por Nome, CPF ou Matrícula..."
                          value={peopleFilter}
                          onChange={(e) => setPeopleFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border rounded-lg"
                      />
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Pessoas Cadastradas</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3">Nome Completo</th>
                        <th scope="col" className="px-6 py-3">Unidade / Setor</th>
                        <th scope="col" className="px-6 py-3">Matrícula</th>
                        <th scope="col" className="px-6 py-3">CPF</th>
                        <th scope="col" className="px-6 py-3">Email</th>
                        {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* <<< LÓGICA DE FILTRO APLICADA AQUI >>> */}
                      {people
                        .filter(p =>
                          p.full_name.toLowerCase().includes(peopleFilter.toLowerCase()) ||
                          p.cpf.includes(peopleFilter) ||
                          (p.registration_number && p.registration_number.includes(peopleFilter))
                        )
                        .map((person: Person) => (
                        <tr key={person.id} className="bg-white border-b hover:bg-gray-50">
                          <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{person.full_name}</th>
                          <td className="px-6 py-4">{person.unit_name || 'N/A'}</td>
                          <td className="px-6 py-4">{person.registration_number || 'N/A'}</td>
                          <td className="px-6 py-4">{person.cpf}</td>
                          <td className="px-6 py-4">{person.email}</td>
                          {canAccess(['admin', 'manager']) && (
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <button onClick={() => handleEditPerson(person)} className="font-medium text-blue-600 hover:underline mr-4" title="Editar Pessoa"><Edit className="inline-block w-5 h-5" /></button>
                              {canAccess(['admin']) && (<button onClick={() => handleDeletePerson(person.id)} className="font-medium text-red-600 hover:underline" title="Excluir Pessoa"><Trash2 className="inline-block w-5 h-5" /></button>)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                          <th scope="col" className="px-6 py-3">Unidade Atual</th>
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
                              {asset.current_unit_name || 'N/A'}
                            </td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                {/* Botão de Editar (já existente) */}
                                <button
                                  onClick={() => handleEditAsset(asset)}
                                  className="font-medium text-blue-600 hover:underline"
                                  title="Editar Ativo"
                                >
                                  <Edit className="inline-block w-5 h-5" />
                                </button>

                                {/* Botão de Baixar (NOVO) */}
                                {['available', 'maintenance'].includes(asset.status) && (
                                    <button
                                        onClick={() => setAssetToRetire(asset)}
                                        className="font-medium text-yellow-600 hover:underline ml-4"
                                        title="Dar Baixa no Ativo"
                                    >
                                        <ArrowDownCircle className="inline-block w-5 h-5" />
                                    </button>
                                )}

                                {asset.status === 'retired' && can('ACTION_DELETE') && (
                                    <button
                                        onClick={() => setAssetToDispose(asset)}
                                        className="font-medium text-black hover:text-red-700 ml-4"
                                        title="Descartar Ativo Permanentemente"
                                    >
                                        <Trash2 className="inline-block w-5 h-5" />
                                    </button>
                                )}

                                {/* Botão de Excluir (já existente) */}
                                {asset.status !== 'retired' && can('ACTION_DELETE') && (
                                    <button
                                        onClick={() => handleDeleteAsset(asset.id)}
                                        className="font-medium text-red-600 hover:underline ml-4"
                                        title="Excluir Registro do Ativo"
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
                  <p className="text-gray-500 text-center py-4">Nenhum ativo cadastrado.</p>
                )}
              </div>
            </div>
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
         {/* Relatório de Unidasdes */}
    <div className="border p-4 rounded-lg">
      <h4 className="font-semibold mb-2 flex items-center"><List className="w-5 h-5 mr-2" /> Unidades</h4>
      <div className="flex gap-2">
        <button onClick={() => handleDownloadReport('units', 'csv')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">CSV</button>
        <button onClick={() => handleDownloadReport('units', 'xlsx')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">XLSX</button>
        <button onClick={() => handleDownloadReport('units', 'pdf')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">PDF</button>
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
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Relatórios Operacionais</h3>
      <div className="border p-4 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center"><AlertTriangleIcon className="w-5 h-5 mr-2 text-red-600" /> Empréstimos Vencidos</h4>
        <div className="flex gap-2">
          <button onClick={() => handleDownloadReport('overdue-loans', 'csv')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">CSV</button>
          <button onClick={() => handleDownloadReport('overdue-loans', 'xlsx')} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">XLSX</button>
          <button onClick={() => handleDownloadReport('overdue-loans', 'pdf')} className="text-xs bg-red-200 text-red-800 hover:bg-red-300 px-2 py-1 rounded">PDF</button>
        </div>
      </div>
    </div>
  </div>
)}

{activeMenu === 'audit' && (
  can('MENU_AUDITORIA') ? (
   <AuditLogPage 
      logs={auditLogs} 
      API_URL={API_URL}
      users={users}
    />
  ) : (
    // Mostra mensagem de acesso negado se não tiver permissão
    <div className="text-center py-20 text-red-600">
      <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
      <p>Você não tem permissão para acessar esta área.</p>
    </div>
  )
)}

{/* >>> RENDERIZA A NOVA PÁGINA CENTRAL "Gerenciar Ativos Externos" <<< */}
  {activeMenu === 'manage-external' && (
  <AssetManagementPage
    onConfirmClick={setSelectedMovementForConfirmation}
    onRenewClick={setMovementToRenew}
    onSubstituteClick={handleOpenSubstitutionModal}
    onReturnClick={(movement) => handleOpenReturnModal(movement.id)} // ✨ AJUSTE AQUI
    API_URL={API_URL}
    refreshKey={refreshKey}
  />
)}

{activeMenu === 'retire-dispose' && (
            <RetirementAndDisposalPage 
                API_URL={API_URL} 
                userRole={user?.role}
            />
          )}

{detailedMovementToReturn && (
  <ReturnConfirmationModal
    movement={detailedMovementToReturn}
    onClose={() => setDetailedMovementToReturn(null)}
    // A prop onConfirm agora passa os dois parâmetros para a função handleConfirmReturn
    onConfirm={(notes, returnedPeripherals) => handleConfirmReturn(notes, returnedPeripherals)} 
  />
)}

            {/* RENDERIZA A PÁGINA DE CONSULTAS QUANDO O MENU FOR CLICADO */}
            {activeMenu === 'queries' && (
              <QueryHubPage 
                people={people} 
                units={units}
                API_URL={API_URL}
                translateMovementType={translateMovementType}
                translateStatus={translateStatus}
                onRenewClick={setMovementToRenew}
                onSubstituteClick={handleOpenSubstitutionModal}
                onReturnClick={(movement) => handleOpenReturnModal(movement.id)}
                userRole={user?.role} 
              />
            )}
        </main>
      </div>

      {/* MODAL DE RENOVAÇÃO AQUI */}
      {movementToRenew && (
        <LoanRenewalModal
          movement={movementToRenew}
          onClose={() => setMovementToRenew(null)}
          onSave={handleSaveRenewal}
        />
      )}

      {movementToSubstitute && (
        <SubstitutionModal
          movement={movementToSubstitute}
          onClose={() => setMovementToSubstitute(null)}
          onSuccess={() => {
            fetchMovements(); // Recarrega todas as listas necessárias
            fetchAssets();
            triggerRefresh();
            // Adicione aqui chamadas para recarregar as listas da AssetManagementPage se necessário
          }}
          API_URL={API_URL}
        />
      )}

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
          units={units} // Passa a lista de uniades
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
        // A função onSave já passa o objeto de dados completo (itemTypeData),
        // então o código abaixo já deve funcionar corretamente com as novas props
        onSave={async (itemTypeData) => { // itemTypeData agora inclui sku_code
          try {
            if (editingItemType) {
              await axios.put(`${API_URL}/item-types/${editingItemType.id}`, itemTypeData);
              addToast('Tipo de item atualizado com sucesso!', 'success');
            } else {
              await axios.post(`${API_URL}/item-types`, itemTypeData);
              addToast('Tipo de item adicionado com sucesso!', 'success');
            }
            triggerRefresh();
            fetchItemTypes();
            setShowItemTypeModal(false);
            setEditingItemType(null);
          } catch (error: unknown) {
            // ... (código de tratamento de erro)
          }
        }}
        itemType={editingItemType}
      />
      )}

      {isUnitModalOpen && (
        <UnitForm
          unitToEdit={editingUnit}
          units={units}
          onClose={() => setIsUnitModalOpen(false)}
          onUnitSaved={() => {
            setIsUnitModalOpen(false);
            fetchUnits(); // Mantemos a atualização da lista
          }}
          API_URL={API_URL}
          addToast={addToast}
        />
      )}

     
      {isParentUnitModalOpen && (
          <ParentUnitModal
              API_URL={API_URL}
              onClose={() => setIsParentUnitModalOpen(false)}
              onSaveSuccess={() => {
                fetchUnits(); // Apenas atualiza a lista de opções
                setIsParentUnitModalOpen(false); // E fecha o modal
              }}
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
              triggerRefresh();
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
          units={units}
          translateStatus={translateStatus}
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
              triggerRefresh();
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
          units={units}
        />
      )}

      {showUserModal && (
        <UserModal
          userToEdit={editingUser}
          // A prop 'onClose' agora executa as duas ações necessárias
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null); // Limpa o estado de edição ao fechar
          }}
          onSave={async (userData, userId) => {
            try {
              if (userId) {
                // Lógica de Edição
                await axios.put(`${API_URL}/users/${userId}`, userData);
                addToast('Usuário atualizado com sucesso!', 'success');
              } else {
                // Lógica de Criação
                const response = await axios.post(`${API_URL}/users/register`, userData);
                addToast('Usuário registrado com sucesso!', 'success');
                if (response.data.generatedPassword) {
                  alert(`Senha Temporária: ${response.data.generatedPassword}`);
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

      {selectedMovementForConfirmation && (
        <ConfirmationModal
          movement={selectedMovementForConfirmation}
          onClose={() => setSelectedMovementForConfirmation(null)}
          onSuccess={() => {
            // Recarrega a lista de movimentações para refletir o status atualizado
            fetchMovements();
            triggerRefresh();
          }}
          API_URL={API_URL}
        />
      )}

      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}

      {assetToRetire && (
        <RetireAssetModal
            asset={assetToRetire}
            onClose={() => setAssetToRetire(null)}
            onSave={handleRetireAsset}
        />
      )}
      {assetToDispose && (
        <DisposeAssetModal
            asset={assetToDispose}
            onClose={() => setAssetToDispose(null)}
            onSave={handleDisposeAsset}
        />
      )}
    </div>
  );

  async function handleImport(file: File | null, type: 'item-types' | 'units' | 'assets' | 'people') {
    alert(`Iniciando importação para o tipo: ${type}`);
  console.log(`[TESTE DEFINITIVO] A função handleImport foi chamada com o tipo:`, type);
  if (!file) {
    addToast('Por favor, selecione um arquivo para importar.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  addToast(`Importando ${type}... Isso pode levar um momento.`, 'info');

  try {
    const response = await axios.post(`${API_URL}/${type}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // <<< MUDANÇA AQUI: Usa o estado para abrir o modal com os resultados >>>
    setImportResult(response.data);

    // Atualiza a lista correspondente na tela
    if (type === 'item-types') fetchItemTypes();
    if (type === 'units') fetchUnits();
    if (type === 'assets') fetchAssets();
    if (type === 'people') fetchPeople();

  } catch (error: unknown) {
    const axiosError = error as AxiosError<BackendErrorResponse>;
    const errorMessage = axiosError.response?.data?.message || axiosError.message;
    console.error(`Erro ao importar ${type}:`, axiosError.response?.data || axiosError);
    addToast(`Erro ao importar ${type}: ${errorMessage}`, 'error');
  }
}

  async function handleDownloadReport(reportType: 'assets' | 'people' | 'units' | 'item-types' | 'overdue-loans'| 'audit-logs', format: string) {
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
  units: Unit[];
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

// =====================================================================================
// NOVO: Componente Modal de Tipo de Item (FALTANDO)
// =====================================================================================

interface ItemTypeModalProps {
  onClose: () => void;
  onSave: (itemTypeData: { name: string; sku_code: string; description?: string }, id?: number) => Promise<void>; // <-- LINHA CORRIGIDA
  itemType: ItemType | null; 
}

const ItemTypeModal = ({ onClose, onSave, itemType }: ItemTypeModalProps) => {
  const [name, setName] = useState<string>(itemType?.name || '');
  const [description, setDescription] = useState<string>(itemType?.description || '');
  const [skuCode, setSkuCode] = useState<string>(itemType?.sku_code || ''); // ✨ ADICIONADO
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // ✨ ATENÇÃO: A FUNÇÃO onSave NO PAI PRECISA SER AJUSTADA PARA ACEITAR sku_code
    // IREMOS FAZER ISSO NA PRÓXIMA ETAPA, MAS O MODAL JÁ ESTÁ PRONTO
    await onSave({
        name,
        description: description || undefined,
        sku_code: skuCode, // ✨ ENVIANDO O NOVO DADO
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
              type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required
            />
          </div>
          
          {/* ✨ CAMPO ADICIONADO ✨ */}
          <div>
            <label htmlFor="skuCode" className="block text-sm font-medium text-gray-700 mb-1">Código SKU (Padrão de finido pela Gestão, 3 Letras)</label>
            <input
              type="text" id="skuCode" value={skuCode} onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required maxLength={3} minLength={3} placeholder="Ex: NTB, MNT"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
            <textarea
              id="description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
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
        </form>
      </div>
    </div>
  );
};

const MovementModal = ({ onClose, onSave, assets: allAssets, people, units, handleGenerateMovementReceipt }: MovementModalProps) => {
  // Estados do formulário
  const [movementType, setMovementType] = useState<Movement['movement_type']>('loan');
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [requestChannelType, setRequestChannelType] = useState<'Email' | 'SEI' | 'Ordem Direta' | ''>('');
  const [requestChannelDetails, setRequestChannelDetails] = useState<string>('');
  
  // Novos estados para controlar o checklist de periféricos >>>
  const [checkedPeripherals, setCheckedPeripherals] = useState<{ [key: string]: boolean }>({});
  const [otherPeripheral, setOtherPeripheral] = useState('');

  // Estados de busca
  const [patrimonioSearchTerm, setPatrimonioSearchTerm] = useState<string>('');
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [solicitanteSearchTerm, setSolicitanteSearchTerm] = useState<string>('');
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState<string>('');
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [monitorSearchTerm, setMonitorSearchTerm] = useState('');
  const [monitorSearchLoading, setMonitorSearchLoading] = useState(false);
  
  // Estados de controle do fluxo
  const [loading, setLoading] = useState<boolean>(false);
  const [patrimonioLoading, setPatrimonioLoading] = useState<boolean>(false);
  const [lastMovementId, setLastMovementId] = useState<number | null>(null);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState<boolean>(false);
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  // <<< LÓGICA 1: Decide quando mostrar a seção de acessórios >>>
  const showPeripheralsSection = selectedAssets.some(
    asset => asset.item_type_name.toLowerCase() === 'notebook' || asset.item_type_name.toLowerCase() === 'desktop'
  );
  // <<< Lógica para saber se um desktop está na lista e precisa de um monitor >>>
  const needsMonitor = selectedAssets.some(asset => asset.item_type_name.toLowerCase() === 'desktop') && 
                       !selectedAssets.some(asset => asset.item_type_name.toLowerCase() === 'monitor')
  
  // Nova função para lidar com a mudança nos checkboxes >>>
  const handlePeripheralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCheckedPeripherals(prev => ({ ...prev, [name]: checked }));
  };

  // Demais funções de manipulação (mantidas como estão)
  const handleSelectPerson = (person: Person) => { setSelectedPerson(person); setSolicitanteSearchTerm(person.full_name); setFilteredPeople([]); };
  const handleSelectUnit = (unit: Unit) => {
  setSelectedUnit(unit); 
  setUnitSearchTerm(unit.name); 
  setFilteredUnits([]); 
};
  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssets.length === 0) { addToast('Adicione ao menos um ativo à movimentação.', 'warning'); return; }
    if (!selectedPerson && (movementType === 'exit' || movementType === 'loan')) { addToast('Por favor, selecione um solicitante.', 'warning'); return; }
    if (!selectedUnit && (movementType === 'exit' || movementType === 'loan' || movementType === 'maintenance')) { addToast('Por favor, selecione uma unidade de destino.', 'warning'); return; }
    const hasDesktop = selectedAssets.some(asset => asset.item_type_name.toLowerCase() === 'desktop');
    const hasMonitor = selectedAssets.some(asset => asset.item_type_name.toLowerCase() === 'monitor');

    // Se tem um desktop mas não tem um monitor, exibe o alerta.
    if (hasDesktop && !hasMonitor) {
      const userConfirmation = window.confirm(
        "ATENÇÃO: Você adicionou um Desktop sem um Monitor na mesma movimentação. Deseja continuar mesmo assim?"
      );
      // Se o usuário clicar em "Cancelar" no alerta, a função para aqui.
      if (!userConfirmation) {
        return; 
      }
    }
    setIsAwaitingConfirmation(true);
    addToast('Por favor, confirme os dados antes de registrar.', 'info');
  };
  const handleEditAgain = () => { setIsAwaitingConfirmation(false); };
  const handleConfirmAndSave = async () => {
    setLoading(true);
    const peripherals = Object.keys(checkedPeripherals).filter(key => checkedPeripherals[key]);
    if (otherPeripheral.trim()) {
      peripherals.push(otherPeripheral.trim());
    }

    const movementData = {
      asset_ids: selectedAssets.map(asset => asset.id),
      movement_type: movementType,
      recipient_person_id: selectedPerson?.id,
      destination_unit_id: selectedUnit?.id,
      purpose: purpose || undefined,
      notes: notes || undefined,
      expected_return_date: movementType === 'loan' ? expectedReturnDate : undefined,
      request_channel_type: requestChannelType || undefined,
      request_channel_details: requestChannelDetails || undefined,
      peripherals: peripherals, // Envia a lista de periféricos
    };
    const result = await onSave(movementData);
    if (result.success && result.movementId) {
      setLastMovementId(result.movementId);
    }
    setIsAwaitingConfirmation(false); 
    setLoading(false);
  };
  const handleSearchAssetByPatrimonio = async () => {
    if (!patrimonioSearchTerm) { addToast('Por favor, insira um número de patrimônio.', 'warning'); return; }
    setPatrimonioLoading(true);
    setFoundAsset(null);
    try {
      const response = await axios.post<Asset>(`${API_URL}/assets/validate-for-movement`, { patrimonio_number: patrimonioSearchTerm, movement_type: movementType });
      setFoundAsset(response.data);
      addToast('Ativo verificado e pronto para inclusão!', 'success');
    } catch (error: any) {
      addToast(error.response?.data?.message ?? 'Erro ao consultar o ativo.', 'error');
      setFoundAsset(null);
    } finally {
      setPatrimonioLoading(false);
    }
  };
  const handleAddAssetToMovement = (assetToAdd: Asset | null) => {
  // Se nenhum ativo for passado como argumento, usa o que está no estado 'foundAsset'.
  // Isso mantém o funcionamento antigo e adiciona a nova capacidade.
  const asset = assetToAdd || foundAsset;

  if (asset) {
    if (selectedAssets.some(a => a.id === asset.id)) {
      addToast('Este ativo já foi adicionado.', 'warning');
      return;
    }
    setSelectedAssets(prev => [...prev, asset]);
    // Limpa os campos de busca correspondentes
    if (!assetToAdd) {
      setPatrimonioSearchTerm('');
      setFoundAsset(null);
    }
  } else {
    addToast('Nenhum ativo para adicionar. Consulte um ativo primeiro.', 'warning');
  }
};
  const handleLinkMonitor = async () => {
    if (!monitorSearchTerm) { addToast('Digite o patrimônio do monitor.', 'warning'); return; }
    setMonitorSearchLoading(true);
    try {
      const response = await axios.post<Asset>(`${API_URL}/assets/validate-for-movement`, { patrimonio_number: monitorSearchTerm, movement_type: 'exit' });
      const foundMonitor = response.data;

      if (foundMonitor.item_type_name.toLowerCase() !== 'monitor') {
        addToast('O patrimônio informado não pertence a um monitor.', 'error');
        return;
      }
      
      // Reutiliza a função de adicionar ativo para incluir o monitor na lista principal
      handleAddAssetToMovement(foundMonitor);
      addToast(`Monitor ${foundMonitor.patrimonio_number} vinculado com sucesso!`, 'success');
      setMonitorSearchTerm(''); // Limpa o campo após o sucesso
    } catch (error: any) {
      addToast(error.response?.data?.message ?? 'Erro ao consultar o monitor.', 'error');
    } finally {
      setMonitorSearchLoading(false);
    }
  };
  const handleRemoveAssetFromMovement = (assetId: number) => { setSelectedAssets((prevAssets) => prevAssets.filter((asset) => asset.id !== assetId)); };

  // Efeitos (mantidos como estão)
  useEffect(() => { if (solicitanteSearchTerm.length > 2) { setFilteredPeople( people.filter(p => p.full_name.toLowerCase().includes(solicitanteSearchTerm.toLowerCase()) || p.cpf.includes(solicitanteSearchTerm) || (p.registration_number && p.registration_number.includes(solicitanteSearchTerm))) ); } else { setFilteredPeople([]); } }, [solicitanteSearchTerm, people]);
  useEffect(() => {
    if (unitSearchTerm.length > 2) {
        setFilteredUnits(
            units.filter(unit =>
                unit.name.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
                (unit.code && unit.code.toLowerCase().includes(unitSearchTerm.toLowerCase())) ||
                unit.type.toLowerCase().includes(unitSearchTerm.toLowerCase())
            )
        );
    } else {
        setFilteredUnits([]);
    }
}, [unitSearchTerm, units]);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"> <X className="w-6 h-6" /> </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Registrar Nova Movimentação</h2>

        <form onSubmit={handleProceedToConfirmation} className="space-y-6">
          <fieldset disabled={isAwaitingConfirmation || !!lastMovementId}>
            
            {/* Tipo de Movimentação */}
            <div>
              <label htmlFor="movementType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
              <select id="movementType" value={movementType} onChange={(e) => setMovementType(e.target.value as Movement['movement_type'])} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required>
                <option value="loan">Empréstimo</option>
                <option value="exit">Saída</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </div>

            {/* Dados do Solicitante */}
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
                <div>
                    <label className="text-sm font-medium text-gray-700">Contato</label>
                    <input 
                        type="text" 
                        // <<< AJUSTE 1: Campo de contato agora mostra em branco se não houver valor >>>
                        value={selectedPerson?.contact_phone || ''} 
                        className="w-full bg-gray-100 p-2 border rounded-md" 
                        readOnly 
                    />
                </div>
              </div>
            </div>

            {/* Card de Ativos para Movimentar */}
            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Ativos para Movimentar</h3>
              
              {/* Seção de busca de patrimônio */}
              <div>
                <label htmlFor="patrimonioSearchTerm" className="block text-sm font-medium text-gray-700 mb-1">Patrimônio</label>
                <div className="flex space-x-2">
                  <input type="text" id="patrimonioSearchTerm" placeholder="Número de Patrimônio" value={patrimonioSearchTerm} onChange={(e) => setPatrimonioSearchTerm(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" />
                  <button type="button" onClick={handleSearchAssetByPatrimonio} disabled={patrimonioLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 flex items-center disabled:bg-gray-400"> <Search className="w-5 h-5 mr-2" /> {patrimonioLoading ? 'Buscando...' : 'Consultar'} </button>
                  <button type="button" onClick={() => handleAddAssetToMovement(null)} disabled={!foundAsset} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">Incluir Ativo</button>
                </div>
              </div>
              
              {/* Tabela de ativos na movimentação */}
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

            {/* ✨ SEÇÃO VINCULAR MONITOR (MOVIDA PARA CÁ) ✨ */}
            {needsMonitor && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-bold text-yellow-800">Vincular Monitor</h4>
                  <p className="text-xs text-yellow-700 mb-2">Para concluir o kit, informe o patrimônio do monitor que acompanhará este Desktop.</p>
                  <div className="flex space-x-2">
                      <input type="text" value={monitorSearchTerm} onChange={e => setMonitorSearchTerm(e.target.value)} placeholder="Patrimônio do Monitor..." className="flex-grow px-3 py-1 border rounded-md text-sm"/>
                      <button type="button" onClick={handleLinkMonitor} disabled={monitorSearchLoading} className="bg-yellow-500 text-white px-3 py-1 rounded-md text-xs flex items-center disabled:opacity-50">
                          {monitorSearchLoading ? '...' : 'Vincular Monitor'}
                      </button>
                  </div>
              </div>
            )}

            {/* ✨ SEÇÃO DE ACESSÓRIOS (AGORA ÚNICA E NO LOCAL CORRETO) ✨ */}
            {showPeripheralsSection && (
              <div className="border border-gray-200 p-4 rounded-lg bg-blue-50">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Adicionar Acessórios (sem patrimônio)</h3>
                  <p className="text-xs text-gray-500 mb-4">Marque os periféricos que acompanham o Desktop/Notebook.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-100">
                          <input type="checkbox" name="Mouse" checked={!!checkedPeripherals['Mouse']} onChange={handlePeripheralChange} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"/>
                          <span>Mouse</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-100">
                          <input type="checkbox" name="Teclado" checked={!!checkedPeripherals['Teclado']} onChange={handlePeripheralChange} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"/>
                          <span>Teclado</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-100">
                          <input type="checkbox" name="Fonte de Alimentação" checked={!!checkedPeripherals['Fonte de Alimentação']} onChange={handlePeripheralChange} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"/>
                          <span>Fonte de Alimentação</span>
                      </label>
                      <div className="flex items-center space-x-2">
                          <label className="text-sm">Outro:</label>
                          <input type="text" value={otherPeripheral} onChange={(e) => setOtherPeripheral(e.target.value)} className="w-full p-1 border rounded-md text-sm"/>
                      </div>
                  </div>
              </div>
            )}

            {/* CAMPOS ADICIONAIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Unidade de Destino</label>
                <div className="relative">
                  <div className="flex">
                    <input 
                      type="text" 
                      value={unitSearchTerm} 
                      onChange={(e) => { setUnitSearchTerm(e.target.value); setSelectedUnit(null); }} 
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm disabled:bg-gray-100" 
                      placeholder="Buscar por Nome, Código ou Tipo..." 
                      autoComplete="off" 
                    />
                    <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-r-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"> 
                      <Search className="w-5 h-5" /> 
                    </button>
                  </div>
                  {filteredUnits.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                      {filteredUnits.map((unit: Unit) => (
                        // CORRIGIDO: Chama 'handleSelectUnit' e exibe 'unit.name'
                        <li key={unit.id} onClick={() => handleSelectUnit(unit)} className="px-3 py-2 cursor-pointer hover:bg-blue-50">
                          {unit.name} ({unit.type})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {selectedUnit && (
                  <div className="mt-2 p-2 bg-gray-100 border rounded-md text-sm">
                    <p><b>Unidade Selecionada:</b> {selectedUnit.name}</p>
                    <p><b>Tipo:</b> {selectedUnit.type} | <b>Código:</b> {selectedUnit.code || 'N/A'}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="requestChannelType" className="block text-sm font-medium text-gray-700">Canal de Solicitação</label>
                  <select id="requestChannelType" value={requestChannelType} onChange={(e) => { setRequestChannelType(e.target.value as any); setRequestChannelDetails(''); }} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"> <option value="">Selecione...</option> <option value="Email">E-mail</option> <option value="SEI">SEI</option> <option value="Ordem Direta">Ordem Direta</option> </select>
                  {requestChannelType === 'SEI' ? (<InputMask mask="99.999999/9999-99" value={requestChannelDetails} onChange={(e) => setRequestChannelDetails(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" placeholder="Número do SEI" className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required />}</InputMask>) : requestChannelType === 'Ordem Direta' && (<input type="text" placeholder="Nome e Cargo" value={requestChannelDetails} onChange={(e) => setRequestChannelDetails(e.target.value)} className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required />)}
                </div>
                <div>
                  <label htmlFor="expectedReturnDate" className="block text-sm font-medium text-gray-700">Data Prevista Para Devolução</label>
                  <input
                    type="date"
                    id="expectedReturnDate"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    // <<< AJUSTE 2: Campo desabilitado e obrigatório condicionalmente >>>
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
                    disabled={movementType !== 'loan'}
                    required={movementType === 'loan'}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">Finalidade</label><textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea></div>
              <div><label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observação</label><textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea></div>
            </div>
          </fieldset>

          {/* DIV DE BOTÕES (Lógica mantida) */}
          <div className="flex justify-end space-x-3 pt-4">
            {!isAwaitingConfirmation && !lastMovementId && ( <> <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Cancelar</button> <button type="submit" className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800"> Revisar para Registrar </button> </> )}
            {isAwaitingConfirmation && !lastMovementId && ( <> <button type="button" onClick={handleEditAgain} disabled={loading} className="px-6 py-2 bg-yellow-500 text-white rounded-lg shadow-sm hover:bg-yellow-600 disabled:opacity-50"> <Edit className="w-5 h-5 mr-2 inline-block" /> Editar </button> <button type="button" onClick={handleConfirmAndSave} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50"> {loading ? 'Registrando...' : <><CheckCircle className="w-5 h-5 mr-2 inline-block" /> Confirmar e Registrar</>} </button> </> )}
            {lastMovementId && ( <> <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Fechar</button> <button type="button" onClick={() => handleGenerateMovementReceipt(lastMovementId)} className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center"> <FileText className="w-5 h-5 mr-2" /> Gerar Recibo </button> </> )}
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
  onSave: (assetData: Omit<Asset, 'id' | 'sku' | 'item_type_name' | 'current_unit_name' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  asset: Asset | null; // Se for null, é adição; se for Asset, é edição
  itemTypes: ItemType[]; // Lista de tipos de itens para o dropdown
  units: Unit[]; // Lista de unidades para o dropdown
  translateStatus: (status: string) => string;
}

const AssetModal = ({ onClose, onSave, asset, itemTypes, units, translateStatus }: AssetModalProps) => {
  const [itemTypeId, setItemTypeId] = useState<string>(asset?.item_type_id?.toString() || '');
  const [brand, setBrand] = useState<string>(asset?.brand || '');
  const [model, setModel] = useState<string>(asset?.model || '');
  const [description, setDescription] = useState<string>(asset?.description || '');
  const [serialNumber, setSerialNumber] = useState<string>(asset?.serial_number || '');
  const [patrimonioNumber, setPatrimonioNumber] = useState<string>(asset?.patrimonio_number || '');
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>(asset?.unit_of_measure || '');
  const [status, setStatus] = useState<string>(asset?.status || 'available');
  const [currentUnitId, setCurrentUnitId] = useState<string>(asset?.current_unit_id?.toString() || '');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(asset?.acquisition_date || new Date().toISOString().split('T')[0]);
  const [warrantyEndDate, setWarrantyEndDate] = useState<string>(asset?.warranty_end_date || '');
  const [notes, setNotes] = useState<string>(asset?.notes || '');
  const [loading, setLoading] = useState<boolean>(false);

  const unitsForDropdown = useMemo(() => {
    const list = asset ? units : units.filter(unit => unit.name.toLowerCase().includes('almoxarifado'));
    // Formata para o react-select
    return list.map(unit => ({ value: unit.id.toString(), label: unit.name }));
  }, [units, asset]);

  const statusesForDropdown = useMemo(() => {
    const allStatuses = ['available', 'in_use', 'loaned', 'maintenance', 'retired', 'disposed'];
    return asset ? allStatuses : ['available'];
  }, [asset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const assetData = {
      item_type_id: parseInt(itemTypeId),
      brand, model, description: description || undefined,
      serial_number: serialNumber || undefined,
      patrimonio_number: patrimonioNumber || undefined,
      unit_of_measure: unitOfMeasure || undefined,
      status,
      current_unit_id: currentUnitId ? parseInt(currentUnitId) : undefined,
      acquisition_date: acquisitionDate || undefined,
      warranty_end_date: warrantyEndDate || undefined,
      notes: notes || undefined,
    };
    await onSave(assetData, asset?.id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {asset ? 'Editar Ativo' : 'Adicionar Novo Ativo'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
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
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
              // Desabilita o campo se for um novo cadastro, pois só há uma opção
              disabled={!asset} 
            >
              {/* O dropdown agora usa a lista filtrada 'statusesForDropdown' */}
              {statusesForDropdown.map((s) => (
                <option key={s} value={s}>
                  {translateStatus(s)}
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
            <label htmlFor="currentUnitId" className="block text-sm font-medium text-gray-700 mb-1">
              {asset ? 'Unidade Atual (Opcional)' : 'Unidade de Entrada *'}
            </label>
            {/* <<< O <select> HTML FOI SUBSTITUÍDO PELO <Select> INTELIGENTE >>> */}
            <Select
              id="currentUnitId"
              options={unitsForDropdown}
              value={unitsForDropdown.find(option => option.value === currentUnitId) || null}
              onChange={(selectedOption) => setCurrentUnitId(selectedOption ? selectedOption.value : '')}
              placeholder="Digite para buscar a unidade..."
              isClearable
              noOptionsMessage={() => "Nenhuma unidade encontrada"}
              required={!asset}
            />
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
  const [isActive, setIsActive] = useState<boolean>(userToEdit?.is_active ?? true); // <<< NOVO ESTADO
  const [loading, setLoading] = useState(false);

  const isEditing = !!userToEdit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const userData = {
        username,
        email,
        full_name: fullName,
        role,
        is_active: isActive, // <<< NOVO CAMPO ENVIADO
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
          {/* <<< NOVO CAMPO DE CHECKBOX ADICIONADO AQUI >>> */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium text-gray-700">Status da Conta</span>
            <label htmlFor="isActive" className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  className="sr-only" 
                  checked={isActive}
                  onChange={() => setIsActive(!isActive)}
                />
                <div className={`block w-14 h-8 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'transform translate-x-6' : ''}`}></div>
              </div>
              <div className="ml-3 text-gray-700 font-medium">
                {isActive ? 'Ativa' : 'Inativa'}
              </div>
            </label>
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
// App.tsx -> SUBSTITUA SEU COMPONENTE AuditLogPage POR ESTE

interface AuditLogPageProps {
  logs: AuditLog[];
  API_URL: string;
  users: User[];
}

const AuditLogPage = ({ logs: initialLogs, API_URL, users }: AuditLogPageProps) => {
  const [filters, setFilters] = useState({ userId: '', actionType: '', startDate: '', endDate: '' });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast(); // <<< CORRIGIDO: A chamada do hook addToast foi adicionada

  useEffect(() => {
    setAuditLogs(initialLogs);
  }, [initialLogs]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.actionType) params.append('actionType', filters.actionType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await axios.get(`${API_URL}/audit-logs`, { params });
      setAuditLogs(response.data);
    } catch (error) {
      addToast('Não foi possível realizar a busca.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async (format: 'pdf' | 'csv' | 'xlsx') => {
    addToast(`Gerando relatório ${format.toUpperCase()}...`, 'info');
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await axios.get(`${API_URL}/reports/audit-logs/${format}?${params}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_auditoria_filtrado.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      addToast(`Relatório ${format.toUpperCase()} gerado com sucesso!`, 'success');

    } catch (error) {
      addToast('Erro ao gerar relatório.', 'error');
    }
  };
  
  const formatJsonDetails = (details: any) => {
    if (!details) return 'N/A';
    return JSON.stringify(details, null, 2);
  };

  const uniqueActionTypes = Array.from(new Set(initialLogs.map(log => log.action_type))).sort();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900">Logs de Auditoria do Sistema</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-lg border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
            <select name="userId" id="userId" value={filters.userId} onChange={handleFilterChange} className="w-full p-2 border rounded-md">
              <option value="">Todos</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ação</label>
            <select name="actionType" id="actionType" value={filters.actionType} onChange={handleFilterChange} className="w-full p-2 border rounded-md">
              <option value="">Todas</option>
              {uniqueActionTypes.map(action => (
                <option key={action} value={action}>
                  {translateActionType(action)}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full p-2 border rounded-md"/>
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full p-2 border rounded-md"/>
          </div>
        </div>
        <div className="flex justify-end mt-4">
            <button onClick={handleSearch} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center disabled:opacity-50">
              <Search className="w-5 h-5 mr-2" />
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Resultados da Busca</h3>
          <div className="flex gap-2">
              <button onClick={() => handleDownloadReport('csv')} className="bg-gray-600 text-white px-3 py-1 rounded-md shadow-sm hover:bg-gray-700 text-xs">Exportar (CSV)</button>
              <button onClick={() => handleDownloadReport('xlsx')} className="bg-gray-600 text-white px-3 py-1 rounded-md shadow-sm hover:bg-gray-700 text-xs">Exportar (XLSX)</button>
              <button onClick={() => handleDownloadReport('pdf')} className="bg-gray-600 text-white px-3 py-1 rounded-md shadow-sm hover:bg-gray-700 text-xs">Exportar (PDF)</button>
          </div>
        </div>
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
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10">Buscando...</td></tr>
              ) : auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4">{log.user_name || log.username || 'Sistema'}</td>
                    <td className="px-6 py-4">{translateActionType(log.action_type)}</td>
                    <td className="px-6 py-4">{log.target_entity || 'N/A'}</td>
                    <td className="px-6 py-4">{log.ip_address}</td>
                    <td className="px-6 py-4">
                      <pre className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap break-all">
                        {formatJsonDetails(log.details)}
                      </pre>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="text-center py-10">Nenhum log encontrado com os filtros aplicados.</td></tr>
              )}
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
// App.tsx -> SUBSTITUA O COMPONENTE PeopleModal PELA VERSÃO ABAIXO

// A interface de props permanece a mesma
interface PeopleModalProps {
  onClose: () => void;
  onSave: (personData: Omit<Person, 'id' | 'unit_name' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  person: Person | null;
  units: Unit[];
}

// COMPONENTE PeopleModal 

const PeopleModal = ({ onClose, onSave, person, units }: PeopleModalProps) => {
  // Estados para os dados da pessoa
  const [fullName, setFullName] = useState<string>(person?.full_name || '');
  const [registrationNumber, setRegistrationNumber] = useState<string>(person?.registration_number || '');
  const [cpf, setCpf] = useState<string>(person?.cpf || '');
  const [email, setEmail] = useState<string>(person?.email || '');
  const [contactPhone, setContactPhone] = useState<string>(person?.contact_phone || '');
  const [jobTitle, setJobTitle] = useState<string>(person?.job_title || ''); // <<< NOVO ESTADO ADICIONADO

  // Estados para controlar o wizard de lotação
  const [selectedUnitType, setSelectedUnitType] = useState<'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA' | ''>('');
  const [level1UnitId, setLevel1UnitId] = useState<string>('');
  const [level2UnitId, setLevel2UnitId] = useState<string>('');
  const [level3UnitId, setLevel3UnitId] = useState<string>('');
  const [level4UnitId, setLevel4UnitId] = useState<string>('');
  const [finalUnitId, setFinalUnitId] = useState<string>(person?.unit_id?.toString() || '');

  const [loading, setLoading] = useState<boolean>(false);

  const formatOptions = (unitList: Unit[]) => unitList.map(u => ({ value: u.id.toString(), label: u.name }));

  // Lógica para popular os dropdowns em cascata
  const topLevelSeduc = useMemo(() => 
    units.find(u => u.name.toLowerCase() === 'secretaria de educação' && !u.parent_id), 
    [units]
  );

  const level1Options = useMemo(() => { // Secretarias Executivas
    if (selectedUnitType !== 'ADMINISTRATIVA' || !topLevelSeduc) return [];
    return units
        .filter(u => u.parent_id === topLevelSeduc.id)
        .map(u => ({ value: u.id.toString(), label: u.name }));
  }, [units, selectedUnitType, topLevelSeduc]);

  const level2Options = useMemo(() => { // Gerências Gerais / Gerências
    if (!level1UnitId) return [];
    return units
        .filter(u => u.parent_id === parseInt(level1UnitId))
        .map(u => ({ value: u.id.toString(), label: u.name }));
  }, [units, level1UnitId]);

  const level3Options = useMemo(() => { // Gerências / Setores
    if (!level2UnitId) return [];
    return units
        .filter(u => u.parent_id === parseInt(level2UnitId))
        .map(u => ({ value: u.id.toString(), label: u.name }));
  }, [units, level2UnitId]);

  const level4Options = useMemo(() => { // Setores
    if (!level3UnitId) return [];
    return units
        .filter(u => u.parent_id === parseInt(level3UnitId))
        .map(u => ({ value: u.id.toString(), label: u.name }));
  }, [units, level3UnitId]);


  const schoolUnits = useMemo(() => units.filter(u => u.type === 'ESCOLAR'), [units]);
  const externalUnits = useMemo(() => units.filter(u => u.type === 'EXTERNA' && !u.parent_id), [units]);

  // Efeito para preencher o formulário no modo de edição
  useEffect(() => {
    if (person && person.unit_id) {
      const personUnit = units.find(u => u.id === person.unit_id);
      if (personUnit) {
        setSelectedUnitType(personUnit.type);
        const hierarchy: Unit[] = [];
        let current: Unit | undefined = personUnit;
        while(current) {
            hierarchy.unshift(current);
            current = units.find(u => u.id === current?.parent_id);
        }
        
        // Remove a "Secretaria de Educação" (nível 0)
        if (hierarchy.length > 0 && hierarchy[0].id === topLevelSeduc?.id) {
          hierarchy.shift();
        }
        
        if (hierarchy[0]) setLevel1UnitId(hierarchy[0].id.toString());
        if (hierarchy[1]) setLevel2UnitId(hierarchy[1].id.toString());
        if (hierarchy[2]) setLevel3UnitId(hierarchy[2].id.toString());
        if (hierarchy[3]) setLevel4UnitId(hierarchy[3].id.toString());
        
        setFinalUnitId(person.unit_id.toString());
      }
    }
  }, [person, units, topLevelSeduc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const personData = {
      full_name: fullName,
      unit_id: finalUnitId ? parseInt(finalUnitId) : undefined,
      registration_number: registrationNumber || undefined,
      cpf,
      email,
      contact_phone: contactPhone || undefined,
      job_title: jobTitle || undefined, // <<< NOVO CAMPO ENVIADO
    };
    await onSave(personData, person?.id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">{person ? 'Editar Pessoa' : 'Adicionar Nova Pessoa'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-gray-200 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Nome Completo */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-2 border rounded-md" required />
              </div>
              {/* Cargo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo (Opcional)</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full p-2 border rounded-md" />
              </div>
              {/* CPF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <InputMask mask="999.999.999-99" value={cpf} onChange={(e) => setCpf(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" className="w-full p-2 border rounded-md" required />}</InputMask>
              </div>
              {/* Matrícula */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Opcional)</label>
                <InputMask mask="999999-9" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" className="w-full p-2 border rounded-md" />}</InputMask>
              </div>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded-md" required />
              </div>
              {/* Telefone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (Opcional)</label>
                <InputMask mask="(99) 99999-9999" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="tel" className="w-full p-2 border rounded-md" />}</InputMask>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Lotação (Opcional)</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">1. Tipo de Unidade</label>
              <select value={selectedUnitType} onChange={e => {
                  setSelectedUnitType(e.target.value as any);
                  setLevel1UnitId(''); setLevel2UnitId(''); setLevel3UnitId(''); setLevel4UnitId(''); setFinalUnitId('');
                }} className="w-full p-2 border rounded-md">
                <option value="">Selecione o tipo...</option>
                <option value="ADMINISTRATIVA">Unidade Administrativa (SEDUC)</option>
                <option value="ESCOLAR">Unidade Escolar</option>
                <option value="EXTERNA">Unidade Externa</option>
              </select>
            </div>

            {selectedUnitType === 'ADMINISTRATIVA' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">2. Secretaria Executiva</label>
                  <Select options={level1Options} isClearable placeholder="Selecione..."
                    onChange={(opt) => { 
                      const newId = opt ? opt.value : '';
                      setLevel1UnitId(newId);
                      setLevel2UnitId(''); setLevel3UnitId(''); setLevel4UnitId('');
                      setFinalUnitId(newId);
                    }}
                    value={level1Options.find(o => o.value === level1UnitId)}
                  />
                </div>
                {level1UnitId && level2Options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">3. Gerência Geral ou Gerência</label>
                    <Select options={level2Options} isClearable placeholder="Selecione..."
                      onChange={(opt) => {
                        const newId = opt ? opt.value : '';
                        setLevel2UnitId(newId);
                        setLevel3UnitId(''); setLevel4UnitId('');
                        setFinalUnitId(newId || level1UnitId);
                      }}
                      value={level2Options.find(o => o.value === level2UnitId)}
                    />
                  </div>
                )}
                {level2UnitId && level3Options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">4. Gerência ou Setor</label>
                    <Select options={level3Options} isClearable placeholder="Selecione..."
                      onChange={(opt) => {
                        const newId = opt ? opt.value : '';
                        setLevel3UnitId(newId);
                        setLevel4UnitId('');
                        setFinalUnitId(newId || level2UnitId);
                      }}
                      value={level3Options.find(o => o.value === level3UnitId)}
                    />
                  </div>
                )}
                {level3UnitId && level4Options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">5. Setor</label>
                    <Select options={level4Options} isClearable placeholder="Selecione..."
                      onChange={(opt) => {
                        const newId = opt ? opt.value : '';
                        setLevel4UnitId(newId);
                        setFinalUnitId(newId || level3UnitId);
                      }}
                      value={level4Options.find(o => o.value === level4UnitId)}
                    />
                  </div>
                )}
              </div>
            )}
            
            {selectedUnitType === 'ESCOLAR' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">2. Escola</label>
                <Select options={formatOptions(schoolUnits)} isClearable placeholder="Busque a Escola..."
                  onChange={(opt) => setFinalUnitId(opt ? opt.value : '')}
                  value={formatOptions(schoolUnits).find(o => o.value === finalUnitId)}
                />
              </div>
            )}
            
            {selectedUnitType === 'EXTERNA' && (
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">2. Unidade Externa</label>
                 <Select options={formatOptions(externalUnits)} isClearable placeholder="Busque a Unidade Externa..."
                  onChange={(opt) => setFinalUnitId(opt ? opt.value : '')}
                  value={formatOptions(externalUnits).find(o => o.value === finalUnitId)}
                />
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 mt-6 border-t pt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              <Save className="w-5 h-5 mr-2 inline-block"/>{loading ? 'Salvando...' : 'Salvar Pessoa'}
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
              // A chamada para a API permanece a mesma
              const response = await axios.post(`${API_URL}/users/me/change-password`, passwordData);
              
              // Captura o novo token da resposta do backend
              const { token: newToken } = response.data;
              
              // Salva o novo token no localStorage, substituindo o antigo
              localStorage.setItem('token', newToken);

              addToast('Senha alterada com sucesso! Redirecionando...', 'success');
              
              // Recarrega a aplicação após 2 segundos
              setTimeout(() => {
                window.location.reload();
              }, 2000);
              
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

interface MovementQueryPageProps {
  filters: any;
  movements: Movement[];
  isReportEnabled: boolean;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onFilterSubmit: () => void;
  onFilterClear: () => void;
  onGenerateReport: () => void;
  onRegisterMovementClick: () => void;
  translateMovementType: (type: string) => string;
  handleGenerateMovementReceipt: (id: number) => void;
}

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

