// frontend/src/components/ConfirmationModal.tsx

import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle } from 'lucide-react';
import { Movement } from '../App';
import axios from 'axios';

interface ConfirmationModalProps {
  movement: Movement;
  onClose: () => void;
  onSuccess: () => void;
  API_URL: string;
}

const ConfirmationModal = ({ movement, onClose, onSuccess, API_URL }: ConfirmationModalProps) => {
  const [actualDeliveryDate, setActualDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile) {
      setError('Por favor, anexe o arquivo do recibo.');
      return;
    }

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('actual_delivery_date', actualDeliveryDate);
    formData.append('receiptFile', receiptFile);

    try {
      const token = localStorage.getItem('token'); // Pega o token do armazenamento local
      await axios.post(`${API_URL}/asset-movements/${movement.id}/confirm-delivery`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}` // Adiciona o cabeçalho de autorização
        }
      });
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Erro ao confirmar entrega:", err);
      setError(err.response?.data?.message || 'Ocorreu um erro ao enviar o arquivo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Entrega Confirmada!</h2>
          <p className="text-gray-600 mt-2">O registro foi atualizado com sucesso.</p>
          <button 
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="mt-6 w-full bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Confirmar Entrega da Movimentação #{movement.id}</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700 mb-1">Data da Entrega Efetiva</label>
            <input 
              type="date" 
              id="deliveryDate" 
              value={actualDeliveryDate} 
              onChange={(e) => setActualDeliveryDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anexar Recibo Assinado (PDF/JPG/PNG)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                    <span>Carregar um arquivo</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                  </label>
                  <p className="pl-1">ou arraste e solte</p>
                </div>
                {receiptFile ? (
                    <p className="text-sm text-green-600 font-semibold">{receiptFile.name}</p>
                ) : (
                    <p className="text-xs text-gray-500">PDF, PNG, JPG até 10MB</p>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50">
            {isLoading ? 'Enviando...' : 'Salvar Confirmação'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConfirmationModal;