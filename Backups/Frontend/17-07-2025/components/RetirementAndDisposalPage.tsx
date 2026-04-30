// frontend/src/components/RetirementAndDisposalPage.tsx

import React, { useState, useCallback } from 'react';
import { Asset } from '../App';
import axios from 'axios';
import { useToast } from '../App';
import { Search, List, Upload, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface RetirementAndDisposalPageProps {
  API_URL: string;
}

// Interface para o ativo na "Mesa de Preparação"
interface StagedAsset {
  asset: Asset;
  status: 'valid' | 'invalid' | 'verifying';
  message: string;
}

const RetirementAndDisposalPage = ({ API_URL }: RetirementAndDisposalPageProps) => {
  const [inputMode, setInputMode] = useState<'single' | 'list'>('single');
  const [singleSearchTerm, setSingleSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const validateAndAddAsset = useCallback(async (patrimonio: string) => {
    if (!patrimonio.trim()) return;

    // Evita adicionar duplicados
    if (stagedAssets.some(item => item.asset.patrimonio_number === patrimonio)) {
      addToast(`Ativo ${patrimonio} já está na lista.`, 'warning');
      return;
    }

    const placeholder: StagedAsset = { 
      asset: { patrimonio_number: patrimonio } as Asset, 
      status: 'verifying', 
      message: 'Verificando...' 
    };
    setStagedAssets(prev => [...prev, placeholder]);

    try {
      // Usamos a rota de validação para checar o status do ativo
      const response = await axios.post(`${API_URL}/assets/validate-for-movement`, {
        patrimonio_number: patrimonio,
        movement_type: 'return' // Usamos 'return' para checar se o status permite a baixa (available, maintenance)
      });
      
      const validAsset: StagedAsset = { asset: response.data, status: 'valid', message: 'Pronto para Baixa' };
      setStagedAssets(prev => prev.map(item => item.asset.patrimonio_number === patrimonio ? validAsset : item));

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro desconhecido.';
      const invalidAsset: StagedAsset = { 
        asset: { patrimonio_number: patrimonio } as Asset, 
        status: 'invalid', 
        message: errorMessage 
      };
      setStagedAssets(prev => prev.map(item => item.asset.patrimonio_number === patrimonio ? invalidAsset : item));
    }
  }, [stagedAssets, API_URL, addToast]);

  const handleSingleAdd = () => {
    validateAndAddAsset(singleSearchTerm);
    setSingleSearchTerm('');
  };

  const handleListAdd = () => {
    const patrimonios = listSearchTerm.split(/[\n,;]+/).filter(p => p.trim() !== '');
    patrimonios.forEach(p => validateAndAddAsset(p.trim()));
    setListSearchTerm('');
  };

  const handleRemoveAsset = (patrimonio: string) => {
    setStagedAssets(prev => prev.filter(item => item.asset.patrimonio_number !== patrimonio));
  };

  const handleBatchRetire = async () => {
    const validAssetIds = stagedAssets.filter(item => item.status === 'valid').map(item => item.asset.id);
    if (validAssetIds.length === 0) {
      addToast('Nenhum ativo válido na lista para dar baixa.', 'warning');
      return;
    }
    if (!reason) {
      addToast('O motivo da baixa é obrigatório.', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(`${API_URL}/assets/batch-retire`, { assetIds: validAssetIds, reason });
      addToast(response.data.message, 'success');
      // Limpa a lista após o sucesso
      setStagedAssets([]);
      setReason('');
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao processar baixa em lote.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900">Central de Baixas e Descartes</h1>
      
      {/* PAINEL DE ENTRADA */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border">
        <h3 className="text-lg font-bold text-gray-800 mb-4">1. Identificar Ativos para Baixa</h3>
        <div className="flex border-b mb-4">
          <button onClick={() => setInputMode('single')} className={`px-4 py-2 text-sm font-medium ${inputMode === 'single' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><Search className="w-4 h-4 mr-2 inline-block"/>Busca Individual</button>
          <button onClick={() => setInputMode('list')} className={`px-4 py-2 text-sm font-medium ${inputMode === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><List className="w-4 h-4 mr-2 inline-block"/>Entrada por Lista</button>
        </div>
        
        {inputMode === 'single' && (
          <div className="flex space-x-2"><input type="text" value={singleSearchTerm} onChange={e => setSingleSearchTerm(e.target.value)} placeholder="Digite o Patrimônio..." className="flex-grow px-4 py-2 border rounded-md"/><button onClick={handleSingleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700">Adicionar à Lista</button></div>
        )}
        {inputMode === 'list' && (
          <div><textarea value={listSearchTerm} onChange={e => setListSearchTerm(e.target.value)} rows={5} placeholder="Cole aqui uma lista de números de patrimônio, separados por quebra de linha, vírgula ou ponto e vírgula." className="w-full p-2 border rounded-md"></textarea><button onClick={handleListAdd} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700">Adicionar da Lista</button></div>
        )}
      </div>

      {/* MESA DE PREPARAÇÃO (Staging Area) */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4">2. Mesa de Preparação ({stagedAssets.length} itens)</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0"><tr><th className="px-6 py-3">Patrimônio</th><th className="px-6 py-3">Ativo</th><th className="px-6 py-3">Status da Verificação</th><th className="px-6 py-3">Ação</th></tr></thead>
            <tbody>
              {stagedAssets.map((item, index) => (
                <tr key={`${item.asset.patrimonio_number}-${index}`} className="bg-white border-b">
                  <td className="px-6 py-4 font-medium">{item.asset.patrimonio_number}</td>
                  <td className="px-6 py-4">{item.asset.brand ? `${item.asset.brand} ${item.asset.model}` : '...'}</td>
                  <td className={`px-6 py-4 font-semibold ${item.status === 'valid' ? 'text-green-600' : item.status === 'invalid' ? 'text-red-600' : 'text-gray-500'}`}>
                    <div className="flex items-center">
                      {item.status === 'valid' && <CheckCircle className="w-4 h-4 mr-2"/>}
                      {item.status === 'invalid' && <AlertTriangle className="w-4 h-4 mr-2"/>}
                      {item.message}
                    </div>
                  </td>
                  <td className="px-6 py-4"><button onClick={() => handleRemoveAsset(item.asset.patrimonio_number!)} className="text-red-500 hover:text-red-700"><X className="w-5 h-5"/></button></td>
                </tr>
              ))}
              {stagedAssets.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-6">Adicione ativos para dar baixa...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAINEL DE AÇÃO FINAL */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border">
        <h3 className="text-lg font-bold text-gray-800 mb-4">3. Finalizar Baixa em Lote</h3>
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo da Baixa (será aplicado a todos os ativos válidos)</label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full p-2 border rounded-md" placeholder="Ex: Lote de equipamentos obsoletos substituídos em 2025."/>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleBatchRetire} disabled={isLoading || stagedAssets.filter(a=>a.status === 'valid').length === 0} className="bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-md hover:bg-red-700 flex items-center disabled:opacity-50">
            {isLoading ? 'Processando...' : `Confirmar Baixa em ${stagedAssets.filter(a=>a.status === 'valid').length} Ativo(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RetirementAndDisposalPage;