import React, { useState } from 'react';
import axios from 'axios';
import { 
  Search, Calendar, Filter, FileText, Download, Smartphone, 
  Cpu, User, MapPin, List, History as HistoryIcon, GraduationCap, 
  FileCheck, BarChart, ArrowLeft, PackageCheck, ChevronDown, ChevronRight, 
  AlertCircle, CheckCircle2, Paperclip, Printer, HardDrive, UserCircle, UploadCloud
} from 'lucide-react';
import { useToast } from '../App'; 

// --- INTERFACES ---

interface UnitDossier {
    unit: { name: string; type: string; code: string };
    year: string;
    current_inventory: any[]; 
    history: any[];
    stats: {
        item_type: string;
        total_quantity: number;
        total_loans: number;
        total_exits: number;
        currently_active: number;   
        currently_loaned: number;   
        overdue_loans: number;      
        returned_count: number;     
        _details?: {
            loans: any[];
            exits: any[];
            returns: any[];
        };
    }[];
}

interface QueryHubProps {
  people: any[];
  units: any[];
  API_URL: string;
  translateMovementType: (type: string) => string;
  translateStatus: (status: string) => string;
  onRenewClick: (mov: any) => void;
  onSubstituteClick: (mov: any) => void;
  onReturnClick: (mov: any) => void;
  userRole?: string;
  handleGenerateMovementReceipt: (id: number) => void;
}

const QueryHubPage: React.FC<QueryHubProps> = ({ 
    people, units, API_URL, translateMovementType, translateStatus, 
    onRenewClick, onSubstituteClick, onReturnClick, userRole, handleGenerateMovementReceipt 
}) => {
  
  // Controle de Abas (Adicionado 'legacy')
  const [activeTab, setActiveTab] = useState<'movements' | 'assets' | 'people' | 'units' | 'students' | 'batch_receipts' | 'legacy'>('students');
  const { addToast } = useToast();

  // --- ESTADOS DE FILTRO (LEGADO) ---
  const [legacySearch, setLegacySearch] = useState('');
  const [legacyResults, setLegacyResults] = useState<any[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);

  // --- ESTADOS DE FILTRO (MOVIMENTAÇÕES) ---
  const [movFilters, setMovFilters] = useState({ startDate: '', endDate: '', movementType: '', patrimonio: '', imei: '', chip: '', solicitante: '' });
  const [movementResults, setMovementResults] = useState<any[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);

  // --- ESTADOS DE FILTRO (ATIVOS - DOSSIÊ) ---
  const [dossierSearchTerm, setDossierSearchTerm] = useState('');
  const [dossierData, setDossierData] = useState<any>(null);
  const [loadingDossierView, setLoadingDossierView] = useState(false);

  // --- ESTADOS DE FILTRO (ALUNOS/TABLETS - DOSSIÊ) ---
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // --- ESTADOS DE FILTRO (RECIBOS DE LOTE) ---
  const [batchFilters, setBatchFilters] = useState({ schoolName: '', startDate: '', endDate: '' });
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);

  // --- ESTADOS DE UNIDADE (DOSSIÊ GERENCIAL) ---
  const [unitFilter, setUnitFilter] = useState('');
  const [selectedUnitDossier, setSelectedUnitDossier] = useState<UnitDossier | null>(null);
  const [dossierYear, setDossierYear] = useState(new Date().getFullYear().toString());
  const [loadingDossier, setLoadingDossier] = useState(false);
  
  // INCREMENTO: Controle da Cascata (Linhas expandidas e sub-abas)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeSubTab, setActiveSubTab] = useState<Record<string, 'loans' | 'exits' | 'returns'>>({});

  // --- ESTADOS AUXILIARES PESSOAS ---
  const [peopleFilter, setPeopleFilter] = useState('');

  // ==================================================================================
  // HANDLERS GERAIS
  // ==================================================================================

  // 1. MOVIMENTAÇÕES
  const handleSearchMovements = async (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      setLoadingMov(true);
      try {
          const params = new URLSearchParams();
          Object.entries(movFilters).forEach(([key, value]) => { if (value) params.append(key, value); });
          const response = await axios.get(`${API_URL}/asset-movements?${params.toString()}`);
          setMovementResults(response.data);
          if (response.data.length === 0) addToast('Nenhum registro encontrado.', 'info');
      } catch (error) { addToast('Erro ao buscar movimentações.', 'error'); } finally { setLoadingMov(false); }
  };

  const handleExportFilteredReport = async () => {
      if (movementResults.length === 0) return addToast('Faça uma busca antes de exportar.', 'warning');
      addToast('Gerando PDF...', 'info');
      try {
          const response = await axios.post(`${API_URL}/reports/movements/pdf`, movFilters, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', 'relatorio_movimentacoes_filtrado.pdf');
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
      } catch (error) { addToast('Erro ao gerar PDF.', 'error'); }
  };

  const clearMovFilters = () => {
      setMovFilters({ startDate: '', endDate: '', movementType: '', patrimonio: '', imei: '', chip: '', solicitante: '' });
      setMovementResults([]);
  };

  // 2. ATIVOS (DOSSIÊ RAIO-X)
  const handleSearchDossier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dossierSearchTerm) return addToast('Informe o patrimônio.', 'warning');
    
    setLoadingDossierView(true);
    setDossierData(null);
    try {
      const response = await axios.get(`${API_URL}/assets/dossier/${dossierSearchTerm}`);
      setDossierData(response.data);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Ativo não encontrado.', 'warning');
    } finally {
      setLoadingDossierView(false);
    }
  };

  // 3. ALUNOS (DOSSIÊ)
  const handleSearchStudents = async (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      if(studentSearch.length < 3) { addToast('Digite pelo menos 3 caracteres.', 'warning'); return; }
      
      setLoadingStudent(true);
      try {
          const response = await axios.get(`${API_URL}/tablets/dossier?q=${studentSearch}`);
          setStudentResults(response.data);
          if (response.data.length === 0) addToast('Nenhum aluno encontrado.', 'info');
      } catch (error) {
          console.error(error);
          addToast('Erro ao buscar dossiê.', 'error');
      } finally { setLoadingStudent(false); }
  };

  // 4. RECIBOS DE LOTES (AUDITORIA)
  const handleSearchBatches = async (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      setLoadingBatch(true);
      try {
          const params = new URLSearchParams();
          if (batchFilters.schoolName) params.append('schoolName', batchFilters.schoolName);
          if (batchFilters.startDate) params.append('startDate', batchFilters.startDate);
          if (batchFilters.endDate) params.append('endDate', batchFilters.endDate);

          const response = await axios.get(`${API_URL}/audit/batch-receipts?${params.toString()}`);
          setBatchResults(response.data);
          if (response.data.length === 0) addToast('Nenhum recibo de lote encontrado.', 'info');
      } catch (error) {
          console.error(error);
          addToast('Erro ao buscar recibos.', 'error');
      } finally {
          setLoadingBatch(false);
      }
  };

  // DOWNLOADER CENTRALIZADO
  const downloadFile = async (idOrUrl: string, filename: string, type: 'movement' | 'batch') => {
      addToast('Baixando documento...', 'info');
      
      let endpoint = '';
      if (type === 'movement') {
          endpoint = `${API_URL}/asset-movements/${idOrUrl}/signed-receipt`;
      } else {
          endpoint = `${API_URL}/delivery-batches/${idOrUrl}/signed-receipt`;
      }

      try {
           const response = await axios.get(endpoint, { responseType: 'blob' });
           const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
           const link = document.createElement('a');
           link.href = blobUrl;
           link.setAttribute('download', filename);
           document.body.appendChild(link);
           link.click();
           link.parentNode?.removeChild(link);
      } catch (error: any) {
          console.error("Erro download:", error);
          if (error.response && error.response.status === 404) {
              addToast('Arquivo não encontrado (404). Verifique se o upload foi feito.', 'error');
          } else {
              addToast('Erro ao baixar documento.', 'error');
          }
      }
  };

  // 5. UNIDADES (DOSSIÊ GERENCIAL)
  const handleViewUnitDossier = async (unitId: number) => {
      setLoadingDossier(true);
      setExpandedRows(new Set()); 
      try {
          const response = await axios.get(`${API_URL}/units/${unitId}/dossier?year=${dossierYear}`);
          setSelectedUnitDossier(response.data);
      } catch (error) {
          addToast('Erro ao carregar dossiê da unidade.', 'error');
      } finally {
          setLoadingDossier(false);
      }
  };

  // 6. HISTÓRICO LEGADO (PLANILHA)
  const handleSearchLegacy = async (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      if(legacySearch.length < 3) { addToast('Digite pelo menos 3 caracteres.', 'warning'); return; }
      
      setLoadingLegacy(true);
      try {
          const response = await axios.get(`${API_URL}/tablets/legacy/search?q=${legacySearch}`);
          setLegacyResults(response.data);
          if (response.data.length === 0) addToast('Nenhum registro encontrado no histórico legado.', 'info');
      } catch (error) {
          console.error(error);
          addToast('Erro ao buscar no histórico.', 'error');
      } finally { setLoadingLegacy(false); }
  };

  const handleImportLegacy = async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      addToast('Importando histórico... O sistema pode parecer travado, aguarde o fim do processo.', 'info');
      try {
          const res = await axios.post(`${API_URL}/tablets/legacy/import`, formData);
          addToast(res.data.message, 'success');
      } catch (error: any) {
          addToast(error.response?.data?.message || 'Erro na importação.', 'error');
      }
  };

  const toggleRow = (itemType: string) => {
      const newSet = new Set(expandedRows);
      if (newSet.has(itemType)) newSet.delete(itemType);
      else {
          newSet.add(itemType);
          setActiveSubTab(prev => ({...prev, [itemType]: 'loans'})); 
      }
      setExpandedRows(newSet);
  };

  // ==================================================================================
  // RENDERIZAÇÃO
  // ==================================================================================
  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* CABEÇALHO */}
      <div className="flex justify-between items-end border-b pb-4">
         <div>
            <h1 className="text-3xl font-extrabold text-blue-900 flex items-center">
                <Search className="w-8 h-8 mr-3" /> Central de Consultas
            </h1>
            <p className="text-gray-500 mt-1">Busca avançada para Auditoria, Jurídico e Suporte.</p>
         </div>
      </div>

      {/* NAVEGAÇÃO (ABAS) */}
      <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveTab('students')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'students' ? 'bg-white border-t-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <GraduationCap className="w-4 h-4 mr-2"/> Alunos (Dossiê)
          </button>

          <button onClick={() => setActiveTab('legacy')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'legacy' ? 'bg-white border-t-2 border-orange-600 text-orange-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <HistoryIcon className="w-4 h-4 mr-2"/> Histórico (Anos Anteriores)
          </button>
          
          <button onClick={() => setActiveTab('batch_receipts')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'batch_receipts' ? 'bg-white border-t-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <PackageCheck className="w-4 h-4 mr-2"/> Recibos (Lotes)
          </button>

          <button onClick={() => setActiveTab('units')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'units' ? 'bg-white border-t-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <BarChart className="w-4 h-4 mr-2"/> Unidades (BI)
          </button>

          <button onClick={() => setActiveTab('movements')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'movements' ? 'bg-white border-t-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <HistoryIcon className="w-4 h-4 mr-2"/> Histórico Geral
          </button>
          
          <button onClick={() => setActiveTab('assets')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'assets' ? 'bg-white border-t-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <Cpu className="w-4 h-4 mr-2"/> Ativos (Técnico)
          </button>
          
          <button onClick={() => setActiveTab('people')} className={`px-4 py-2 rounded-t-lg font-bold text-sm flex items-center transition-colors ${activeTab === 'people' ? 'bg-white border-t-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <User className="w-4 h-4 mr-2"/> Pessoas
          </button>
      </div>

      {/* ================================================================================= */}
      {/* ABA 1: ALUNOS (DOSSIÊ COMPLETO) */}
      {/* ================================================================================= */}
      {activeTab === 'students' && (
         <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
             <form onSubmit={handleSearchStudents} className="flex gap-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Buscar Aluno</label>
                    <input 
                        type="text" 
                        placeholder="Nome, Matrícula ou CPF..." 
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="w-full p-2 border rounded border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>
                 <div className="flex items-end">
                    <button onClick={() => handleSearchStudents()} disabled={loadingStudent} className="bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800 h-[42px] font-bold shadow">
                        {loadingStudent ? '...' : 'Localizar Dossiê'}
                    </button>
                 </div>
             </form>

             <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-3">Aluno / Escola</th>
                            <th className="p-3">Tablet Vinculado</th>
                            <th className="p-3">Status Entrega</th>
                            <th className="p-3 text-center">Documentação (Assinada)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {studentResults.map((s, idx) => (
                            <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                <td className="p-3">
                                    <div className="font-bold text-blue-900">{s.student_name}</div>
                                    <div className="text-xs text-gray-500">Matr: {s.student_registration} {s.student_cpf ? `| CPF: ${s.student_cpf}` : ''}</div>
                                    <div className="text-xs text-gray-600 mt-1 font-medium">{s.school_name}</div>
                                </td>
                                <td className="p-3">
                                    {s.patrimonio_number ? (
                                        <>
                                            <div className="font-medium text-gray-800">{s.patrimonio_number}</div>
                                            {s.serial_number && <div className="text-xs text-gray-500">S/N: {s.serial_number}</div>}
                                            {s.sim_card_number && <div className="text-xs text-green-600 font-bold mt-1">Chip: {s.sim_card_number}</div>}
                                        </>
                                    ) : (
                                        <span className="text-gray-400 italic">Nenhum equipamento</span>
                                    )}
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        s.delivery_status === 'realizada' || s.delivery_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                        s.delivery_status === 'devolvido' ? 'bg-orange-100 text-orange-800' :
                                        s.delivery_status === 'substituida' ? 'bg-gray-200 text-gray-600' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {s.delivery_status ? s.delivery_status.toUpperCase() : 'PENDENTE'}
                                    </span>
                                    {s.delivery_date && <div className="text-xs text-gray-500 mt-1">{new Date(s.delivery_date).toLocaleDateString('pt-BR')}</div>}
                                </td>
                                <td className="p-3 text-center">
                                    {s.individual_receipt ? (
                                        <button onClick={() => downloadFile(`${s.movement_id}`, `Recibo_Individual_${s.student_registration}.pdf`, 'movement')} className="text-purple-600 hover:text-purple-800 flex items-center justify-center w-full text-xs font-bold">
                                            <FileCheck className="w-4 h-4 mr-1"/> Recibo Individual
                                        </button>
                                    ) : s.batch_receipt ? (
                                        <div className="flex flex-col items-center">
                                            <button onClick={() => downloadFile(`${s.batch_id}`, `Recibo_Lote_${s.batch_id}.pdf`, 'batch')} className="text-blue-600 hover:text-blue-800 flex items-center justify-center text-xs font-bold">
                                                <FileText className="w-4 h-4 mr-1"/> Recibo do Lote
                                            </button>
                                            <span className="text-[10px] text-gray-400">(Lote: {s.batch_name})</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-xs">Sem documento digitalizado</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                         {studentResults.length === 0 && !loadingStudent && (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">Utilize a busca acima para encontrar o dossiê.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
         </div>
      )}

      {/* ================================================================================= */}
      {/* ABA: HISTÓRICO LEGADO (ANOS ANTERIORES) */}
      {/* ================================================================================= */}
      {activeTab === 'legacy' && (
         <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
             
             {/* Área de Importação (Apenas Admin/Manager) */}
             {(userRole === 'admin' || userRole === 'manager') && (
                 <div className="mb-6 flex justify-end">
                     <input 
                         type="file" id="legacyFile" className="hidden" accept=".xlsx,.csv"
                         onChange={(e) => e.target.files && handleImportLegacy(e.target.files[0])}
                     />
                     <label htmlFor="legacyFile" className="bg-green-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-700 flex items-center text-sm font-bold shadow-sm transition-colors">
                         <UploadCloud className="w-4 h-4 mr-2"/> Carregar Planilha de Histórico
                     </label>
                 </div>
             )}

             <form onSubmit={handleSearchLegacy} className="flex gap-4 mb-6 bg-orange-50 p-4 rounded-lg border border-orange-100">
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-orange-800 uppercase mb-1">Buscar no Histórico Legado</label>
                    <input 
                        type="text" 
                        placeholder="Matrícula, Nome do Aluno ou Unidade..." 
                        value={legacySearch}
                        onChange={e => setLegacySearch(e.target.value)}
                        className="w-full p-2 border rounded border-orange-300 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                 </div>
                 <div className="flex items-end">
                    <button onClick={() => handleSearchLegacy()} disabled={loadingLegacy} className="bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700 h-[42px] font-bold shadow disabled:opacity-50">
                        {loadingLegacy ? 'Buscando...' : 'Pesquisar Legado'}
                    </button>
                 </div>
             </form>

             <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-3 w-20">Ano</th>
                            <th className="p-3 w-32">Matrícula</th>
                            <th className="p-3">Nome do Aluno</th>
                            <th className="p-3">Turma</th>
                            <th className="p-3">Unidade</th>
                            <th className="p-3">Equipamento</th>
                            <th className="p-3">Entrega</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {legacyResults.map((s, idx) => (
                            <tr key={idx} className="hover:bg-orange-50 transition-colors">
                                <td className="p-3 font-bold text-orange-700">{s.delivery_year || '-'}</td>
                                <td className="p-3 font-mono text-gray-600">{s.student_registration || '-'}</td>
                                <td className="p-3 font-bold text-gray-800">{s.student_name}</td>
                                <td className="p-3 text-gray-600">{s.class_name || '-'}</td>
                                <td className="p-3 text-gray-600">{s.unit_name || '-'}</td>
                                <td className="p-3 text-gray-600">{s.equipment || '-'}</td>
                                <td className="p-3">
                                    <span className="px-2 py-1 bg-gray-200 rounded text-xs font-bold text-gray-700">
                                        {s.delivery_status_info || '-'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                         {legacyResults.length === 0 && !loadingLegacy && (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-400">Utilize a busca para consultar os anos anteriores.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
         </div>
      )}

      {/* ================================================================================= */}
      {/* ABA: RECIBOS DE LOTES (AUDITORIA) */}
      {/* ================================================================================= */}
      {activeTab === 'batch_receipts' && (
         <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
             <form onSubmit={handleSearchBatches} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                 <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Nome da Escola</label>
                    <input 
                        type="text" 
                        placeholder="Digite o nome da escola..." 
                        value={batchFilters.schoolName}
                        onChange={e => setBatchFilters({...batchFilters, schoolName: e.target.value})}
                        className="w-full p-2 border rounded"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Entregue A Partir De</label>
                    <input type="date" value={batchFilters.startDate} onChange={e => setBatchFilters({...batchFilters, startDate: e.target.value})} className="w-full p-2 border rounded"/>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Até</label>
                    <input type="date" value={batchFilters.endDate} onChange={e => setBatchFilters({...batchFilters, endDate: e.target.value})} className="w-full p-2 border rounded"/>
                 </div>
             </form>
             
             <div className="mb-6">
                <button onClick={() => handleSearchBatches()} disabled={loadingBatch} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold shadow flex items-center">
                    <Search className="w-4 h-4 mr-2"/> Buscar Recibos
                </button>
             </div>

             <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-3">Data Confirmação</th>
                            <th className="p-3">Escola / Lote</th>
                            <th className="p-3 text-center">RPA</th>
                            <th className="p-3 text-center">Total Entregue</th>
                            <th className="p-3 text-center text-red-600">Devoluções</th>
                            <th className="p-3 text-center">Arquivo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {batchResults.map((b, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50 transition-colors">
                                <td className="p-3 text-gray-500">
                                    {b.delivery_confirmation_date ? new Date(b.delivery_confirmation_date).toLocaleDateString('pt-BR') : 'N/A'}
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-indigo-900">{b.school_name}</div>
                                    <div className="text-xs text-gray-500">{b.batch_name}</div>
                                </td>
                                <td className="p-3 text-center">
                                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">{b.rpa || '-'}</span>
                                </td>
                                <td className="p-3 text-center font-bold text-gray-800">
                                    {b.total_items}
                                </td>
                                <td className="p-3 text-center">
                                    {parseInt(b.returned_items) > 0 ? (
                                        <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded text-xs">
                                            {b.returned_items} Devolvidos
                                        </span>
                                    ) : (
                                        <span className="text-gray-300">-</span>
                                    )}
                                </td>
                                <td className="p-3 text-center">
                                    {b.collective_receipt_path ? (
                                        <button 
                                            onClick={() => downloadFile(`${b.id}`, `Recibo_Coletivo_${b.id}.pdf`, 'batch')} 
                                            className="bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded flex items-center justify-center w-full text-xs font-bold shadow-sm"
                                        >
                                            <Download className="w-3 h-3 mr-1"/> Baixar PDF
                                        </button>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">Pendente</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {batchResults.length === 0 && !loadingBatch && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum recibo encontrado. Ajuste os filtros.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
         </div>
      )}

      {/* ================================================================================= */}
      {/* ABA: UNIDADES (DOSSIÊ GERENCIAL) */}
      {/* ================================================================================= */}
      {activeTab === 'units' && (
          <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
             
             {!selectedUnitDossier ? (
                <>
                    <input 
                        type="text" 
                        placeholder="Filtrar unidades por nome ou código..." 
                        value={unitFilter}
                        onChange={e => setUnitFilter(e.target.value)}
                        className="w-full p-2 border rounded mb-4"
                    />
                    <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-[600px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0">
                                <tr><th className="p-3">Nome</th><th className="p-3">Tipo</th><th className="p-3">Ativos Atuais</th><th className="p-3 text-right">Ação</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {units.filter(u => u.name.toLowerCase().includes(unitFilter.toLowerCase()) || (u.code && u.code.toLowerCase().includes(unitFilter.toLowerCase()))).map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium">{u.name}</td>
                                        <td className="p-3 text-gray-500">{u.type}</td>
                                        <td className="p-3">
                                            {u.current_assets_count && u.current_assets_count > 0 ? (
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{u.current_assets_count}</span>
                                            ) : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => handleViewUnitDossier(u.id)}
                                                className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 text-xs font-bold flex items-center float-right"
                                            >
                                                <BarChart className="w-3 h-3 mr-1"/> Dossiê Gerencial
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
             ) : (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div>
                            <button onClick={() => setSelectedUnitDossier(null)} className="text-sm text-indigo-600 hover:underline mb-1 flex items-center">
                                <ArrowLeft className="w-3 h-3 mr-1"/> Voltar para lista
                            </button>
                            <h2 className="text-xl font-bold text-gray-900">{selectedUnitDossier.unit.name}</h2>
                            <p className="text-gray-500 text-xs">Relatório Gerencial de Ativos - Ano Base: {selectedUnitDossier.year}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-600">Ano Base:</label>
                            <select 
                                value={dossierYear} 
                                onChange={(e) => {
                                    setDossierYear(e.target.value);
                                    alert('Para atualizar o ano, por favor clique em Voltar e selecione a unidade novamente.');
                                }}
                                className="p-1 border rounded text-sm font-bold"
                            >
                                <option value="2024">2024</option>
                                <option value="2025">2025</option>
                                <option value="2026">2026</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 text-center">
                            <span className="text-xs text-blue-500 font-bold uppercase">Total Enviado</span>
                            <div className="text-2xl font-extrabold text-blue-900">
                                {selectedUnitDossier.stats.reduce((acc, curr) => acc + curr.total_quantity, 0)}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-yellow-100 text-center">
                            <span className="text-xs text-yellow-600 font-bold uppercase">Empréstimos Ativos</span>
                            <div className="text-2xl font-extrabold text-yellow-800">
                                {selectedUnitDossier.stats.reduce((acc, curr) => acc + curr.currently_loaned, 0)}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 text-center">
                            <span className="text-xs text-red-500 font-bold uppercase">Vencidos</span>
                            <div className="text-2xl font-extrabold text-red-600">
                                {selectedUnitDossier.stats.reduce((acc, curr) => acc + curr.overdue_loans, 0)}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100 text-center">
                            <span className="text-xs text-green-600 font-bold uppercase">Saldo na Unidade</span>
                            <div className="text-2xl font-extrabold text-green-800">
                                {selectedUnitDossier.current_inventory ? selectedUnitDossier.current_inventory.length : 0}
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-900 text-white uppercase text-xs font-bold">
                                <tr>
                                    <th className="p-3 w-10"></th>
                                    <th className="p-3">Tipo de Item</th>
                                    <th className="p-3 text-center">Total Enviado</th>
                                    <th className="p-3 text-center">Empréstimos</th>
                                    <th className="p-3 text-center">Saída Definitiva</th>
                                    <th className="p-3 text-center text-red-600 bg-white/10">Vencidos</th>
                                    <th className="p-3 text-center text-green-300">Devolvidos</th>
                                    <th className="p-3 text-center bg-indigo-700 text-white border-l border-indigo-600">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {selectedUnitDossier.stats.map((s, idx) => {
                                    const isExpanded = expandedRows.has(s.item_type);
                                    const currentSubTab = activeSubTab[s.item_type] || 'loans';
                                    
                                    const loanList = s._details?.loans || [];
                                    const exitList = s._details?.exits || [];
                                    const returnedList = s._details?.returns || [];

                                    return (
                                    <React.Fragment key={idx}>
                                        <tr className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-indigo-50' : ''}`} onClick={() => toggleRow(s.item_type)}>
                                            <td className="p-3 text-center">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                                            </td>
                                            <td className="p-3 font-bold text-gray-800">{s.item_type}</td>
                                            <td className="p-3 text-center font-bold text-gray-600">{s.total_quantity}</td>
                                            <td className="p-3 text-center text-gray-600">{s.total_loans}</td>
                                            <td className="p-3 text-center text-gray-600">{s.total_exits}</td>
                                            <td className="p-3 text-center font-bold text-red-600">{s.overdue_loans > 0 ? s.overdue_loans : '-'}</td>
                                            <td className="p-3 text-center text-green-600 font-bold">{s.returned_count}</td>
                                            <td className="p-3 text-center font-extrabold text-indigo-700 bg-indigo-50/50 border-l border-gray-200">
                                                {s.currently_active}
                                            </td>
                                        </tr>
                                        
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={8} className="p-0 bg-gray-50 border-b border-indigo-100 shadow-inner">
                                                    <div className="p-4 bg-white m-2 rounded border border-gray-200">
                                                        
                                                        <div className="flex space-x-2 mb-3 border-b border-gray-200 pb-2">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setActiveSubTab({...activeSubTab, [s.item_type]: 'loans'}); }} 
                                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center transition-colors ${currentSubTab === 'loans' ? 'bg-yellow-100 text-yellow-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                                            >
                                                                🟡 Empréstimos Ativos ({loanList.length})
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setActiveSubTab({...activeSubTab, [s.item_type]: 'exits'}); }} 
                                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center transition-colors ${currentSubTab === 'exits' ? 'bg-blue-100 text-blue-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                                            >
                                                                🔵 Saídas Definitivas ({exitList.length})
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setActiveSubTab({...activeSubTab, [s.item_type]: 'returns'}); }} 
                                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center transition-colors ${currentSubTab === 'returns' ? 'bg-green-100 text-green-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                                            >
                                                                ↩️ Devolvidos ({returnedList.length})
                                                            </button>
                                                        </div>

                                                        <div className="min-h-[100px]">
                                                            {currentSubTab === 'loans' && (
                                                                loanList.length > 0 ? (
                                                                    <table className="w-full text-xs text-left">
                                                                        <thead className="bg-yellow-50 text-yellow-800 font-bold"><tr><th className="p-2">Patrimônio</th><th className="p-2">Modelo</th><th className="p-2">Vencimento</th><th className="p-2">Responsável</th></tr></thead>
                                                                        <tbody>{loanList.map((i:any) => {
                                                                            const isOverdue = i.expected_return_date && new Date(i.expected_return_date) <= new Date();
                                                                            return (
                                                                                <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                                                                                    <td className="p-2 font-bold">{i.patrimonio_number}</td>
                                                                                    <td className="p-2">{i.brand} {i.model}</td>
                                                                                    <td className="p-2">{isOverdue ? <span className="text-red-600 font-bold flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> {new Date(i.expected_return_date).toLocaleDateString()}</span> : <span className="text-green-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> {new Date(i.expected_return_date).toLocaleDateString()}</span>}</td>
                                                                                    <td className="p-2">{i.responsible_name}</td>
                                                                                </tr>
                                                                            )
                                                                        })}</tbody>
                                                                    </table>
                                                                ) : <p className="text-gray-400 text-center text-xs italic py-4">Nenhum empréstimo ativo encontrado.</p>
                                                            )}

                                                            {currentSubTab === 'exits' && (
                                                                exitList.length > 0 ? (
                                                                    <table className="w-full text-xs text-left">
                                                                        <thead className="bg-blue-50 text-blue-800 font-bold"><tr><th className="p-2">Patrimônio</th><th className="p-2">Modelo</th><th className="p-2">Responsável</th></tr></thead>
                                                                        <tbody>{exitList.map((i:any) => (
                                                                            <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                                                                                <td className="p-2 font-bold">{i.patrimonio_number}</td>
                                                                                <td className="p-2">{i.brand} {i.model}</td>
                                                                                <td className="p-2">{i.responsible_name}</td>
                                                                            </tr>
                                                                        ))}</tbody>
                                                                    </table>
                                                                ) : <p className="text-gray-400 text-center text-xs italic py-4">Nenhuma saída definitiva ativa encontrada.</p>
                                                            )}

                                                            {currentSubTab === 'returns' && (
                                                                returnedList.length > 0 ? (
                                                                    <table className="w-full text-xs text-left">
                                                                        <thead className="bg-green-50 text-green-800 font-bold"><tr><th className="p-2">Data Movimentação</th><th className="p-2">Patrimônio</th><th className="p-2">Obs</th></tr></thead>
                                                                        <tbody>{returnedList.map((h:any, i:number) => (
                                                                            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                                                                <td className="p-2">{new Date(h.movement_date).toLocaleDateString()}</td>
                                                                                <td className="p-2 font-bold">{h.patrimonio_number}</td>
                                                                                <td className="p-2 text-gray-500 italic">Constava como enviado, agora não está mais na unidade.</td>
                                                                            </tr>
                                                                        ))}</tbody>
                                                                    </table>
                                                                ) : <p className="text-gray-400 text-center text-xs italic py-4">Todos os itens enviados este ano continuam na unidade.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )})}
                                {selectedUnitDossier.stats.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-400">Nenhuma movimentação para o ano selecionado.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
          </div>
      )}

      {/* ================================================================================= */}
      {/* ABA: HISTÓRICO GERAL (MOVIMENTAÇÕES) */}
      {/* ================================================================================= */}
      {activeTab === 'movements' && (
        <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
            {/* Filtros */}
            <form onSubmit={handleSearchMovements} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border">
                <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início</label>
                    <input type="date" value={movFilters.startDate} onChange={e => setMovFilters({...movFilters, startDate: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim</label>
                    <input type="date" value={movFilters.endDate} onChange={e => setMovFilters({...movFilters, endDate: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Solicitante / Responsável</label>
                    <input type="text" placeholder="Nome, Matrícula ou CPF" value={movFilters.solicitante} onChange={e => setMovFilters({...movFilters, solicitante: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                </div>

                <div className="md:col-span-1">
                     <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Patrimônio</label>
                     <input type="text" placeholder="Tombo ou Serial" value={movFilters.patrimonio} onChange={e => setMovFilters({...movFilters, patrimonio: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                </div>
                <div className="md:col-span-1">
                     <label className="block text-xs font-bold text-blue-700 uppercase mb-1">IMEI (Tablet)</label>
                     <input type="text" placeholder="Busca parcial..." value={movFilters.imei} onChange={e => setMovFilters({...movFilters, imei: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                </div>
                <div className="md:col-span-1">
                     <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Nº Chip</label>
                     <input type="text" placeholder="Ex: 8199..." value={movFilters.chip} onChange={e => setMovFilters({...movFilters, chip: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                </div>
                <div className="md:col-span-1">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Operação</label>
                     <select value={movFilters.movementType} onChange={e => setMovFilters({...movFilters, movementType: e.target.value})} className="w-full p-2 border rounded text-sm">
                        <option value="">Todos</option>
                        <option value="loan">Empréstimo</option>
                        <option value="return">Devolução</option>
                        <option value="exit">Saída Definitiva</option>
                        <option value="maintenance">Manutenção</option>
                     </select>
                </div>
            </form>

            <div className="flex gap-2 mb-6 border-b pb-4 justify-between">
                <div className="flex gap-2">
                    <button onClick={() => handleSearchMovements()} disabled={loadingMov} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center shadow-sm">
                        <Search className="w-4 h-4 mr-2"/> {loadingMov ? '...' : 'Pesquisar'}
                    </button>
                    <button onClick={clearMovFilters} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                        Limpar
                    </button>
                </div>
                {movementResults.length > 0 && (
                    <button onClick={handleExportFilteredReport} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center shadow-sm">
                        <Download className="w-4 h-4 mr-2"/> Exportar PDF
                    </button>
                )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-3 w-28">Data</th>
                            <th className="p-3 w-32">Tipo</th>
                            <th className="p-3">Ativos Envolvidos</th>
                            <th className="p-3">Responsável</th>
                            <th className="p-3">Destino</th>
                            <th className="p-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {movementResults.map(mov => (
                            <tr key={mov.id} className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 text-gray-500 align-top">{new Date(mov.movement_date).toLocaleDateString('pt-BR')}</td>
                                <td className="p-3 align-top">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        mov.movement_type === 'return' ? 'bg-green-100 text-green-800' : 
                                        mov.movement_type === 'loan' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        {translateMovementType(mov.movement_type)}
                                    </span>
                                </td>
                                <td className="p-3 align-top">
                                    {mov.assets && mov.assets.map((a: any, i: number) => (
                                        <div key={i} className="mb-2 p-2 bg-gray-50 rounded border border-gray-100">
                                            <div className="font-bold text-blue-900">{a.item_type_name} - {a.patrimonio_number || a.sku}</div>
                                            <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                                {a.brand && <span>{a.brand} {a.model}</span>}
                                                {a.imei && <span className="text-gray-700 font-mono bg-white px-1 border rounded">IMEI: {a.imei}</span>}
                                                {a.sim_card_number && <span className="text-green-700 font-mono bg-white px-1 border rounded">CHIP: {a.sim_card_number}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </td>
                                <td className="p-3 font-medium align-top">{mov.recipient_display_name || mov.responsible_full_name}</td>
                                <td className="p-3 text-gray-500 align-top">{mov.destination_unit_name || '-'}</td>
                                <td className="p-3 text-right align-top">
                                    <div className="flex justify-end gap-2">
                                        
                                        {mov.delivery_status === 'confirmed' ? (
                                            <button 
                                                onClick={() => downloadFile(mov.id.toString(), `Recibo_Assinado_${mov.id}.pdf`, 'movement')} 
                                                className="text-green-600 hover:text-green-800 p-1" 
                                                title="Baixar Comprovante Assinado"
                                            >
                                                <Paperclip className="w-5 h-5"/>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleGenerateMovementReceipt(mov.id)} 
                                                className="text-blue-600 hover:text-blue-800 p-1" 
                                                title="Gerar/Imprimir Recibo para Assinatura"
                                            >
                                                <Printer className="w-5 h-5"/>
                                            </button>
                                        )}
                                        
                                        {mov.movement_type !== 'return' && userRole !== 'basic' && (
                                            <>
                                                <button onClick={() => onReturnClick(mov)} className="text-orange-600 hover:text-orange-800 p-1" title="Devolver"><Calendar className="w-5 h-5"/></button>
                                                <button onClick={() => onSubstituteClick(mov)} className="text-red-600 hover:text-red-800 p-1" title="Substituir"><Filter className="w-5 h-5"/></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {movementResults.length === 0 && !loadingMov && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Utilize os filtros acima para encontrar registros.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* ================================================================================= */}
      {/* ABA: ATIVOS (DOSSIÊ RAIO-X COMPLETO) */}
      {/* ================================================================================= */}
      {activeTab === 'assets' && (
         <div className="space-y-6 animate-fadeIn bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <HardDrive className="w-5 h-5 mr-2 text-blue-600" />
              Dossiê Técnico do Ativo
            </h2>
            <form onSubmit={handleSearchDossier} className="flex gap-3">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={dossierSearchTerm}
                  onChange={(e) => setDossierSearchTerm(e.target.value)}
                  placeholder="Digite ou bipe o número de patrimônio..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg uppercase tracking-widest"
                  autoFocus
                />
              </div>
              <button 
                type="submit" 
                disabled={loadingDossierView}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {loadingDossierView ? 'Buscando...' : 'Consultar'}
              </button>
            </form>
          </div>

          {dossierData && dossierData.asset && (
            <div className="space-y-6">
              
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-xl shadow-lg text-white flex justify-between items-center">
                <div>
                  <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">{dossierData.asset.item_type_name}</div>
                  <h1 className="text-2xl font-bold">{dossierData.asset.brand} {dossierData.asset.model}</h1>
                  <div className="mt-2 font-mono text-gray-300 bg-black bg-opacity-30 inline-block px-3 py-1 rounded">
                    Tombo: {dossierData.asset.patrimonio_number} | Série: {dossierData.asset.serial_number || 'N/A'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Status no Sistema</div>
                  <span className="px-4 py-2 rounded-full text-sm font-bold bg-white text-slate-900 shadow">
                    {translateStatus(dossierData.asset.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-red-500"/> Lotação e Dados Físicos
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="text-gray-500 block text-xs">Unidade Atual:</span> <span className="font-bold text-gray-800">{dossierData.asset.current_unit_name || 'Não alocado'}</span></p>
                    <p><span className="text-gray-500 block text-xs">Data de Aquisição:</span> <span className="text-gray-800">{dossierData.asset.acquisition_date ? new Date(dossierData.asset.acquisition_date).toLocaleDateString() : 'N/A'}</span></p>
                    <p><span className="text-gray-500 block text-xs">Observações:</span> <span className="text-gray-800 italic">{dossierData.asset.notes || 'Nenhuma observação técnica registrada.'}</span></p>
                  </div>
                </div>

                {(dossierData.asset.student_name || dossierData.asset.imei) && (
                  <div className="bg-orange-50 p-5 rounded-xl shadow-sm border border-orange-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Smartphone className="w-24 h-24 text-orange-900"/></div>
                    <h3 className="font-bold text-orange-900 border-b border-orange-200 pb-2 mb-4 flex items-center relative z-10">
                      <UserCircle className="w-4 h-4 mr-2"/> Vínculo Escolar / Telecom
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm relative z-10">
                      <div>
                        <span className="text-orange-700 block text-xs font-bold">Aluno Responsável:</span>
                        <span className="font-bold text-gray-800">{dossierData.asset.student_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-orange-700 block text-xs font-bold">Matrícula:</span>
                        <span className="font-mono text-gray-800">{dossierData.asset.student_registration || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-orange-700 block text-xs font-bold">IMEI:</span>
                        <span className="font-mono text-gray-800">{dossierData.asset.imei || 'S/N'}</span>
                      </div>
                      <div>
                        <span className="text-orange-700 block text-xs font-bold">Linha (Chip):</span>
                        <span className="font-mono font-bold text-gray-800 bg-white px-2 py-1 rounded border border-orange-200">{dossierData.asset.sim_card_number || 'Sem Chip'}</span>
                      </div>
                      <div>
                        <span className="text-orange-700 block text-xs font-bold">Caixa Lote:</span>
                        <span className="text-gray-800">{dossierData.asset.box_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-orange-700 block text-xs font-bold">Status Entrega:</span>
                        <span className="text-gray-800 uppercase font-bold">{dossierData.asset.delivery_status || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center">
                  <HistoryIcon className="w-4 h-4 mr-2 text-indigo-500"/> Histórico de Movimentações
                </h3>
                
                {dossierData.history && dossierData.history.length > 0 ? (
                  <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 mt-6">
                    {dossierData.history.map((mov: any, index: number) => (
                      <div key={mov.id} className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow"></div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-blue-900">{translateMovementType(mov.movement_type)}</span>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border shadow-sm">
                              {new Date(mov.movement_date).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p><span className="text-gray-500">Destino:</span> <span className="font-medium text-gray-800">{mov.destination_unit_name || 'N/A'}</span></p>
                            <p><span className="text-gray-500">Recebedor:</span> <span className="font-medium text-gray-800">{mov.recipient_name || 'N/A'}</span></p>
                            <p className="col-span-2"><span className="text-gray-500">Registrado por:</span> <span className="text-gray-700">{mov.responsible_name}</span></p>
                            {mov.notes && (
                              <p className="col-span-2 mt-2 pt-2 border-t border-gray-200 text-gray-600 text-xs italic">
                                "{mov.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    <p>Nenhum histórico de movimentação encontrado para este ativo.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ================================================================================= */}
      {/* ABA: PESSOAS */}
      {/* ================================================================================= */}
      {activeTab === 'people' && (
          <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-gray-200 border-t-0">
             <input 
                type="text" 
                placeholder="Filtrar pessoas por nome ou CPF..." 
                value={peopleFilter}
                onChange={e => setPeopleFilter(e.target.value)}
                className="w-full p-2 border rounded mb-4"
             />
             <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-[600px]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0">
                        <tr><th className="p-3">Nome</th><th className="p-3">CPF</th><th className="p-3">Unidade</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {people.filter(p => p.full_name.toLowerCase().includes(peopleFilter.toLowerCase())).map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="p-3 font-medium">{p.full_name}</td>
                                <td className="p-3 text-gray-500">{p.cpf}</td>
                                <td className="p-3 text-gray-500">{p.unit_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
      )}

    </div>
  );
};

export default QueryHubPage;