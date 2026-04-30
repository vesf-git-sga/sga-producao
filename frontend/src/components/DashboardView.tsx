// src/components/DashboardView.tsx
import React, { useState } from 'react';
import { 
  LayoutDashboard, Activity, Truck, Repeat, Database, CheckCircle, 
  Calendar, AlertTriangle as AlertTriangleIcon, Trash2, PieChart, 
  History, ShieldCheck, FileCheck, FileWarning, FilterX, TrendingUp, Layers, HeartPulse
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Cell 
} from 'recharts';

// --- Interfaces ---
export interface DashboardData {
  totalAssets: number;
  availableAssets: number;
  inUseAssets: number;
  loanedAssets: number;
  maintenanceAssets: number;
  retiredAssets: number;
  disposedAssets: number;
  pendingDeliveriesCount: number;   
  pendingSubstitutionsCount: number;  
  assetsByCategory: { name: string; value: number }[];
  
  // Drill-downs
  assetsBreakdown?: Record<string, { name: string; value: number }[]>; 
  statusBreakdown?: Record<string, { available: number; in_use: number; loaned: number; maintenance: number }>; 
  assetsAdvancedBreakdown?: Record<string, Record<string, { name: string; value: number }[]>>; // <<< NOVO
  
  recentMovements: { id: number | string; asset: string; type: string; date: string; user: string }[];
  pendingAlerts: { id: string; message: string; asset: string; dueDate: string }[];
  expiringWarranties: { count: number; description: string; endDate: string; daysRemaining: number }[];
}

interface User {
  full_name?: string;
}

interface DashboardViewProps {
  data: DashboardData;
  expiringWarranties: any[];
  user: User | null;
  onRefresh: () => void;
  onNavigateToDeliveries: () => void;
  onNavigateToSubstitutions: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
  data, 
  expiringWarranties, 
  user, 
  onRefresh,
  onNavigateToDeliveries,
  onNavigateToSubstitutions
}) => {
  
  // >>> ESTADOS DOS FILTROS CRUZADOS <<<
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null); // <<< NOVO ESTADO

  const CATEGORY_COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#8b5cf6', '#ec4899'];

  const STATUS_COLORS: { [key: string]: string } = {
    'Disponíveis': '#10B981', 
    'Em Uso': '#4F46E5',      
    'Manutenção': '#F59E0B',  
    'Baixados': '#EF4444',    
    'Descartados': '#6B7280'  
  };

  const translateMovementType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      entry: 'Entrada', exit: 'Saída', loan: 'Empréstimo', return: 'Devolução', maintenance: 'Manutenção'
    };
    return typeMap[type] || type;
  };

  // Calcula dados para o Gráfico de Saúde GERAL
  const statusChartDataGeneral = [
    { name: 'Disponíveis', value: data.availableAssets },
    { name: 'Em Uso', value: data.inUseAssets + (data.loanedAssets || 0) }, 
    { name: 'Manutenção', value: data.maintenanceAssets },
    { name: 'Baixados', value: data.retiredAssets },
  ].filter(i => i.value > 0);

  // Calcula dados para o Gráfico de Saúde ESPECÍFICA (Se houver categoria selecionada)
  let statusChartDataSpecific: any[] = [];
  if (selectedCategory && data.statusBreakdown && data.statusBreakdown[selectedCategory]) {
      const sp = data.statusBreakdown[selectedCategory];
      statusChartDataSpecific = [
          { name: 'Disponíveis', value: sp.available },
          { name: 'Em Uso', value: sp.in_use + sp.loaned },
          { name: 'Manutenção', value: sp.maintenance }
      ].filter(i => i.value > 0);
  }

  // >>> LÓGICA DE DADOS DO 3º GRÁFICO (MARCAS E MODELOS) <<<
  let modelsData: any[] = [];
  if (selectedCategory && selectedStatus && data.assetsAdvancedBreakdown) {
      // Cruzamento Categoria + Status
      modelsData = data.assetsAdvancedBreakdown[selectedCategory]?.[selectedStatus] || [];
  } else if (selectedCategory && data.assetsBreakdown) {
      // Apenas Categoria
      modelsData = data.assetsBreakdown[selectedCategory] || [];
  } else if (selectedStatus && data.assetsAdvancedBreakdown) {
      // Apenas Status (Global)
      modelsData = data.assetsAdvancedBreakdown['GLOBAL']?.[selectedStatus] || [];
  }

  // Verifica se há filtro ativo para exibir o header de controle
  const hasActiveFilter = selectedCategory || selectedStatus;

  const utilizationRate = data.totalAssets > 0 
    ? (((data.inUseAssets + (data.loanedAssets || 0)) / data.totalAssets) * 100).toFixed(1)
    : '0.0';

  const StatCard = ({ title, value, icon: Icon, colorClass, highlight }: any) => (
    <div className={`relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border ${highlight ? 'border-blue-200 ring-4 ring-blue-50' : 'border-gray-100'} flex items-center justify-between ${colorClass}`}>
      <div className="z-10">
        <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{title}</p>
        <h3 className="text-3xl font-extrabold">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-white bg-opacity-30 z-10`}>
        {Icon && <Icon className="w-8 h-8" />}
      </div>
      {Icon && <Icon className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 z-0 rotate-12"/>}
    </div>
  );

  return (
    <div className="space-y-8 pb-10 animate-fadeIn">
      
      {/* 1. TOPO: BOAS-VINDAS E RESUMO EXECUTIVO */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-5">
        <div>
           <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Painel Executivo</h1>
           <p className="text-slate-500 mt-1">
             Secretaria de Educação • Visão Logística e Distribuição
           </p>
        </div>
        <button onClick={onRefresh} className="text-sm font-bold text-blue-700 hover:text-blue-900 flex items-center bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg transition-all active:scale-95 mt-4 md:mt-0 shadow-sm">
            <Activity className="w-4 h-4 mr-2"/> Sincronizar Dados
        </button>
      </div>

      {/* 2. KPIS DE OURO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Taxa de Utilização" value={`${utilizationRate}%`} icon={TrendingUp} colorClass="bg-gradient-to-br from-blue-700 to-blue-900 text-white" highlight={true} />
        <StatCard title="Acervo Físico Total" value={data.totalAssets} icon={Database} colorClass="bg-slate-50 text-slate-800" />
        <StatCard title="Em Operação (Pontos)" value={data.inUseAssets + data.loanedAssets} icon={CheckCircle} colorClass="bg-emerald-50 text-emerald-800" />
        <StatCard title="Livre em Estoque" value={data.availableAssets} icon={Layers} colorClass="bg-indigo-50 text-indigo-800" />
        <StatCard title="Parado/Manutenção" value={data.maintenanceAssets} icon={AlertTriangleIcon} colorClass="bg-amber-50 text-amber-800" />
      </div>

      {/* 3. ALARMES LOGÍSTICOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div 
              onClick={onNavigateToDeliveries}
              className={`cursor-pointer border-l-4 p-5 rounded-r-xl shadow-sm flex justify-between items-center relative overflow-hidden transition-all hover:shadow-md group
                ${data.pendingDeliveriesCount > 0 ? 'bg-orange-50 border-orange-500' : 'bg-green-50 border-green-500'}`}
           >
                <div className="relative z-10">
                    <h3 className={`font-bold text-lg flex items-center ${data.pendingDeliveriesCount > 0 ? 'text-orange-900' : 'text-green-900'}`}>
                       {data.pendingDeliveriesCount > 0 ? <FileWarning className="w-5 h-5 mr-2"/> : <FileCheck className="w-5 h-5 mr-2"/>}
                       Entregas {data.pendingDeliveriesCount > 0 ? 'Pendentes' : 'Regularizadas'}
                    </h3>
                    <p className={`text-sm mt-1 ${data.pendingDeliveriesCount > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                        {data.pendingDeliveriesCount > 0 ? 'Assinaturas ou lotes aguardando fechamento.' : 'Fluxo logístico 100% documentado e em dia.'}
                    </p>
                </div>
                <span className={`text-4xl font-black relative z-10 ${data.pendingDeliveriesCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {data.pendingDeliveriesCount}
                </span>
                <Truck className={`absolute -bottom-2 -right-2 w-24 h-24 opacity-10 z-0 transition-transform group-hover:scale-110 ${data.pendingDeliveriesCount > 0 ? 'text-orange-500' : 'text-green-500'}`}/>
           </div>

           <div 
              onClick={onNavigateToSubstitutions}
              className={`cursor-pointer border-l-4 p-5 rounded-r-xl shadow-sm flex justify-between items-center relative overflow-hidden transition-all hover:shadow-md group
                ${data.pendingSubstitutionsCount > 0 ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}
           >
                <div className="relative z-10">
                    <h3 className={`font-bold text-lg flex items-center ${data.pendingSubstitutionsCount > 0 ? 'text-red-900' : 'text-green-900'}`}>
                       {data.pendingSubstitutionsCount > 0 ? <Repeat className="w-5 h-5 mr-2"/> : <CheckCircle className="w-5 h-5 mr-2"/>}
                       Trocas / Avarias {data.pendingSubstitutionsCount > 0 ? 'Abertas' : 'Zeradas'}
                    </h3>
                    <p className={`text-sm mt-1 ${data.pendingSubstitutionsCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {data.pendingSubstitutionsCount > 0 ? 'Equipamentos aguardando substituição física.' : 'Nenhum chamado de avaria não resolvido.'}
                    </p>
                </div>
                <span className={`text-4xl font-black relative z-10 ${data.pendingSubstitutionsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.pendingSubstitutionsCount}
                </span>
                <Repeat className={`absolute -bottom-2 -right-2 w-24 h-24 opacity-10 z-0 transition-transform group-hover:-rotate-12 ${data.pendingSubstitutionsCount > 0 ? 'text-red-500' : 'text-green-500'}`}/>
           </div>
      </div>

      {/* 4. VISÃO GRÁFICA INTERATIVA CRUZADA (DRILL-DOWN) */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
        
        {/* Cabeçalho de Filtro Ativo */}
        {hasActiveFilter && (
            <div className="flex justify-between items-center bg-indigo-100 border border-indigo-200 p-3 rounded-xl mb-4 animate-fadeIn">
                <span className="text-indigo-800 font-bold flex items-center">
                    <FilterX className="w-4 h-4 mr-2"/> Mostrando detalhamento para: 
                    {selectedCategory && <span className="uppercase ml-2 bg-white px-2 py-0.5 rounded shadow-sm text-indigo-900">{selectedCategory}</span>}
                    {selectedCategory && selectedStatus && <span className="mx-2 text-indigo-400">+</span>}
                    {selectedStatus && <span className="uppercase ml-1 bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm">{selectedStatus}</span>}
                </span>
                <button 
                    onClick={() => { setSelectedCategory(null); setSelectedStatus(null); }}
                    className="flex items-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors shadow-sm"
                >
                    Remover Filtros
                </button>
            </div>
        )}

        {/* Grade Dinâmica */}
        <div className={`grid grid-cols-1 ${hasActiveFilter ? 'xl:grid-cols-3 lg:grid-cols-2' : 'lg:grid-cols-2'} gap-6 transition-all duration-500`}>
            
            {/* GRÁFICO 1: CATEGORIAS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-base font-bold text-gray-800 flex items-center">
                      <PieChart className="w-5 h-5 mr-2 text-sky-500"/> Composição
                  </h3>
                  {!selectedCategory && (
                      <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-1 rounded font-bold border border-sky-100 uppercase tracking-wider hidden sm:inline-block">
                          Clique na barra
                      </span>
                  )}
              </div>
              
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={data.assetsByCategory} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#475569', fontWeight: 600}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar 
                        dataKey="value" 
                        name="Quantidade" 
                        radius={[0, 4, 4, 0]} 
                        barSize={hasActiveFilter ? 20 : 28}
                        onClick={(entry) => setSelectedCategory(selectedCategory === entry.name ? null : entry.name)}
                        cursor="pointer"
                    >
                      {data.assetsByCategory.map((entry, index) => (
                          <Cell 
                              key={`cell-${index}`} 
                              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                              opacity={selectedCategory && selectedCategory !== entry.name ? 0.2 : 1}
                              className="transition-opacity duration-300"
                          />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICO 2: SAÚDE */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                  <h3 className={`text-base font-bold flex items-center ${selectedCategory ? 'text-indigo-900' : 'text-gray-800'}`}>
                      <HeartPulse className={`w-5 h-5 mr-2 ${selectedCategory ? 'text-indigo-600' : 'text-emerald-500'}`}/> 
                      {selectedCategory ? `Saúde: ${selectedCategory}` : 'Saúde Geral (Todos)'}
                  </h3>
                  {!selectedStatus && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold border border-emerald-100 uppercase tracking-wider hidden sm:inline-block">
                          Clique na barra
                      </span>
                  )}
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedCategory ? statusChartDataSpecific : statusChartDataGeneral} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b', fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} hide/>
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar 
                        dataKey="value" 
                        name="Quantidade" 
                        radius={[6, 6, 0, 0]} 
                        barSize={40} 
                        label={{ position: 'top', fill: '#475569', fontSize: 13, fontWeight: 'bold' }}
                        onClick={(entry) => { if (entry.name !== 'Baixados') setSelectedStatus(selectedStatus === entry.name ? null : entry.name) }}
                    >
                        {(selectedCategory ? statusChartDataSpecific : statusChartDataGeneral).map((entry, index) => (
                            <Cell 
                                key={`cell-status-${index}`} 
                                fill={STATUS_COLORS[entry.name] || '#94a3b8'} 
                                opacity={selectedStatus && selectedStatus !== entry.name ? 0.3 : 1}
                                className="transition-opacity duration-300"
                                cursor={entry.name !== 'Baixados' ? 'pointer' : 'default'} // <<< O CURSOR VEIO PARA CÁ
                            />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICO 3: MARCAS / MODELOS (Só aparece se houver algum filtro ativo) */}
            {hasActiveFilter && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px] animate-fadeIn xl:col-span-1 lg:col-span-2">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                      <h3 className="text-base font-bold text-indigo-900 flex items-center">
                          <Layers className="w-5 h-5 mr-2 text-indigo-600"/> 
                          {selectedStatus ? `Modelos em "${selectedStatus}"` : 'Modelos Cadastrados'}
                      </h3>
                  </div>
                  <div className="flex-1">
                    {modelsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={modelsData} margin={{ top: 20, right: 10, left: 10, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} interval={0} angle={-25} textAnchor="end"/>
                            <YAxis hide/>
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                            <Bar 
                                dataKey="value" 
                                name="Unidades" 
                                fill={selectedStatus ? STATUS_COLORS[selectedStatus] : '#4F46E5'} 
                                radius={[4, 4, 0, 0]} 
                                barSize={35} 
                                label={{ position: 'top', fill: '#475569', fontSize: 11, fontWeight: 'bold' }} 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <CheckCircle className="w-10 h-10 mb-3 opacity-20"/>
                            <p className="text-sm font-medium text-center px-4">Não há modelos com esta combinação de filtros.</p>
                        </div>
                    )}
                  </div>
                </div>
            )}

        </div>
      </div>

      {/* 5. LISTAS DE MONITORAMENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center border-b pb-2"><ShieldCheck className="w-5 h-5 mr-2 text-orange-500"/> Garantias (90 dias)</h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin space-y-3">
                {expiringWarranties.length > 0 ? (
                    expiringWarranties.map((item, i) => (
                        <div key={i} className="flex items-start p-3 bg-orange-50 rounded-lg border border-orange-100 hover:border-orange-300 transition-colors">
                            <div className="bg-white text-orange-600 font-black rounded-md px-2 py-1 text-xs mr-3 shadow-sm border border-orange-100 min-w-[3rem] text-center">{item.daysRemaining}d</div>
                            <div><p className="text-sm font-bold text-gray-800">{item.count}x {item.description}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Vence em: {item.endDate}</p></div>
                        </div>
                    ))
                ) : <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10"><CheckCircle className="w-10 h-10 mb-2 opacity-20"/><p className="text-sm">Nenhuma garantia próxima.</p></div>}
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center border-b pb-2"><AlertTriangleIcon className="w-5 h-5 mr-2 text-red-500"/> Devoluções em Atraso</h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin space-y-3">
                {data.pendingAlerts.length > 0 ? (
                    data.pendingAlerts.map((alert: any) => (
                         <div key={alert.id} className="p-3 bg-red-50 border border-red-100 rounded-lg hover:border-red-300 transition-colors">
                            <p className="text-sm font-bold text-red-800">{alert.message}</p>
                            <p className="text-xs text-red-600 mt-1 font-medium">{alert.asset}</p>
                            <div className="mt-2 flex items-center text-[10px] text-red-500 font-bold bg-white w-fit px-2 py-0.5 rounded border border-red-100"><Calendar className="w-3 h-3 mr-1"/> Venceu em: {alert.dueDate}</div>
                          </div>
                    ))
                ) : <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10"><CheckCircle className="w-10 h-10 mb-2 opacity-20"/><p className="text-sm">Tudo em dia.</p></div>}
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center border-b pb-2"><History className="w-5 h-5 mr-2 text-blue-500"/> Últimas Atividades</h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
                <ul className="space-y-0 relative">
                    {data.recentMovements.map((mov: any) => (
                        <li key={mov.id} className="py-3 pl-4 border-l-2 border-gray-100 hover:border-blue-500 transition-colors relative group">
                            <span className={`absolute -left-[5px] top-4 w-2.5 h-2.5 rounded-full ${mov.type === 'entry' ? 'bg-green-400' : mov.type === 'exit' ? 'bg-blue-400' : mov.type === 'loan' ? 'bg-indigo-400' : 'bg-orange-400'} group-hover:scale-150 transition-transform`}></span>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{translateMovementType(mov.type)}</p>
                                    <p className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-1" title={mov.asset}>{mov.asset}</p>
                                    <p className="text-xs text-gray-500 mt-0.5 font-medium">Por: {mov.user}</p>
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">{mov.date.split(' ')[0]}</span>
                            </div>
                        </li>
                    ))}
                    {data.recentMovements.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">Nenhuma atividade recente.</p>}
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;