// frontend/src/components/SubstitutionModal.tsx

import React, { useState, useContext } from 'react';
import { X, Search, CheckCircle, Repeat } from 'lucide-react';
import { Movement, Asset } from '../App'; // Supondo que a interface Asset está exportada de App.tsx
import axios, { AxiosError } from 'axios';
import { useToast } from '../App'; // Supondo que o hook de Toast está em App.tsx

interface SubstitutionModalProps {
  movement: Movement; // A movimentação original do ativo a ser devolvido
  onClose: () => void;
  onSuccess: () => void;
  API_URL: string;
}

const SubstitutionModal = ({ movement, onClose, onSuccess, API_URL }: SubstitutionModalProps) => {
  const [reason, setReason] = useState('');
  const [newAssetSearchTerm, setNewAssetSearchTerm] = useState('');
  const [newAsset, setNewAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();
  
  const assetToReturn = movement.assets?.[0]; // Pega o primeiro ativo da movimentação para simplificar

  const handleSearchNewAsset = async () => {
    if (!newAssetSearchTerm) return;
    setSearchLoading(true);
    setError('');
    setNewAsset(null);
    try {
      const response = await axios.post(`${API_URL}/assets/validate-for-movement`, { 
        patrimonio_number: newAssetSearchTerm, 
        movement_type: 'exit' // Usamos 'exit' para validar se o ativo está 'available'
      });
      setNewAsset(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao buscar ativo substituto.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!assetToReturn || !newAsset) {
      addToast('É necessário selecionar um ativo substituto válido.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/asset-movements/substitute`, {
        oldAssetId: assetToReturn.id,
        newAssetId: newAsset.id,
        reason: reason,
      });
      addToast('Substituição realizada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao processar substituição.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center"><Repeat className="mr-3"/>Substituição de Ativo</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Lado Esquerdo: Ativo a ser Devolvido */}
          <div className="p-4 border rounded-lg bg-red-50">
            <h3 className="font-bold text-red-800 mb-2">Ativo a ser Devolvido</h3>
            <p><strong>Patrimônio:</strong> {assetToReturn?.patrimonio_number || 'N/A'}</p>
            <p><strong>Ativo:</strong> {assetToReturn?.brand} {assetToReturn?.model}</p>
            <p><strong>Responsável:</strong> {movement.recipient_display_name}</p>
          </div>

          {/* Lado Direito: Ativo Substituto */}
          <div className="p-4 border rounded-lg bg-green-50">
            <h3 className="font-bold text-green-800 mb-2">Ativo Substituto</h3>
            <div className="flex space-x-2 mb-2">
              <input type="text" value={newAssetSearchTerm} onChange={(e) => setNewAssetSearchTerm(e.target.value)} placeholder="Patrimônio do novo ativo..." className="flex-grow px-3 py-1 border rounded-md"/>
              <button onClick={handleSearchNewAsset} disabled={searchLoading} className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center disabled:opacity-50">
                <Search className="w-4 h-4 mr-1"/> {searchLoading ? '...' : 'Buscar'}
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {newAsset && (
              <div className="bg-white p-2 border rounded text-center">
                <p className="font-semibold text-green-700 flex items-center justify-center"><CheckCircle className="w-4 h-4 mr-1"/>Ativo selecionado!</p>
                <p className="text-xs">{newAsset.brand} {newAsset.model} ({newAsset.patrimonio_number})</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo da Substituição</label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full p-2 border rounded-md" placeholder="Ex: Equipamento apresentou defeito insanável."/>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
          <button onClick={handleSubmit} disabled={!newAsset || isLoading} className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-md hover:bg-blue-800 disabled:opacity-50">
            {isLoading ? 'Processando...' : 'Confirmar Substituição'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubstitutionModal;