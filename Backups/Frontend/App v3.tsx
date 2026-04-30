import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import {
  Mail, Lock, LogIn, Menu, X, LayoutDashboard, HardDrive, BarChart2, Bell, Settings, LogOut,
  Box, CornerDownRight, CornerUpLeft, Calendar, List, PlusCircle, UploadCloud, Edit, Trash2,
  CheckCircle, XCircle, Info, AlertTriangle as AlertTriangleIcon, Repeat, FileText, Users // Adicionado Users para pessoas
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios, { AxiosError } from 'axios';

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

// Interface para Ativos
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

// Interface para Pessoas (NOVA)
interface Person {
  id: number;
  full_name: string;
  secretariat?: string; // Vem do JOIN com sectors
  executive?: string;   // Vem do JOIN com sectors
  sector_id?: number;
  sector_name?: string; // Vem do JOIN com sectors
  registration_number?: string;
  cpf: string;
  email: string;
}

// Interface para Movimentações (ATUALIZADA com campos de pessoa)
interface Movement {
  id: number;
  asset_id: number;
  movement_type: 'entry' | 'exit' | 'loan' | 'return' | 'maintenance';
  movement_date: string; // ISO date string
  responsible_user_id: number;
  recipient_person_id?: number; // NOVO: ID da pessoa cadastrada
  recipient_name?: string;
  recipient_document?: string;
  purpose?: string;
  expected_return_date?: string; // ISO date string
  actual_return_date?: string; // ISO date string
  notes?: string;
  created_at: string;
  updated_at: string;
  sku: string;
  brand: string;
  model: string;
  responsible_username: string;
  responsible_full_name?: string;
  recipient_person_full_name?: string; // Adicionado para exibir no frontend
  recipient_person_cpf?: string;      // Adicionado para exibir no frontend
  recipient_person_registration?: string; // Adicionado para exibir no frontend
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
    <div className="fixed top-4 right-4 z-[1000] space-y-3">
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

// CORREÇÃO: Tipagem do children para { children: ReactNode }
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
            src="https://placehold.co/150x80/007bff/ffffff?text=Logo+Prefeitura"
            alt="Logo Prefeitura do Recife"
            className="h-20 w-auto rounded-lg shadow-md"
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

// Componente do Dashboard
const DashboardPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const { user, logout, API_URL, loading: authLoading } = useContext(AuthContext) as AuthContextType;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [people, setPeople] = useState<Person[]>([]); // NOVO: Estado para pessoas
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [showItemTypeModal, setShowItemTypeModal] = useState<boolean>(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [showSectorModal, setShowSectorModal] = useState<boolean>(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showPeopleModal, setShowPeopleModal] = useState<boolean>(false); // NOVO: Estado para modal de pessoas
  const [editingPerson, setEditingPerson] = useState<Person | null>(null); // NOVO: Estado para pessoa em edição
  const { addToast } = useToast();

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

  const fetchMovements = useCallback(async () => {
    console.log('Fetching movements...');
    try {
      const response = await axios.get<Movement[]>(`${API_URL}/asset-movements`);
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

  useEffect(() => {
    if (user && !authLoading) {
      console.log('User authenticated, fetching dashboard data...');
      fetchDashboardData();
      fetchItemTypes();
      fetchSectors();
      fetchAssets();
      fetchMovements();
      fetchPeople(); // NOVO: Carrega pessoas ao iniciar
    }
  }, [user, authLoading, fetchAssets, fetchItemTypes, fetchSectors, fetchDashboardData, fetchMovements, fetchPeople]);

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
    { name: 'Tipos de Itens', icon: List, id: 'item-types', roles: ['admin', 'manager'] },
    { name: 'Setores', icon: List, id: 'sectors', roles: ['admin', 'manager'] },
    { name: 'Pessoas', icon: Users, id: 'people', roles: ['admin', 'manager'] }, // NOVO: Menu Pessoas
    { name: 'Ativos', icon: HardDrive, id: 'assets', roles: ['admin', 'manager', 'basic'] },
    { name: 'Movimentações', icon: Repeat, id: 'movements', roles: ['admin', 'manager'] },
    { name: 'Relatórios', icon: BarChart2, id: 'reports' },
    { name: 'Alertas', icon: Bell, id: 'alerts' },
    { name: 'Configurações', icon: Settings, id: 'settings', roles: ['admin'] },
  ];

  const canAccess = (roles: string[]): boolean => {
    if (!roles) return true;
    return roles.includes(user?.role || '');
  };

  // Funções de manipulação para Tipos de Itens
  const handleEditItemType = (itemType: ItemType) => {
    setEditingItemType(itemType);
    setShowItemTypeModal(true);
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
          ? axiosError.response.data.message // CORREÇÃO AQUI
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
          ? axiosError.response.data.message // CORREÇÃO AQUI
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
          ? axiosError.response.data.message // CORREÇÃO AQUI
          : 'Erro ao excluir ativo.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir ativo:', axiosError);
      }
    }
  };

  // NOVO: Funções de manipulação para Pessoas
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
          ? axiosError.response.data.message // CORREÇÃO AQUI
          : 'Erro ao excluir pessoa.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir pessoa:', axiosError);
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
        ? axiosError.response.data.message // CORREÇÃO AQUI
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

      <div className={`fixed top-0 left-0 h-full bg-blue-900 text-white w-64 p-5 z-50 transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
        <div className="flex items-center justify-between mb-8">
          {/* Image of Logo Prefeitura SGA */}
          <img
            src="https://placehold.co/180x60/0056b3/ffffff?text=Prefeitura+SGA"
            alt="Logo Prefeitura do Recife"
            className="h-10 w-auto rounded-md shadow-sm"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/180x60/0056b3/ffffff?text=Logo'; }}
          />
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            canAccess(item.roles || []) && (
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
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <span className="block text-sm font-medium text-gray-700">{user?.full_name || user?.username || 'Usuário'}</span>
              <span className="block text-xs text-gray-500">{user?.role || 'Visitante'}</span>
            </div>
            <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
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
                {/* Image of Ativos por Categoria (Pizza) */}
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

                {/* Image of Status dos Ativos (Barra) */}
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Setores</h3>
                {sectors.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Secretaria</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                          {canAccess(['admin', 'manager']) && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sectors.map((sector: Sector) => (
                          <tr key={sector.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sector.code}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sector.secretariat}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sector.sector_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sector.contact_phone || 'N/A'}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEditSector(sector)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <Edit className="inline-block w-4 h-4" /> Editar
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeleteSector(sector.id)}
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
                  <p className="text-gray-500 text-center py-4">Nenhum setor cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {/* NOVO: Seção de Pessoas */}
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
                  {/* Você pode adicionar importação de pessoas aqui se desejar, similar a item-types/sectors */}
                  {/* <input
                    type="file"
                    id="personFileInput"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'people')}
                  />
                  <label htmlFor="personFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Pessoas (XLSX/CSV)
                  </label> */}
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Pessoas</h3>
                {people.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Completo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Secretaria</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          {canAccess(['admin', 'manager']) && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {people.map((person: Person) => (
                          <tr key={person.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.full_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.secretariat || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.sector_name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.registration_number || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.cpf}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.email}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEditPerson(person)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <Edit className="inline-block w-4 h-4" /> Editar
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeletePerson(person.id)}
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Ativos</h3>
                {assets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modelo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor Atual</th>
                          {canAccess(['admin', 'manager']) && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {assets.map((asset: Asset) => (
                          <tr key={asset.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.sku}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.item_type_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.brand}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.model}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.status}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.current_sector_name || 'N/A'}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEditAsset(asset)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <Edit className="inline-block w-4 h-4" /> Editar
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeleteAsset(asset.id)}
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
                  <p className="text-gray-500 text-center py-4">Nenhum ativo cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {/* NOVO: Seção de Movimentações */}
          {activeMenu === 'movements' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Movimentações de Ativos</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => setShowMovementModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Registrar Nova Movimentação
                  </button>
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico de Movimentações</h3>
                {movements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo (SKU)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recebedor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Devolução Esperada</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {movements.map((movement: Movement) => (
                          <tr key={movement.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{movement.sku}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{movement.movement_type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{movement.responsible_full_name || movement.responsible_username}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{movement.recipient_person_full_name || movement.recipient_name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{movement.expected_return_date ? new Date(movement.expected_return_date).toLocaleDateString('pt-BR') : 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleGenerateMovementReceipt(movement.id)}
                                  className="text-purple-600 hover:text-purple-900 mr-3"
                                  title="Gerar Recibo PDF"
                                >
                                  <FileText className="inline-block w-4 h-4" /> Gerar Recibo
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

          {activeMenu === 'reports' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Geração de Relatórios</h1>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Relatórios de Ativos</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => handleDownloadReport('csv')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <BarChart2 className="w-5 h-5 mr-2" /> Exportar Ativos (CSV)
                  </button>
                  <button
                    onClick={() => handleDownloadReport('xlsx')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <BarChart2 className="w-5 h-5 mr-2" /> Exportar Ativos (XLSX)
                  </button>
                  <button
                    onClick={() => handleDownloadReport('pdf')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <BarChart2 className="w-5 h-5 mr-2" /> Exportar Ativos (PDF)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'alerts' && (
            <div className="text-center py-20 text-gray-600">
              <h1 className="text-3xl font-bold mb-4">Gerenciamento de Alertas</h1>
              <p>Visualize e gerencie os alertas automáticos do sistema.</p>
              {/* Image of Alerts */}
            </div>
          )}
          {activeMenu === 'settings' && (
            <div className="text-center py-20 text-gray-600">
              <h1 className="text-3xl font-bold mb-4">Configurações do Sistema</h1>
              <p>Gerencie usuários, perfis de acesso e outras configurações.</p>
              {/* Image of Settings */}
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
              setShowMovementModal(false);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message // CORREÇÃO AQUI
                : 'Erro ao registrar movimentação.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao registrar movimentação:', axiosError);
            }
          }}
          assets={assets}
          people={people} // Passa a lista de pessoas para o modal de movimentação
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
                ? axiosError.response.data.message // CORREÇÃO AQUI
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
              fetchPeople(); // Recarrega pessoas caso algum setor tenha sido alterado
              setShowSectorModal(false);
              setEditingSector(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message // CORREÇÃO AQUI
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
                ? axiosError.response.data.message // CORREÇÃO AQUI
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
              fetchMovements(); // Recarrega movimentações caso dados de pessoa tenham sido alterados
              setShowPeopleModal(false);
              setEditingPerson(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message // CORREÇÃO AQUI
                : 'Erro ao salvar pessoa.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar pessoa:', axiosError);
            }
          }}
          person={editingPerson}
          sectors={sectors} // Passa a lista de setores para o modal de pessoas
        />
      )}
    </div>
  );

  async function handleImport(file: File | null, type: string) {
    if (!file) {
      addToast('Por favor, selecione um arquivo para importar.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/${type}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      addToast(response.data.message, 'success');
      if (type === 'item-types') fetchItemTypes();
      if (type === 'sectors') fetchSectors();
      if (type === 'assets') fetchAssets();
      // if (type === 'people') fetchPeople(); // Descomentar se implementar importação de pessoas
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
        ? axiosError.response.data.message // CORREÇÃO AQUI
        : axiosError.message;
      console.error(`Erro ao importar ${type}:`, axiosError.response?.data || axiosError);
      addToast(`Erro ao importar ${type}: ${errorMessage}`, 'error');
    }
  }

  async function handleDownloadReport(format: string) {
    try {
      const response = await axios.get(`${API_URL}/reports/assets/${format}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: `application/${format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'vnd.openxmlformats-officedocument.spreadsheetml.sheet'}` }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_ativos.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast(`Relatório de ativos (${format.toUpperCase()}) gerado com sucesso!`, 'success');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
        ? axiosError.response.data.message // CORREÇÃO AQUI
        : axiosError.message;
      console.error(`Erro ao baixar relatório ${format}:`, axiosError.response?.data || axiosError);
      addToast(`Erro ao baixar relatório ${format}: ${errorMessage}`, 'error');
    }
  }
};

interface MovementModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<void>;
  assets: Asset[];
  people: Person[]; // NOVO: Recebe a lista de pessoas
}

const MovementModal = ({ onClose, onSave, assets, people }: MovementModalProps) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [movementType, setMovementType] = useState<Movement['movement_type']>('loan');
  const [recipientPersonId, setRecipientPersonId] = useState<string>(''); // NOVO: ID da pessoa recebedora
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientDocument, setRecipientDocument] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { user } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast(); // Para exibir mensagens de validação

  // Filtra ativos com base no tipo de movimentação selecionado
  const filteredAssets = assets.filter(asset => {
    switch (movementType) {
      case 'loan':
      case 'exit':
        return asset.status === 'available'; // Só pode emprestar/dar saída se estiver disponível
      case 'return':
        return ['loaned', 'in_use', 'maintenance'].includes(asset.status); // Só pode devolver se estiver emprestado/em uso/manutenção
      case 'maintenance':
        return !['retired', 'disposed'].includes(asset.status); // Pode ir para manutenção de qualquer status que não seja 'retired' ou 'disposed'
      case 'entry':
        return true; // Entrada pode ser para qualquer ativo (novo, voltando de descarte, etc.)
      default:
        return true;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validação de recebedor
    if (['loan', 'exit'].includes(movementType)) {
      if (!recipientPersonId && (!recipientName || !recipientDocument)) {
        addToast('Para empréstimo ou saída, é necessário selecionar uma pessoa cadastrada OU informar o nome e documento do recebedor.', 'warning');
        setLoading(false);
        return;
      }
    }

    if (movementType === 'loan' && !expectedReturnDate) {
      addToast('A data de devolução esperada é obrigatória para empréstimos.', 'warning');
      setLoading(false);
      return;
    }

    const movementData = {
      asset_id: parseInt(selectedAssetId),
      movement_type: movementType,
      responsible_user_id: user?.id,
      recipient_person_id: recipientPersonId ? parseInt(recipientPersonId) : undefined, // Envia ID da pessoa se selecionada
      recipient_name: recipientPersonId ? undefined : (recipientName || undefined), // Envia nome apenas se não for pessoa cadastrada
      recipient_document: recipientPersonId ? undefined : (recipientDocument || undefined), // Envia documento apenas se não for pessoa cadastrada
      purpose: purpose || undefined,
      expected_return_date: expectedReturnDate || undefined,
      actual_return_date: movementType === 'return' ? new Date().toISOString().split('T')[0] : undefined, // Adiciona data real de devolução
      notes: notes || undefined,
    };

    await onSave(movementData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Registrar Nova Movimentação</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="asset" className="block text-sm font-medium text-gray-700 mb-1">Ativo</label>
            <select
              id="asset"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Selecione um ativo</option>
              {filteredAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.sku} - {asset.brand} {asset.model} ({asset.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="movementType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
            <select
              id="movementType"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as Movement['movement_type'])}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="loan">Empréstimo</option>
              <option value="return">Devolução</option>
              <option value="entry">Entrada</option>
              <option value="exit">Saída</option>
              <option value="maintenance">Manutenção</option>
            </select>
          </div>

          {(movementType === 'loan' || movementType === 'exit') && (
            <>
              <div>
                <label htmlFor="recipientPerson" className="block text-sm font-medium text-gray-700 mb-1">Recebedor (Pessoa Cadastrada)</label>
                <select
                  id="recipientPerson"
                  value={recipientPersonId}
                  onChange={(e) => {
                    setRecipientPersonId(e.target.value);
                    if (e.target.value) { // Se uma pessoa for selecionada, limpa os campos manuais
                      setRecipientName('');
                      setRecipientDocument('');
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Selecione uma pessoa (opcional)</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name} ({person.cpf})
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-center text-sm text-gray-500 my-2">OU</div>
              <div>
                <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">Nome do Recebedor (Manual)</label>
                <input
                  type="text"
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    if (e.target.value) setRecipientPersonId(''); // Se digitar nome, deseleciona pessoa
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={!!recipientPersonId} // Desabilita se uma pessoa cadastrada for selecionada
                />
              </div>
              <div>
                <label htmlFor="recipientDocument" className="block text-sm font-medium text-gray-700 mb-1">Documento do Recebedor (Manual)</label>
                <input
                  type="text"
                  id="recipientDocument"
                  value={recipientDocument}
                  onChange={(e) => {
                    setRecipientDocument(e.target.value);
                    if (e.target.value) setRecipientPersonId(''); // Se digitar documento, deseleciona pessoa
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={!!recipientPersonId} // Desabilita se uma pessoa cadastrada for selecionada
                />
              </div>
              <div>
                <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">Finalidade</label>
                <textarea
                  id="purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                ></textarea>
              </div>
            </>
          )}

          {(movementType === 'loan' || movementType === 'maintenance') && (
            <div>
              <label htmlFor="expectedReturnDate" className="block text-sm font-medium text-gray-700 mb-1">Data de Devolução Esperada</label>
              <input
                type="date"
                id="expectedReturnDate"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required={movementType === 'loan'}
              />
            </div>
          )}

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              {loading ? 'Salvando...' : 'Salvar Movimentação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// Componente Modal de Tipo de Item (Mantido)
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
    await onSave({ name, description: description || undefined }, itemType?.id);
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
            <label htmlFor="itemTypeName" className="block text-sm font-medium text-gray-700 mb-1">Nome do Tipo de Item</label>
            <input
              type="text"
              id="itemTypeName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="itemTypeDescription" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              id="itemTypeDescription"
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
// Componente Modal de Pessoa (NOVO)
// =====================================================================================

interface PeopleModalProps {
  onClose: () => void;
  onSave: (personData: Omit<Person, 'id' | 'secretariat' | 'executive' | 'sector_name' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  person: Person | null; // Se for null, é adição; se for Person, é edição
  sectors: Sector[]; // Lista de setores para o dropdown
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
          <div>
            <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Opcional)</label>
            <input
              type="text"
              id="registrationNumber"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center font-sans text-white">
        <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-3 text-xl">Carregando...</span>
      </div>
    );
  }

  return user ? <DashboardPage /> : <LoginPage />;
};

export default App;
