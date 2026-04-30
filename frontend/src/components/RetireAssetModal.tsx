 // frontend/src/components/RetireAssetModal.tsx


import React, { useState } from 'react';

import { X, ArrowDownCircle, Save } from 'lucide-react';

import { Asset } from '../App';


interface RetireAssetModalProps {

  asset: Asset;

  onClose: () => void;

  onSave: (assetId: number, reason: string) => Promise<void>;

}


const RetireAssetModal = ({ asset, onClose, onSave }: RetireAssetModalProps) => {

  const [reason, setReason] = useState('');

  const [isLoading, setIsLoading] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!reason) {

      alert('Por favor, informe o motivo da baixa.');

      return;

    }

    setIsLoading(true);

    await onSave(asset.id, reason);

    setIsLoading(false);

    onClose();

  };


  return (

    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">

        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">

          <X className="w-6 h-6" />

        </button>

        <h2 className="text-2xl font-bold text-blue-900 mb-6">Dar Baixa em Ativo</h2>


        <div className="space-y-4">

            <p className="text-sm text-gray-700">

                Você está prestes a dar baixa no ativo. Esta ação indica que o equipamento não será mais utilizado.

            </p>

            <div className="bg-gray-50 p-3 border rounded-md text-sm">

                <p><strong>Ativo:</strong> {asset.brand} {asset.model}</p>

                <p><strong>Patrimônio:</strong> {asset.patrimonio_number || 'N/A'}</p>

            </div>

            <div>

                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo da Baixa (Obrigatório)</label>

                <textarea

                id="reason"

                rows={3}

                value={reason}

                onChange={(e) => setReason(e.target.value)}

                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"

                placeholder="Ex: Equipamento obsoleto, queima insanável, etc."

                required

                ></textarea>

            </div>

        </div>


        <div className="flex justify-end space-x-3 mt-8">

          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">

            Cancelar

          </button>

          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 flex items-center">

            <ArrowDownCircle className="w-5 h-5 mr-2"/>

            {isLoading ? 'Salvando...' : 'Confirmar Baixa'}

          </button>

        </div>

      </form>

    </div>

  );

};


export default RetireAssetModal; 