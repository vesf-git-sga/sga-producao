// frontend/src/components/SubstitutionModal.tsx -> VERSÃO FINAL REFINADA

import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Movement, Asset, useToast } from '../App';
import { X, Repeat, Search, CheckCircle, UploadCloud } from 'lucide-react';

interface SubstitutionModalProps {
  movement: Movement;
  onClose: () => void;
  onSuccess: () => void;
  API_URL: string;
}

interface ReplacementItem {
  oldAsset: Asset;
  searchTerm: string;
  foundAsset: Asset | null;
  isLoading: boolean;
  error: string;
}

const SubstitutionModal = ({ movement, onClose, onSuccess, API_URL }: SubstitutionModalProps) => {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState('');

  const [itemsToReplace, setItemsToReplace] = useState<ReplacementItem[]>(() => 
    movement.assets?.map(asset => ({
      oldAsset: asset,
      searchTerm: '',
      foundAsset: null,
      isLoading: false,
      error: ''
    })) || []
  );

  const [checkedPeripherals, setCheckedPeripherals] = useState<{ [key: string]: boolean }>({});
  const [otherPeripheral, setOtherPeripheral] = useState('');

  // <<< AJUSTE: Lógica para determinar se é um "Kit" >>>
  const isKitSubstitution = itemsToReplace.length > 1;

  // <<< AJUSTE: Lógica para mostrar a seção de acessórios >>>
  const showPeripheralsSection = itemsToReplace.some(item => 
    (item.foundAsset?.item_type_name?.toLowerCase() === 'notebook' || item.foundAsset?.item_type_name?.toLowerCase() === 'desktop')
  );

  const handleSearchNewAsset = useCallback(async (index: number) => {
    const items = [...itemsToReplace];
    const currentItem = items[index];
    
    if (!currentItem.searchTerm) {
      addToast('Digite um patrimônio para buscar.', 'warning');
      return;
    }

    items[index] = { ...currentItem, isLoading: true, error: '', foundAsset: null };
    setItemsToReplace(items);

    try {
      const response = await axios.post<Asset>(`${API_URL}/assets/validate-for-movement`, {
        patrimonio_number: currentItem.searchTerm,
        movement_type: 'exit'
      });
      
      const updatedItems = [...itemsToReplace];
      updatedItems[index] = { ...currentItem, foundAsset: response.data, isLoading: false };
      setItemsToReplace(updatedItems);
      addToast(`Ativo ${response.data.patrimonio_number} validado com sucesso!`, 'success');

    } catch (err: any) {
      const updatedItems = [...itemsToReplace];
      updatedItems[index] = { ...currentItem, error: err.response?.data?.message || 'Erro ao buscar', isLoading: false, foundAsset: null };
      setItemsToReplace(updatedItems);
      addToast(err.response?.data?.message || 'Erro ao buscar ou validar ativo.', 'error');
    }
  }, [API_URL, itemsToReplace, addToast]);

  const handleSearchTermChange = (index: number, value: string) => {
    const updatedItems = [...itemsToReplace];
    updatedItems[index].searchTerm = value;
    setItemsToReplace(updatedItems);
  };

  const handlePeripheralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCheckedPeripherals(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const oldAssetIds = itemsToReplace.map(item => item.oldAsset.id);
    const newAssetIds = itemsToReplace.map(item => item.foundAsset?.id).filter((id): id is number => !!id);
    
    if (newAssetIds.length !== oldAssetIds.length) {
      addToast('Por favor, encontre um substituto válido para cada ativo a ser devolvido.', 'warning');
      return;
    }
    if (!reason) {
      addToast('O motivo da substituição é obrigatório.', 'warning');
      return;
    }

    const newPeripherals = Object.keys(checkedPeripherals).filter(key => checkedPeripherals[key]);
    if (otherPeripheral.trim()) {
      newPeripherals.push(otherPeripheral.trim());
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/asset-movements/substitute`, {
        oldAssetIds,
        newAssetIds,
        reason,
        peripherals: newPeripherals
      });
      addToast('Substituição realizada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao confirmar a substituição.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-3xl relative max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-6">
          {/* <<< AJUSTE 1: Título dinâmico >>> */}
          <h2 className="text-2xl font-bold text-blue-900 flex items-center">
            <Repeat className="w-6 h-6 mr-3"/>{isKitSubstitution ? 'Substituição de Kit de Ativos' : 'Substituição de Ativo'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        </div>

        <div className="space-y-6 overflow-y-auto pr-4 flex-grow">
          <div>
            {/* <<< AJUSTE 2: Subtítulo dinâmico >>> */}
            <h3 className="text-lg font-semibold text-gray-800 mb-2">1. {isKitSubstitution ? 'Itens a Serem Substituídos' : 'Item a Ser Substituído'}</h3>
            <div className="space-y-4">
              {itemsToReplace.map((item, index) => (
                <div key={item.oldAsset.id} className="p-4 border rounded-lg bg-gray-50">
                  {/* <<< AJUSTE 3: Exibição do tipo de item >>> */}
                  <p className="font-bold">{item.oldAsset.item_type_name} {item.oldAsset.brand} ({item.oldAsset.patrimonio_number})</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <input type="text" value={item.searchTerm} onChange={e => handleSearchTermChange(index, e.target.value)} placeholder="Patrimônio do substituto..." className="flex-grow px-3 py-2 border rounded-md text-sm"/>
                    <button type="button" onClick={() => handleSearchNewAsset(index)} disabled={item.isLoading} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center"><Search className="w-4 h-4 mr-1"/>Buscar</button>
                  </div>
                  {item.isLoading && <p className="text-xs text-blue-600 mt-1">Verificando...</p>}
                  {item.error && <p className="text-xs text-red-600 mt-1">{item.error}</p>}
                  {item.foundAsset && <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/>Substituto: {item.foundAsset.patrimonio_number}</p>}
                </div>
              ))}
            </div>
          </div>
          
          {/* <<< AJUSTE 4: Seção de acessórios com título melhorado e visibilidade corrigida >>> */}
          {showPeripheralsSection && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Acessórios do Novo Kit</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-gray-50">
                  <label className="flex items-center space-x-2"><input type="checkbox" name="Mouse" onChange={handlePeripheralChange}/><span>Mouse</span></label>
                  <label className="flex items-center space-x-2"><input type="checkbox" name="Teclado" onChange={handlePeripheralChange}/><span>Teclado</span></label>
                  <label className="flex items-center space-x-2"><input type="checkbox" name="Fonte de Alimentação" onChange={handlePeripheralChange}/><span>Fonte</span></label>
                  <div className="flex items-center space-x-2">
                      <label className="text-sm">Outro:</label>
                      <input type="text" value={otherPeripheral} onChange={(e) => setOtherPeripheral(e.target.value)} className="w-full p-1 border rounded-md text-sm" placeholder="Ex: Webcam"/>
                  </div>
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Motivo da Substituição (Obrigatório)</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" required placeholder="Ex: Equipamento original apresentou defeito insanável."/>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
          <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50">
            {isLoading ? 'Processando...' : 'Confirmar Substituição'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SubstitutionModal;