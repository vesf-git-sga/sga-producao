
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Asset, useToast } from '../App';
import { Search, Info, ArrowDownCircle, Trash2, Check, X as XIcon, Clock, Eye } from 'lucide-react';
import RequestRetirementModal from './RequestRetirementModal';
import DisposeAssetModal from './DisposeAssetModal';
import ApprovalActionModal from './ApprovalActionModal';
import RequestDetailsModal from './RequestDetailsModal';

interface RetirementAndDisposalPageProps {
  API_URL: string;
  userRole?: 'admin' | 'manager' | 'basic';
}

interface PendingRequest {
  id: number;
  reason: string;
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
}

const RetirementAndDisposalPage = ({ API_URL, userRole }: RetirementAndDisposalPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedAsset, setSearchedAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  
  const [assetToRequestRetirement, setAssetToRequestRetirement] = useState<Asset | null>(null);
  const [assetToDispose, setAssetToDispose] = useState<Asset | null>(null);
  const [requestToAction, setRequestToAction] = useState<{id: number, action: 'approve' | 'reject'} | null>(null);
  const [requestToView, setRequestToView] = useState<RequestDetails | null>(null);

  const { addToast } = useToast();

  // <<< LÓGICA PARA BUSCAR SOLICITAÇÕES PENDENTES RESTAURADA >>>
  const fetchPendingRequests = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/retirement-requests/pending`);
      setPendingRequests(response.data);
    } catch (error) {
      console.error("Erro ao buscar solicitações pendentes:", error);
      addToast('Falha ao carregar solicitações pendentes.', 'error');
    }
  }, [API_URL, addToast]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setSearchedAsset(null);
    try {
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
      await axios.post(`${API_URL}/assets/${assetId}/request-retirement`, formData);
      addToast('Solicitação de baixa enviada com sucesso!', 'success');
      setAssetToRequestRetirement(null);
      setSearchedAsset(null);
      setSearchTerm('');
      fetchPendingRequests();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao enviar solicitação.', 'error');
    }
  };

  const handleApprovalAction = async (requestId: number, reason?: string) => {
    const action = requestToAction?.action;
    if(!action) return;
    try {
      if(action === 'approve') {
        await axios.put(`${API_URL}/retirement-requests/${requestId}/approve`);
        addToast('Solicitação APROVADA com sucesso!', 'success');
      } else if (action === 'reject') {
        await axios.put(`${API_URL}/retirement-requests/${requestId}/reject`, { rejection_reason: reason });
        addToast('Solicitação REJEITADA com sucesso!', 'success');
      }
      fetchPendingRequests();
      setRequestToAction(null);
    } catch (error: any) {
      addToast(error.response?.data?.message || `Erro ao ${action === 'approve' ? 'aprovar' : 'rejeitar'}.`, 'error');
    }
  };
  
  const handleDisposeSave = async (assetId: number, note: string) => {
    try {
      await axios.put(`${API_URL}/assets/${assetId}/dispose`, { disposal_note: note });
      addToast('Ativo descartado com sucesso!', 'success');
      setAssetToDispose(null);
      handleSearch();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao descartar ativo.', 'error');
    }
  };

  const handleViewDetails = async (requestId: number) => {
    try {
      const response = await axios.get(`${API_URL}/retirement-requests/${requestId}`);
      setRequestToView(response.data);
    } catch (error) {
      addToast('Não foi possível carregar os detalhes da solicitação.', 'error');
    }
  };

  const renderAssetActions = () => {
    if (!searchedAsset) return null;
    const { status } = searchedAsset;

    if (status === 'available' || status === 'maintenance') {
      return <button onClick={() => setAssetToRequestRetirement(searchedAsset)} className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center"><ArrowDownCircle className="w-5 h-5 mr-2"/> Solicitar Baixa</button>;
    }
    if (status === 'retired') {
      return <button onClick={() => setAssetToDispose(searchedAsset)} className="bg-gray-800 text-white font-bold px-6 py-2 rounded-lg shadow-md hover:bg-black flex items-center"><Trash2 className="w-5 h-5 mr-2"/> Descartar este Ativo</button>;
    }
    if (status === 'pending_retirement') {
      return <div className="bg-cyan-100 border-l-4 border-cyan-500 text-cyan-800 p-4"><p className="font-bold">Status</p><p>Este ativo já possui uma solicitação de baixa pendente de análise na tabela abaixo.</p></div>;
    }
    if (status === 'in_use' || status === 'loaned') {
      return <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4"><p className="font-bold">Ação Necessária</p><p>Este ativo está em uso/emprestado. Registre a devolução antes de solicitar a baixa.</p></div>;
    }
    if (status === 'disposed') {
      return <div className="bg-gray-100 border-l-4 border-gray-500 text-gray-700 p-4"><p className="font-bold">Status Final</p><p>Este ativo já foi descartado permanentemente.</p></div>;
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900">Central de Baixas e Descartes</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-lg border">
        <h3 className="text-lg font-bold text-gray-800 mb-4">1. Consultar ou Solicitar Baixa de Ativo</h3>
        <div className="flex space-x-2">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Digite o Patrimônio..." className="flex-grow px-4 py-2 border rounded-md shadow-sm" onKeyDown={(e) => e.key === 'Enter' && handleSearch()}/>
          <button onClick={handleSearch} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center disabled:opacity-50"><Search className="w-5 h-5 mr-2"/>{isLoading ? 'Buscando...' : 'Buscar'}</button>
        </div>
      </div>

      {searchedAsset && (
        <div className="bg-white p-6 rounded-xl shadow-md animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 mb-4">
            <div><span className="font-semibold text-gray-600">Patrimônio:</span> {searchedAsset.patrimonio_number || 'N/A'}</div>
            <div><span className="font-semibold text-gray-600">Ativo:</span> {searchedAsset.brand} {searchedAsset.model}</div>
            <div><span className="font-semibold text-gray-600">Status Atual:</span> <span className="font-bold">{searchedAsset.status}</span></div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <h4 className="font-semibold text-gray-800 mb-3">Próxima Ação Disponível:</h4>
            {renderAssetActions()}
          </div>
        </div>
      )}

      {/* <<< TABELA DE SOLICITAÇÕES PENDENTES RESTAURADA >>> */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Clock className="w-5 h-5 mr-2 text-yellow-600"/> 2. Solicitações Pendentes de Análise</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Data</th><th className="px-6 py-3">Solicitante</th><th className="px-6 py-3">Ativo (Patrimônio)</th><th className="px-6 py-3">Motivo</th><th className="px-6 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((req) => (
                <tr key={req.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(req.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4">{req.requester_name}</td>
                  <td className="px-6 py-4">{req.patrimonio_number}</td>
                  <td className="px-6 py-4">{req.reason}</td>
                  <td className="px-6 py-4 text-center space-x-4">
                    <button onClick={() => handleViewDetails(req.id)} className="font-medium text-gray-500 hover:underline" title="Ver Detalhes e Anexo"><Eye className="inline-block w-5 h-5"/></button>
                    {/* <<< LÓGICA DE PERMISSÃO APLICADA AQUI >>> */}
                    {userRole === 'admin' && (
                      <>
                        <button onClick={() => setRequestToAction({id: req.id, action: 'approve'})} className="font-medium text-green-600 hover:underline" title="Aprovar"><Check className="inline-block w-5 h-5"/></button>
                        <button onClick={() => setRequestToAction({id: req.id, action: 'reject'})} className="font-medium text-red-600 hover:underline" title="Rejeitar"><XIcon className="inline-block w-5 h-5"/></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {pendingRequests.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-6">Nenhuma solicitação pendente no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* RENDERIZAÇÃO DOS MODAIS */}
      {assetToRequestRetirement && (
        <RequestRetirementModal asset={assetToRequestRetirement} onClose={() => setAssetToRequestRetirement(null)} onSubmit={handleRequestRetirementSubmit}/>
      )}
      {assetToDispose && (
        <DisposeAssetModal asset={assetToDispose} onClose={() => setAssetToDispose(null)} onSave={handleDisposeSave}/>
      )}
      {requestToAction && (
        <ApprovalActionModal action={requestToAction.action} requestId={requestToAction.id} onClose={() => setRequestToAction(null)} onConfirm={handleApprovalAction} />
      )}
      {requestToView && (
        <RequestDetailsModal request={requestToView} onClose={() => setRequestToView(null)} API_URL={API_URL}/>
      )}
    </div>
  );
};

export default RetirementAndDisposalPage;