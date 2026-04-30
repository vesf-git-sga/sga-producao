// frontend/src/components/RetirementAndDisposalPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Asset, useToast } from '../App';
import { 
  Search, ArrowDownCircle, Trash2, Check, X as XIcon, 
  Clock, Eye, FileText, AlertTriangle, ListPlus, Printer, UploadCloud, ShieldAlert
} from 'lucide-react';

import RequestRetirementModal from './RequestRetirementModal';
import DisposeAssetModal from './DisposeAssetModal';
import ApprovalActionModal from './ApprovalActionModal';
import RequestDetailsModal from './RequestDetailsModal';
import LegacyDisposalModal from './LegacyDisposalModal';

interface RetirementAndDisposalPageProps {
  API_URL: string;
  userRole?: 'admin' | 'manager' | 'basic' | 'advisor'; // Adicionado advisor
  userName?: string;
}

interface PendingRequest {
  id: number;
  reason: string;
  retirement_type?: string; // Novo campo
  created_at: string;
  patrimonio_number: string;
  brand: string;
  model: string;
  requester_name: string;
}

interface RequestDetails extends PendingRequest {
  details: string;
  serial_number: string;
  evidence_path: string;
  document_number?: string; // Novo campo
  event_date?: string;      // Novo campo
}

const RetirementAndDisposalPage = ({ API_URL, userRole, userName }: RetirementAndDisposalPageProps) => {
  const { addToast } = useToast();
  
  // --- CONTROLE DE PERMISSÕES LOCAIS ---
  // Admin: Pode tudo (Aprovar, Descartar, Solicitar)
  const canApprove = userRole === 'admin';
  const canDisposeFinal = userRole === 'admin';
  // Manager e Admin: Podem Solicitar
  const canRequest = ['admin', 'manager'].includes(userRole || '');
  // Advisor: Apenas visualiza (já garantido pela falta das flags acima)

  // --- ESTADOS GERAIS ---
  const [isLoading, setIsLoading] = useState(false);

  // --- 1. BUSCA INDIVIDUAL ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedAsset, setSearchedAsset] = useState<Asset | null>(null);

  // --- 2. SOLICITAÇÕES PENDENTES ---
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);

  // --- 3. SOLICITAÇÃO EM LOTE ---
  const [eligibleAssets, setEligibleAssets] = useState<Asset[]>([]); 
  const [selectedEligibleIds, setSelectedEligibleIds] = useState<number[]>([]);
  const [showBatchRequestModal, setShowBatchRequestModal] = useState(false);
  const [batchRequestReason, setBatchRequestReason] = useState('');
  const [batchRequestFile, setBatchRequestFile] = useState<File | null>(null);

  // --- 4. CENTRAL DE DESCARTE ---
  const [retiredAssets, setRetiredAssets] = useState<Asset[]>([]);
  const [selectedRetiredIds, setSelectedRetiredIds] = useState<number[]>([]);
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [showBatchDisposeConfirm, setShowBatchDisposeConfirm] = useState(false);
  const [batchDisposeNote, setBatchDisposeNote] = useState('');

  // --- MODAIS ---
  const [assetToRequestRetirement, setAssetToRequestRetirement] = useState<Asset | null>(null);
  const [assetToDispose, setAssetToDispose] = useState<Asset | null>(null);
  const [requestToAction, setRequestToAction] = useState<{id: number, action: 'approve' | 'reject'} | null>(null);
  const [requestToView, setRequestToView] = useState<RequestDetails | null>(null);

  // ==================================================================================
  // BUSCA DE DADOS
  // ==================================================================================

  const fetchPendingRequests = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/retirement-requests/pending`);
      setPendingRequests(response.data);
    } catch (error) { console.error("Erro ao buscar solicitações:", error); }
  }, [API_URL]);

  const fetchRetiredAssets = useCallback(async () => {
    // Apenas Admin vê a lista de descarte final para operar, 
    // mas Advisor pode ver para conferência se quiser (aqui deixamos restrito a admin para não poluir)
    if (userRole !== 'admin' && userRole !== 'advisor') return; 
    try {
      const response = await axios.get(`${API_URL}/assets?status=retired`);
      setRetiredAssets(response.data);
    } catch (error) { console.error(error); }
  }, [API_URL, userRole]);

  const fetchEligibleAssets = useCallback(async () => {
    // Apenas quem pode solicitar vê a lista de "Disponíveis para Baixa"
    if (!canRequest && userRole !== 'advisor') return; 

    try {
      const [resAvail, resMaint] = await Promise.all([
        axios.get(`${API_URL}/assets?status=available`),
        axios.get(`${API_URL}/assets?status=maintenance`)
      ]);
      const combined = [...resAvail.data, ...resMaint.data].sort((a, b) => 
        (a.patrimonio_number || '').localeCompare(b.patrimonio_number || '')
      );
      setEligibleAssets(combined);
    } catch (error) { console.error(error); }
  }, [API_URL, canRequest, userRole]);

  useEffect(() => {
    fetchPendingRequests();
    fetchRetiredAssets();
    fetchEligibleAssets();
  }, [fetchPendingRequests, fetchRetiredAssets, fetchEligibleAssets]);

  // ==================================================================================
  // HANDLERS
  // ==================================================================================

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setSearchedAsset(null);
    try {
      // Tenta buscar por Patrimônio OU Serial (Backend preparado para isso)
      const response = await axios.get(`${API_URL}/assets/by-patrimonio/${searchTerm.trim()}`);
      setSearchedAsset(response.data);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Ativo não encontrado.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestRetirementSubmit = async (assetId: number, formData: FormData) => {
    try {
      await axios.post(`${API_URL}/assets/${assetId}/request-retirement`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast('Solicitação enviada com sucesso!', 'success');
      setAssetToRequestRetirement(null);
      setSearchedAsset(null);
      setSearchTerm('');
      fetchPendingRequests();
      fetchEligibleAssets();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao enviar.', 'error');
    }
  };

  const handleDisposeSave = async (assetId: number, note: string) => {
    try {
      await axios.put(`${API_URL}/assets/${assetId}/dispose`, { disposal_note: note });
      addToast('Ativo descartado com sucesso!', 'success');
      setAssetToDispose(null);
      handleSearch();
      fetchRetiredAssets();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao descartar ativo.', 'error');
    }
  };

  const handleApprovalAction = async (requestId: number, reason?: string) => {
    const action = requestToAction?.action;
    if(!action) return;
    try {
      if(action === 'approve') {
        await axios.put(`${API_URL}/retirement-requests/${requestId}/approve`);
        addToast('Aprovado com sucesso!', 'success');
      } else {
        await axios.put(`${API_URL}/retirement-requests/${requestId}/reject`, { rejection_reason: reason });
        addToast('Rejeitado com sucesso.', 'success');
      }
      fetchPendingRequests();
      fetchRetiredAssets();
      fetchEligibleAssets();
      setRequestToAction(null);
    } catch (error: any) {
      addToast(error.response?.data?.message || `Erro ao processar.`, 'error');
    }
  };

  const handleViewDetails = async (requestId: number) => {
    try {
      const response = await axios.get(`${API_URL}/retirement-requests/${requestId}`);
      setRequestToView(response.data);
    } catch (error) { addToast('Erro ao carregar detalhes.', 'error'); }
  };

  // --- Handlers de Lote ---
  const handlePrintDraft = async () => {
     if (!batchRequestReason || selectedEligibleIds.length === 0) {
         return addToast('Selecione os ativos e informe o motivo.', 'warning');
     }
     addToast('Gerando solicitação...', 'info');
     try {
        const response = await axios.post(`${API_URL}/reports/batch-retirement-term-draft`, {
            assetIds: selectedEligibleIds,
            reason: batchRequestReason,
            technician_name: userName || 'Responsável Técnico'
        }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Solicitação_Baixa_${new Date().getTime()}.pdf`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        link.parentNode?.removeChild(link);
     } catch (e) { addToast('Erro ao gerar documento.', 'error'); }
  };

  const handleBatchRequestSubmit = async () => {
      if (!batchRequestReason || !batchRequestFile) return addToast('Preencha o motivo e anexe o laudo.', 'warning');
      const fd = new FormData();
      fd.append('reason', batchRequestReason);
      fd.append('assetIds', JSON.stringify(selectedEligibleIds));
      fd.append('evidenceFile', batchRequestFile);
      setIsLoading(true);
      try {
          const response = await axios.post(`${API_URL}/retirement-requests/batch`, fd, {
             headers: { 'Content-Type': 'multipart/form-data' }
          });
          addToast(response.data.message, 'success');
          setSelectedEligibleIds([]);
          setBatchRequestReason('');
          setBatchRequestFile(null);
          setShowBatchRequestModal(false);
          fetchEligibleAssets();
          fetchPendingRequests();
      } catch (error: any) { addToast(error.response?.data?.message || 'Erro ao processar.', 'error'); } 
      finally { setIsLoading(false); }
  };

  const handleBatchApproval = async (action: 'approve' | 'reject') => {
     if (selectedRequestIds.length === 0) return;
     if (!window.confirm(`Confirma ${action === 'approve' ? 'APROVAR' : 'REJEITAR'} os itens selecionados?`)) return;
     try {
        await axios.post(`${API_URL}/retirement-requests/batch-action`, {
            requestIds: selectedRequestIds,
            action,
            rejection_reason: action === 'reject' ? 'Rejeição em lote via painel' : undefined
        });
        addToast(`Ação em lote realizada!`, 'success');
        setSelectedRequestIds([]);
        fetchPendingRequests();
        fetchRetiredAssets();
        fetchEligibleAssets();
     } catch (error: any) { addToast(error.response?.data?.message || 'Erro.', 'error'); }
  };

  const handleBatchDispose = async () => {
    if (!batchDisposeNote) return addToast('Nota de destino obrigatória.', 'warning');
    try {
        const response = await axios.post(`${API_URL}/assets/batch-dispose`, {
            assetIds: selectedRetiredIds,
            disposal_note: batchDisposeNote,
            technician_name: userName || 'Gerente de TI'
        }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Termo_Descarte_Lote_${new Date().getTime()}.pdf`);
        document.body.appendChild(link);
        link.click();
        addToast('Lote descartado com sucesso!', 'success');
        setSelectedRetiredIds([]);
        setBatchDisposeNote('');
        setShowBatchDisposeConfirm(false);
        fetchRetiredAssets();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        link.parentNode?.removeChild(link);
    } catch (error) { addToast('Erro ao realizar descarte.', 'error'); }
  };

  // ==================================================================================
  // RENDERIZAÇÃO
  // ==================================================================================

  const renderAssetActions = () => {
    if (!searchedAsset) return null;
    const { status } = searchedAsset;

    // Se for Advisor, não mostra botões de ação, apenas status
    if (userRole === 'advisor') {
        return (
            <div className="text-sm text-gray-500 italic border p-2 rounded bg-gray-50">
                Modo Visualização: Você não tem permissão para alterar este ativo.
            </div>
        );
    }

    if (['available', 'maintenance'].includes(status)) {
      // Apenas Admin e Manager podem solicitar
      if (canRequest) {
        return <button onClick={() => setAssetToRequestRetirement(searchedAsset)} className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center"><ArrowDownCircle className="w-5 h-5 mr-2"/> Solicitar Baixa</button>;
      }
    }
    if (status === 'retired') {
      // Apenas Admin pode descartar
      if (canDisposeFinal) {
        return <button onClick={() => setAssetToDispose(searchedAsset)} className="bg-gray-800 text-white font-bold px-6 py-2 rounded-lg shadow-md hover:bg-black flex items-center"><Trash2 className="w-5 h-5 mr-2"/> Descartar este Ativo</button>;
      }
    }
    if (status === 'pending_retirement') {
      return <div className="bg-cyan-100 border-l-4 border-cyan-500 text-cyan-800 p-4 rounded"><p className="font-bold">Em Análise</p><p>Aguardando aprovação da baixa.</p></div>;
    }
    if (['in_use', 'loaned'].includes(status)) {
      return <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded"><p className="font-bold">Em Uso</p><p>Necessário devolver antes de baixar.</p></div>;
    }
    if (status === 'disposed') {
      return <div className="bg-gray-100 border-l-4 border-gray-500 text-gray-700 p-4 rounded"><p className="font-bold">Descartado</p><p>Este ativo já saiu do patrimônio.</p></div>;
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
          <h1 className="text-3xl font-extrabold text-blue-900">Gestão de Patrimônio</h1>
          {userRole === 'advisor' && (
              <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">
                  Modo Auditoria (Acesso Leitura)
              </span>
          )}
      </div>
      
      {/* BLOCO 1: BUSCA INDIVIDUAL */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Search className="w-5 h-5 mr-2 text-blue-600"/> 1. Busca e Ação Individual</h3>
        <div className="flex space-x-2">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Digite o Patrimônio..." className="flex-grow px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && handleSearch()}/>
          <button onClick={handleSearch} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center disabled:opacity-50 font-bold">{isLoading ? '...' : 'Buscar'}</button>
        </div>
        {searchedAsset && (
            <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200 flex flex-col md:flex-row justify-between items-center animate-fade-in">
                <div className="mb-4 md:mb-0">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-xl font-bold text-gray-800">{searchedAsset.patrimonio_number}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${searchedAsset.status === 'retired' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{searchedAsset.status}</span>
                    </div>
                    <div className="text-gray-600 text-sm">{searchedAsset.brand} {searchedAsset.model}</div>
                </div>
                {renderAssetActions()}
            </div>
        )}
      </div>

      {/* BLOCO 2: SOLICITAÇÃO EM LOTE (Visível para Manager/Admin/Advisor, mas botão só para quem pode solicitar) */}
      {(canRequest || userRole === 'advisor') && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-blue-200">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-blue-900 flex items-center">
                      <ListPlus className="w-5 h-5 mr-2"/> 2. Estoque Disponível para Baixa
                  </h3>
                  {canRequest && (
                      <button disabled={selectedEligibleIds.length === 0} onClick={() => setShowBatchRequestModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50 font-bold text-sm flex items-center">
                          Solicitar Baixa em Lote ({selectedEligibleIds.length})
                      </button>
                  )}
              </div>
              
              <div className="max-h-64 overflow-y-auto border rounded bg-white">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-100 sticky top-0 shadow-sm">
                          <tr>
                              <th className="p-3 w-10 text-center">
                                  {canRequest ? (
                                      <input type="checkbox" className="rounded cursor-pointer" onChange={e => setSelectedEligibleIds(e.target.checked ? eligibleAssets.map(a => a.id) : [])} checked={selectedEligibleIds.length === eligibleAssets.length && eligibleAssets.length > 0} />
                                  ) : <ShieldAlert className="w-4 h-4 text-gray-400"/>}
                              </th>
                              <th className="p-3">Patrimônio</th>
                              <th className="p-3">Descrição</th>
                              <th className="p-3">Status Atual</th>
                          </tr>
                      </thead>
                      <tbody>
                          {eligibleAssets.map(asset => (
                              <tr key={asset.id} className={`hover:bg-blue-50 border-b ${selectedEligibleIds.includes(asset.id) ? 'bg-blue-50' : ''}`}>
                                  <td className="p-3 text-center">
                                    {canRequest && (
                                      <input type="checkbox" className="rounded cursor-pointer" checked={selectedEligibleIds.includes(asset.id)} onChange={() => setSelectedEligibleIds(prev => prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id])} />
                                    )}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-gray-700">{asset.patrimonio_number}</td>
                                  <td className="p-3">{asset.brand} {asset.model}</td>
                                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${asset.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{asset.status}</span></td>
                              </tr>
                          ))}
                          {eligibleAssets.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhum ativo disponível para baixa no momento.</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* BLOCO 3: APROVAÇÃO (Visível a todos Gestores, Ação só Admin) */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center"><Clock className="w-5 h-5 mr-2 text-yellow-600"/> 3. Pendências de Aprovação ({pendingRequests.length})</h3>
            
            {/* Botões de Lote (Só Admin) */}
            {canApprove && selectedRequestIds.length > 0 && (
                <div className="flex gap-2 animate-fade-in">
                    <button onClick={() => handleBatchApproval('reject')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded text-sm font-bold hover:bg-red-200 flex items-center"><XIcon className="w-4 h-4 mr-1"/> Rejeitar ({selectedRequestIds.length})</button>
                    <button onClick={() => handleBatchApproval('approve')} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-green-700 flex items-center"><Check className="w-4 h-4 mr-1"/> Aprovar ({selectedRequestIds.length})</button>
                </div>
            )}
        </div>

        <div className="max-h-80 overflow-y-auto border rounded bg-white">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="bg-gray-100 sticky top-0 shadow-sm">
              <tr>
                {canApprove && (
                    <th className="p-3 w-10 text-center"><input type="checkbox" className="rounded cursor-pointer" onChange={e => setSelectedRequestIds(e.target.checked ? pendingRequests.map(r => r.id) : [])} checked={pendingRequests.length > 0 && selectedRequestIds.length === pendingRequests.length} /></th>
                )}
                <th className="px-6 py-3">Data Solicitação</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Ativo</th>
                <th className="px-6 py-3">Motivo</th>
                <th className="px-6 py-3 text-center">Auditoria</th>
                {canApprove && <th className="px-6 py-3 text-center">Decisão</th>}
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((req) => (
                <tr key={req.id} className={`border-b hover:bg-gray-50 ${selectedRequestIds.includes(req.id) ? 'bg-yellow-50' : ''}`}>
                  {canApprove && (
                      <td className="p-3 text-center"><input type="checkbox" className="rounded cursor-pointer" checked={selectedRequestIds.includes(req.id)} onChange={() => setSelectedRequestIds(prev => prev.includes(req.id) ? prev.filter(id => id !== req.id) : [...prev, req.id])} /></td>
                  )}
                  <td className="px-6 py-4">{new Date(req.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4"><span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-bold">{req.retirement_type || 'Geral'}</span></td>
                  <td className="px-6 py-4"><span className="font-bold text-gray-700">{req.patrimonio_number}</span><br/><span className="text-xs text-gray-400">{req.brand} {req.model}</span></td>
                  <td className="px-6 py-4 max-w-xs truncate" title={req.reason}>{req.reason}</td>
                  
                  {/* Botão de Ver Detalhes (Disponível para TODOS os gestores, inclusive Advisor) */}
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleViewDetails(req.id)} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded flex items-center justify-center mx-auto" title="Ver Laudo/B.O.">
                        <Eye className="w-4 h-4 mr-1"/> Ver
                    </button>
                  </td>

                  {/* Botões de Ação (Apenas Admin) */}
                  {canApprove && (
                    <td className="px-6 py-4 text-center space-x-2">
                        <button onClick={() => setRequestToAction({id: req.id, action: 'approve'})} className="text-green-600 bg-green-50 p-1.5 rounded hover:bg-green-100" title="Aprovar"><Check className="w-4 h-4"/></button>
                        <button onClick={() => setRequestToAction({id: req.id, action: 'reject'})} className="text-red-600 bg-red-50 p-1.5 rounded hover:bg-red-100" title="Rejeitar"><XIcon className="w-4 h-4"/></button>
                    </td>
                  )}
                </tr>
              ))}
              {pendingRequests.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400 italic">Nenhuma solicitação pendente no momento.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 4: CENTRAL DE DESCARTE (EXCLUSIVO ADMIN e MANAGER visualiza) */}
      {(userRole === 'admin' || userRole === 'advisor') && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-red-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><Trash2 className="w-5 h-5 mr-2 text-red-600"/> 4. Central de Descarte Final</h3>
                    <p className="text-sm text-gray-500 mt-1">Bens baixados aguardando destinação final (Logística Reversa).</p>
                </div>
                {canDisposeFinal && (
                    <button onClick={() => setShowLegacyModal(true)} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 text-sm font-bold flex items-center shadow-md">
                        <FileText className="w-4 h-4 mr-2"/> Descarte Avulso (Sucata)
                    </button>
                )}
            </div>
            
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-bold text-gray-600 uppercase">Aguardando Destinação ({retiredAssets.length})</span>
                      {canDisposeFinal && (
                          <button disabled={selectedRetiredIds.length === 0} onClick={() => setShowBatchDisposeConfirm(true)} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                            Descartar Selecionados ({selectedRetiredIds.length})
                          </button>
                      )}
                </div>
                <div className="max-h-64 overflow-y-auto border rounded bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 sticky top-0 shadow-sm">
                            <tr>
                                {canDisposeFinal && (
                                    <th className="p-3 w-10 text-center"><input type="checkbox" className="rounded cursor-pointer" onChange={(e) => setSelectedRetiredIds(e.target.checked ? retiredAssets.map(a => a.id) : [])} checked={selectedRetiredIds.length === retiredAssets.length && retiredAssets.length > 0} /></th>
                                )}
                                <th className="p-3">Patrimônio</th>
                                <th className="p-3">Descrição</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {retiredAssets.map(asset => (
                                <tr key={asset.id} className={`hover:bg-red-50 border-b ${selectedRetiredIds.includes(asset.id) ? 'bg-red-50' : ''}`}>
                                    {canDisposeFinal && (
                                        <td className="p-3 text-center"><input type="checkbox" className="rounded cursor-pointer" checked={selectedRetiredIds.includes(asset.id)} onChange={() => setSelectedRetiredIds(prev => prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id])} /></td>
                                    )}
                                    <td className="p-3 font-mono font-bold text-gray-700">{asset.patrimonio_number}</td>
                                    <td className="p-3">{asset.item_type_name} - {asset.brand} {asset.model}</td>
                                    <td className="p-3 text-red-600 font-bold text-xs uppercase">Aguardando Descarte</td>
                                </tr>
                            ))}
                            {retiredAssets.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhum ativo baixado aguardando descarte.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
      
      {/* MODAIS (Renderizados Condicionalmente) */}
      {assetToRequestRetirement && <RequestRetirementModal asset={assetToRequestRetirement} onClose={() => setAssetToRequestRetirement(null)} onSubmit={handleRequestRetirementSubmit}/>}
      {assetToDispose && <DisposeAssetModal asset={assetToDispose} onClose={() => setAssetToDispose(null)} onSave={handleDisposeSave} API_URL={API_URL} />}
      {requestToAction && <ApprovalActionModal action={requestToAction.action} requestId={requestToAction.id} onClose={() => setRequestToAction(null)} onConfirm={handleApprovalAction} />}
      {requestToView && <RequestDetailsModal request={requestToView} onClose={() => setRequestToView(null)} API_URL={API_URL}/>}
      {showLegacyModal && <LegacyDisposalModal onClose={() => setShowLegacyModal(false)} API_URL={API_URL} />}
      
      {/* MODAL DE LOTE */}
      {showBatchRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1005] p-4">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                  <h3 className="font-bold text-xl text-blue-900 mb-4">Solicitar Baixa em Lote</h3>
                  <div className="space-y-4">
                      <textarea className="w-full border p-2 rounded" rows={2} value={batchRequestReason} onChange={e => setBatchRequestReason(e.target.value)} placeholder="Motivo comum a todos..." autoFocus />
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                          <button onClick={handlePrintDraft} className="w-full bg-white border border-yellow-500 text-yellow-700 px-3 py-2 rounded text-sm font-bold flex items-center justify-center hover:bg-yellow-100">
                              <Printer className="w-4 h-4 mr-2"/> Imprimir Solicitação (PDF)
                          </button>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Anexar Laudo Assinado</label>
                          <div className="flex items-center justify-center w-full">
                              <label className="flex flex-col w-full h-24 border-2 border-dashed border-gray-300 hover:bg-gray-50 rounded-lg cursor-pointer">
                                  <div className="flex flex-col items-center justify-center pt-5">
                                      <UploadCloud className="w-8 h-8 text-gray-400" />
                                      <p className="pt-1 text-sm text-gray-400">{batchRequestFile ? batchRequestFile.name : "Selecione o PDF"}</p>
                                  </div>
                                  <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={e => setBatchRequestFile(e.target.files ? e.target.files[0] : null)}/>
                              </label>
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={() => setShowBatchRequestModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                      <button onClick={handleBatchRequestSubmit} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Finalizar</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DESCARTE (LOTE) */}
      {showBatchDisposeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1005] p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
                <div className="flex items-center text-red-600 mb-4"><AlertTriangle className="w-8 h-8 mr-3"/><h3 className="font-bold text-xl text-gray-800">Descarte em Lote</h3></div>
                <p className="mb-4 text-sm text-gray-600">Confirma o descarte irreversível de <b>{selectedRetiredIds.length} ativos</b>?</p>
                <textarea className="w-full border p-3 rounded" rows={3} placeholder="Destino final / Justificativa..." value={batchDisposeNote} onChange={e => setBatchDisposeNote(e.target.value)} />
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowBatchDisposeConfirm(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                    <button onClick={handleBatchDispose} className="px-4 py-2 bg-red-600 text-white rounded font-bold">Confirmar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default RetirementAndDisposalPage;