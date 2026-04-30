// frontend/src/components/DisposeAssetModal.tsx

import React, { useState } from 'react';
import { X, Trash2, Save, AlertTriangle } from 'lucide-react';
import { Asset } from '../App';

interface DisposeAssetModalProps {
  asset: Asset;
  onClose: () => void;
  onSave: (assetId: number, note: string) => Promise<void>;
}

const DisposeAssetModal = ({ asset, onClose, onSave }: DisposeAssetModalProps) => {
  const [disposalNote, setDisposalNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalNote) {
      alert('Por favor, informe a nota de descarte (ex: para onde foi enviado, etc).');
      return;
    }
    setIsLoading(true);
    await onSave(asset.id, disposalNote);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-red-700 mb-4 flex items-center"><AlertTriangle className="mr-3"/>Descartar Ativo Permanentemente</h2>
        
        <div className="space-y-4">
            <p className="text-sm text-gray-700">
                Esta ação é **irreversível**. Ela indica que o ativo foi permanentemente removido (doado, reciclado, lixo eletrônico, etc.).
            </p>
            <div className="bg-gray-50 p-3 border rounded-md text-sm">
                <p><strong>Ativo:</strong> {asset.brand} {asset.model}</p>
                <p><strong>Patrimônio:</strong> {asset.patrimonio_number || 'N/A'}</p>
            </div>
            <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">Nota de Descarte (Obrigatório)</label>
                <textarea
                id="note"
                rows={3}
                value={disposalNote}
                onChange={(e) => setDisposalNote(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Ex: Enviado para reciclagem de eletrônicos conforme processo SEI X.Y.Z"
                required
                ></textarea>
            </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-red-700 text-white rounded-lg shadow-sm hover:bg-red-800 disabled:opacity-50 flex items-center">
            <Trash2 className="w-5 h-5 mr-2"/>
            {isLoading ? 'Descartando...' : 'Confirmar Descarte'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DisposeAssetModal;