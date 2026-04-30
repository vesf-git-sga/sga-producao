// frontend/src/components/RequestRetirementModal.tsx -> CÓDIGO CORRETO E COMPLETO

import React, { useState } from 'react';
import { X, Save, UploadCloud } from 'lucide-react';
import { Asset } from '../App';

interface RequestRetirementModalProps {
  asset: Asset;
  onClose: () => void;
  onSubmit: (assetId: number, formData: FormData) => Promise<void>;
}

const RequestRetirementModal = ({ asset, onClose, onSubmit }: RequestRetirementModalProps) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEvidenceFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !evidenceFile) {
      setError('O motivo e o anexo de evidência são obrigatórios.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('reason', reason);
    formData.append('details', details);
    formData.append('evidenceFile', evidenceFile);
    
    await onSubmit(asset.id, formData);
    
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Solicitar Baixa de Ativo</h2>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 border rounded-md text-sm">
              <p><strong>Ativo:</strong> {asset.brand} {asset.model}</p>
              <p><strong>Patrimônio:</strong> {asset.patrimonio_number || 'N/A'}</p>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo (Obrigatório)</label>
            <select id="reason" value={reason} onChange={e => setReason(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required>
              <option value="">-- Selecione um motivo --</option>
              <option value="Dano Irreparável">Dano Irreparável (Exige Laudo)</option>
              <option value="Obsolescência Tecnológica">Obsolescência Tecnológica</option>
              <option value="Fim da Vida Útil">Fim da Vida Útil Contábil</option>
              <option value="Extravio/Furto">Extravio, Furto ou Roubo (Exige B.O.)</option>
            </select>
          </div>
            
          <div>
            <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
            <textarea id="details" rows={3} value={details} onChange={e => setDetails(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="Detalhe a causa do motivo selecionado acima."/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anexar Evidência (Laudo, B.O., etc.)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                    <span>Carregar arquivo</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" required />
                  </label>
                </div>
                {evidenceFile ? (<p className="text-sm text-green-600 font-semibold">{evidenceFile.name}</p>) : (<p className="text-xs text-gray-500">PDF, PNG, JPG</p>)}
              </div>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50 flex items-center">
            <Save className="w-5 h-5 mr-2"/>
            {isLoading ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequestRetirementModal;