import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BarChart2, CheckCircle, Clock, Users, Filter, X, ArrowDown, AlertTriangle, Calendar, Accessibility, PieChart } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList
} from 'recharts';

interface AnalyticsDashboardProps {
  API_URL: string;
}

// Cores do Cronograma
const STATUS_COLORS: any = { 'Em Dia': '#f59e0b', 'Atrasado': '#ef4444', 'Concluído': '#10b981' };

// Componente de Card
const KpiCard = ({ title, value, subtext, icon: Icon, color, bgClass, colorClass }: any) => {
    const colorMap: any = {
        blue: { border: 'border-blue-500', text: 'text-blue-600', bg: 'bg-blue-50', icon: 'text-blue-600' },
        green: { border: 'border-green-500', text: 'text-green-600', bg: 'bg-green-50', icon: 'text-green-600' },
        yellow: { border: 'border-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50', icon: 'text-yellow-600' },
        purple: { border: 'border-purple-500', text: 'text-purple-600', bg: 'bg-purple-50', icon: 'text-purple-600' },
        red: { border: 'border-red-500', text: 'text-red-600', bg: 'bg-red-50', icon: 'text-red-600' },
        orange: { border: 'border-orange-500', text: 'text-orange-600', bg: 'bg-orange-50', icon: 'text-orange-600' },
    };

    let style = colorMap[color] || { border: 'border-gray-300', text: 'text-gray-600', bg: 'bg-gray-50', icon: 'text-gray-400' };
    
    if (colorClass && bgClass) {
        style = {
            border: colorClass,
            bg: bgClass,
            text: colorClass.replace('border-', 'text-').replace('500', '600'), 
            icon: colorClass.replace('border-', 'text-').replace('500', '600')
        };
    }

    return (
        <div className={`bg-white p-5 rounded-xl shadow-sm border-l-4 ${style.border} flex justify-between items-start`}>
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
                <p className={`text-2xl font-extrabold mt-1 ${style.text}`}>{value}</p>
                {subtext && <p className="text-xs font-medium mt-1 text-gray-500">{subtext}</p>}
            </div>
            <div className={`p-2 rounded-full ${style.bg}`}>
                <Icon className={`w-6 h-6 ${style.icon}`} />
            </div>
        </div>
    );
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ API_URL }) => {
  const [filters, setFilters] = useState({ rpa: '', year: '' });
  const [deadlineFilter, setDeadlineFilter] = useState('');
  
  const [metrics, setMetrics] = useState<any>(null);
  const [schoolData, setSchoolData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.rpa) params.append('rpa', filters.rpa);
      if (filters.year) params.append('year', filters.year);
      
      const res = await axios.get(`${API_URL}/dashboard/tablets/metrics`, { params });
      setMetrics(res.data);
    } catch (error) { console.error("Erro métricas", error); } 
    finally { setLoading(false); }
  }, [API_URL, filters]);

  const fetchTableData = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.rpa) params.append('rpa', filters.rpa);
      if (filters.year) params.append('year', filters.year);
      const res = await axios.get(`${API_URL}/analytics/schools-performance`, { params });
      setSchoolData(res.data);
    } catch (error) { console.error("Erro tabela", error); } 
    finally { setTableLoading(false); }
  }, [API_URL, filters]);

  useEffect(() => {
    fetchDashboardData();
    fetchTableData();
  }, [fetchDashboardData, fetchTableData]);

  const handleChartClick = (data: any, type: 'rpa' | 'year') => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const value = data.activePayload[0].payload.name;
      setFilters(prev => ({ ...prev, [type]: prev[type] === value ? '' : value }));
    }
  };

  // >>> CLIQUE NO GRÁFICO DE BARRAS (PRAZOS) <<<
  const handleDeadlineClick = (data: any) => {
      if (data && data.activePayload && data.activePayload.length > 0) {
          const value = data.activePayload[0].payload.name;
          setDeadlineFilter(prev => prev === value ? '' : value);
      }
  };

  const clearFilters = () => {
      setFilters({ rpa: '', year: '' });
      setDeadlineFilter('');
  };

  if (loading && !metrics) return <div className="p-10 text-center text-gray-500">Carregando Inteligência...</div>;
  if (!metrics) return <div className="p-10 text-center text-red-500">Erro ao carregar dados.</div>;

  const { kpis, charts, batches = [] } = metrics;

  // Cálculos de Prazo
  const delayedBatchesCount = batches.filter((b: any) => b.is_delayed).length;
  const completedBatchesCount = batches.filter((b: any) => b.status === 'Concluído').length;
  const onTimeBatchesCount = batches.length - delayedBatchesCount - completedBatchesCount;

  const deadlinesData = [
      { name: 'Concluído', value: completedBatchesCount, color: STATUS_COLORS['Concluído'] },
      { name: 'Em Dia', value: onTimeBatchesCount, color: STATUS_COLORS['Em Dia'] },
      { name: 'Atrasado', value: delayedBatchesCount, color: STATUS_COLORS['Atrasado'] }
  ].filter(d => d.value > 0);

  // Filtro da Tabela de Cronograma
  const filteredBatches = batches.filter((b: any) => {
      if (!deadlineFilter) return true;
      if (deadlineFilter === 'Atrasado') return b.is_delayed;
      if (deadlineFilter === 'Concluído') return b.status === 'Concluído';
      if (deadlineFilter === 'Em Dia') return !b.is_delayed && b.status !== 'Concluído';
      return true;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* CABEÇALHO E FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
            <h1 className="text-2xl font-extrabold text-indigo-900 flex items-center">
                <BarChart2 className="w-6 h-6 mr-2"/> B.I. de Entregas
            </h1>
            <p className="text-xs text-gray-500">Clique nas barras dos gráficos para filtrar os dados.</p>
        </div>
        
        {(filters.rpa || filters.year || deadlineFilter) && (
            <div className="flex items-center gap-2 mt-2 md:mt-0 flex-wrap">
                <span className="text-sm font-bold text-gray-600 flex items-center"><Filter className="w-4 h-4 mr-1"/> Filtros:</span>
                {filters.rpa && <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold flex items-center cursor-pointer hover:bg-red-100" onClick={() => setFilters(p => ({...p, rpa: ''}))}>RPA {filters.rpa} <X className="w-3 h-3 ml-1"/></span>}
                {filters.year && <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold flex items-center cursor-pointer hover:bg-red-100" onClick={() => setFilters(p => ({...p, year: ''}))}>{filters.year} <X className="w-3 h-3 ml-1"/></span>}
                {deadlineFilter && <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center cursor-pointer hover:opacity-80 text-white" style={{ backgroundColor: STATUS_COLORS[deadlineFilter] || '#666' }} onClick={() => setDeadlineFilter('')}>{deadlineFilter} <X className="w-3 h-3 ml-1"/></span>}
                <button onClick={clearFilters} className="ml-2 text-xs text-gray-500 hover:text-red-600 underline">Limpar</button>
            </div>
        )}
      </div>

      {/* 1. KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Total Alunos" value={kpis.total} icon={Users} color="orange" />
        <KpiCard title="Entregues" value={kpis.delivered} subtext={`${kpis.percentage}% da meta`} icon={CheckCircle} color="green" />
        <KpiCard title="PCDs Atendidos" value={`${kpis.deliveredPcd} / ${kpis.totalPcd}`} subtext={`${kpis.percentagePcd}%`} icon={Accessibility} color="purple" />
        <KpiCard title="Cronograma" value={delayedBatchesCount > 0 ? `${delayedBatchesCount} Atrasados` : "Em Dia"} subtext={`${batches.length} Lotes Ativos`} icon={delayedBatchesCount > 0 ? AlertTriangle : Calendar} colorClass={delayedBatchesCount > 0 ? "border-red-500" : "border-blue-500"} bgClass={delayedBatchesCount > 0 ? "bg-red-50" : "bg-blue-50"} />
      </div>

      {/* 2. GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RPA */}
        <div className={`bg-white p-5 rounded-xl shadow-md border-2 transition-all cursor-pointer lg:col-span-1 ${filters.rpa ? 'border-blue-400 ring-2 ring-blue-50' : 'border-transparent hover:border-gray-100'}`}>
            <h3 className="font-bold text-gray-700 mb-4 flex items-center text-sm"><BarChart2 className="w-4 h-4 mr-2 text-blue-600"/> Por RPA</h3>
            <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.byRPA} layout="vertical" margin={{left: 0}} onClick={(d) => handleChartClick(d, 'rpa')}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={30} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="total" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} barSize={15} />
                        <Bar dataKey="delivered" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={15}>
                            {charts.byRPA.map((entry: any, index: number) => (<Cell key={`cell-${index}`} fill={filters.rpa === entry.name ? '#1e40af' : '#3b82f6'} />))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Ano */}
        <div className={`bg-white p-5 rounded-xl shadow-md border-2 transition-all cursor-pointer lg:col-span-1 ${filters.year ? 'border-purple-400 ring-2 ring-purple-50' : 'border-transparent hover:border-gray-100'}`}>
            <h3 className="font-bold text-gray-700 mb-4 flex items-center text-sm"><Users className="w-4 h-4 mr-2 text-purple-600"/> Por Ano Escolar</h3>
            <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.byYear} margin={{bottom: 20}} onClick={(d) => handleChartClick(d, 'year')}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 9}} interval={0} angle={-45} textAnchor="end" height={40} />
                        <YAxis />
                        <Tooltip cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="total" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="delivered" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20}>
                            {charts.byYear.map((entry: any, index: number) => (<Cell key={`cell-${index}`} fill={filters.year === entry.name ? '#6d28d9' : '#8b5cf6'} />))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* >>> GRÁFICO DE PRAZOS (AGORA EM BARRAS) <<< */}
        <div className={`bg-white p-5 rounded-xl shadow-md border border-gray-100 lg:col-span-1 ${deadlineFilter ? 'border-yellow-400 ring-2 ring-yellow-50' : 'border-transparent'}`}>
            <h3 className="font-bold text-gray-700 mb-4 flex items-center text-sm">
                <PieChart className="w-4 h-4 mr-2 text-yellow-600"/> Status do Cronograma
                <span className="ml-auto text-[10px] text-gray-400 font-normal">(Clique para filtrar)</span>
            </h3>
            <div className="h-60">
                {deadlinesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deadlinesData} layout="vertical" onClick={handleDeadlineClick} margin={{left: 20, right: 20}}>
                             <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                             <XAxis type="number" hide />
                             <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 11, fontWeight: 'bold'}} />
                             <Tooltip cursor={{fill: '#fef3c7'}} />
                             <Bar dataKey="value" barSize={25} radius={[0, 4, 4, 0]}>
                                 <LabelList dataKey="value" position="right" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                                 {deadlinesData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke={deadlineFilter === entry.name ? '#000' : 'none'} strokeWidth={deadlineFilter === entry.name ? 2 : 0} />
                                 ))}
                             </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Calendar className="w-10 h-10 mb-2 opacity-20"/>
                        <p className="text-xs">Sem lotes ativos.</p>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 3. TABELA DE DETALHES (ESCOLAS) */}
      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center text-sm"><ArrowDown className="w-4 h-4 mr-2 text-green-600"/> Detalhamento por Escola</h3>
            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-gray-600 border">{schoolData.length} Unidades</span>
        </div>
        <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-xs text-left">
                <thead className="bg-white text-gray-500 border-b sticky top-0 shadow-sm z-10">
                    <tr><th className="px-4 py-3 w-1/2">Escola</th><th className="px-4 py-3 text-center">RPA</th><th className="px-4 py-3 text-center">Total</th><th className="px-4 py-3 text-center">Entregues</th><th className="px-4 py-3 w-1/4">Progresso</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {tableLoading ? (<tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>) : 
                    schoolData.map((school: any, idx) => (
                        <tr key={idx} className="hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{school.school_name}</td>
                            <td className="px-4 py-3 text-center text-gray-500">{school.rpa}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-600">{school.total_students}</td>
                            <td className="px-4 py-3 text-center font-bold text-green-600">{school.delivered_count}</td>
                            <td className="px-4 py-3"><div className="w-full bg-gray-200 rounded-full h-1.5 mb-1"><div className={`h-1.5 rounded-full ${parseFloat(school.percentage) === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${school.percentage}%` }}></div></div><span className="text-[10px] text-gray-500 font-bold">{school.percentage}%</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* 4. CRONOGRAMA DE LOTES (Filtrado pelo gráfico de barras) */}
      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200 mt-6">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center text-sm"><Calendar className="w-4 h-4 mr-2 text-blue-600"/> Monitoramento de Lotes</h3>
              {deadlineFilter && <span className="text-xs font-bold text-white px-2 py-1 rounded" style={{ backgroundColor: STATUS_COLORS[deadlineFilter] }}>Filtrando: {deadlineFilter}</span>}
          </div>
          <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-xs text-left">
                  <thead className="bg-white text-gray-500 border-b sticky top-0"><tr><th className="px-4 py-3">Lote / Escola</th><th className="px-4 py-3">Previsão</th><th className="px-4 py-3 text-center">Volume</th><th className="px-4 py-3 text-right">Situação</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                      {filteredBatches.length > 0 ? filteredBatches.map((batch: any) => (
                          <tr key={batch.id} className={`hover:bg-gray-50 ${batch.is_delayed ? 'bg-red-50' : ''}`}>
                              <td className="px-4 py-3"><p className="font-bold text-gray-800">{batch.batch_name}</p><p className="text-gray-500 text-[10px]">{batch.school_name}</p></td>
                              <td className="px-4 py-3">{batch.scheduled_delivery_date ? <span className={`font-medium ${batch.is_delayed ? 'text-red-600' : 'text-gray-700'}`}>{new Date(batch.scheduled_delivery_date).toLocaleDateString('pt-BR')}</span> : <span className="text-gray-400">-</span>}</td>
                              <td className="px-4 py-3 text-center font-bold text-blue-600">{batch.total_items}</td>
                              <td className="px-4 py-3 text-right">
                                  {batch.status === 'Concluído' ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Realizado</span> : batch.is_delayed ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center justify-end w-fit ml-auto"><AlertTriangle className="w-3 h-3 mr-1"/> Atrasado</span> : <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">Em Andamento</span>}
                              </td>
                          </tr>
                      )) : (<tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum lote corresponde ao filtro.</td></tr>)}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;